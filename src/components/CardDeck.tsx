import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useCursor, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard } from '../types';

interface CardPhysics {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  targetPosition: THREE.Vector3;
  mass: number;
  personality: 'shy' | 'neutral' | 'curious';
  breathPhase: number;
  awarenessTarget: THREE.Vector3 | null;
  restlessness: number;
  lastImpulseTime: number;
  // Space curve tracking
  curveT: number;           // Position along the curve [0, 1]
  curveTVelocity: number;   // How fast we're moving along the curve
  // Diagnostic data (populated each frame)
  diag: {
    curveTarget: THREE.Vector3;
    distToCurve: number;
    curveForce: number;
    repulsionForce: number;
    cohesionForce: number;
  };
}

interface CardProps {
  card: TarotCard;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  index: number;
  physics: React.MutableRefObject<CardPhysics>;
  allPhysics: React.MutableRefObject<CardPhysics[]>;
  currentlyDraggingRef: React.MutableRefObject<number | null>;
  phaseStateRef: React.MutableRefObject<{
    elapsedTime: number;
    currentPhase: 'fast' | 'slow';
    velocityMultiplier: number;
    transitionProgress: number;
  }>;
  curveStateRef: React.MutableRefObject<{
    currentCurve: CurveType;
    nextCurve: CurveType;
    transitionProgress: number;
    cycleTime: number;
  }>;
  isInjected: boolean;
  mass: number;
  personality: 'shy' | 'neutral' | 'curious';
  currentRef: React.MutableRefObject<{
    direction: THREE.Vector3;
    strength: number;
    targetStrength: number;
    changeTimer: number;
  }>;
}

// ============================================
// SPACE CURVE DEFINITIONS
// Cards follow these beautiful mathematical paths
// ============================================

type CurveType = 'torusKnot' | 'trefoil' | 'lissajous3D' | 'cinquefoil' | 'rose' | 'lorenz';

// Torus knot: winds p times around the torus while going through the hole q times
const torusKnot = (t: number, time: number, p = 2, q = 3, R = 5, r = 2): THREE.Vector3 => {
  const phi = t * Math.PI * 2 * q + time * 0.1;
  const theta = t * Math.PI * 2 * p + time * 0.07;
  
  const x = (R + r * Math.cos(phi)) * Math.cos(theta);
  const y = (R + r * Math.cos(phi)) * Math.sin(theta);
  const z = r * Math.sin(phi);
  
  return new THREE.Vector3(x, y, z).multiplyScalar(0.8);
};

// Trefoil knot - the simplest non-trivial knot
const trefoilKnot = (t: number, time: number, scale = 4): THREE.Vector3 => {
  const phi = t * Math.PI * 2 + time * 0.08;
  
  const x = Math.sin(phi) + 2 * Math.sin(2 * phi);
  const y = Math.cos(phi) - 2 * Math.cos(2 * phi);
  const z = -Math.sin(3 * phi);
  
  return new THREE.Vector3(x, y, z).multiplyScalar(scale * 0.4);
};

// Cinquefoil knot (5-pointed star knot)
const cinquefoilKnot = (t: number, time: number, scale = 4): THREE.Vector3 => {
  const phi = t * Math.PI * 2 + time * 0.06;
  
  const x = Math.cos(phi) * (2 - Math.cos(2 * phi / 5));
  const y = Math.sin(phi) * (2 - Math.cos(2 * phi / 5));
  const z = -Math.sin(2 * phi / 5);
  
  return new THREE.Vector3(x, y, z).multiplyScalar(scale * 0.5);
};

// 3D Lissajous curve - beautiful interweaving loops
const lissajous3D = (t: number, time: number, a = 3, b = 2, c = 5, scale = 5): THREE.Vector3 => {
  const phi = t * Math.PI * 2;
  const drift = time * 0.05;
  
  const x = Math.sin(a * phi + drift);
  const y = Math.sin(b * phi + drift * 1.3);
  const z = Math.sin(c * phi + drift * 0.7);
  
  return new THREE.Vector3(x, y, z).multiplyScalar(scale);
};

// Rose curve wrapped on a sphere
const sphericalRose = (t: number, time: number, k = 5, scale = 5): THREE.Vector3 => {
  const phi = t * Math.PI * 2 + time * 0.04;
  const r = Math.cos(k * phi);
  const theta = phi * 2 + time * 0.03;
  
  const x = r * Math.cos(phi) * Math.sin(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(theta) * 0.5;
  
  return new THREE.Vector3(x, y, z).multiplyScalar(scale);
};

// Simplified Lorenz-inspired attractor (not true Lorenz, but has similar feel)
const lorenzInspired = (t: number, time: number, scale = 4): THREE.Vector3 => {
  const phi = t * Math.PI * 4 + time * 0.1;
  const wing = Math.sin(phi * 0.5) > 0 ? 1 : -1;
  
  const r = 2 + Math.cos(phi * 2);
  const x = r * Math.cos(phi) * wing;
  const y = r * Math.sin(phi);
  const z = Math.sin(phi * 3) * 1.5 + Math.cos(phi * 0.5) * 0.5;
  
  return new THREE.Vector3(x, y, z).multiplyScalar(scale * 0.6);
};

// Get position on the currently active curve
const getCurvePosition = (t: number, time: number, curveType: CurveType): THREE.Vector3 => {
  switch (curveType) {
    case 'torusKnot': return torusKnot(t, time, 3, 5);
    case 'trefoil': return trefoilKnot(t, time);
    case 'cinquefoil': return cinquefoilKnot(t, time);
    case 'lissajous3D': return lissajous3D(t, time, 3, 4, 7);
    case 'rose': return sphericalRose(t, time, 7);
    case 'lorenz': return lorenzInspired(t, time);
    default: return torusKnot(t, time);
  }
};

// Smoothstep for more organic easing
const smoothstep = (x: number): number => x * x * (3 - 2 * x);

// Blend between two curves for smooth transitions
const blendCurves = (
  t: number, 
  time: number, 
  curve1: CurveType, 
  curve2: CurveType, 
  blend: number
): THREE.Vector3 => {
  const p1 = getCurvePosition(t, time, curve1);
  const p2 = getCurvePosition(t, time, curve2);
  // Apply smoothstep for more organic transition feel
  return p1.lerp(p2, smoothstep(blend));
};

// Available curves for cycling
const CURVE_SEQUENCE: CurveType[] = ['trefoil', 'lissajous3D', 'torusKnot', 'cinquefoil', 'rose', 'lorenz'];
const CURVE_CYCLE_DURATION = 45; // seconds to stay on each curve
const CURVE_TRANSITION_DURATION = 8; // seconds to blend between curves (smooth morphing)

// Flow field (curl-ish) using trig as pseudo noise - still used for micro-perturbations
const flowField = (position: THREE.Vector3, time: number, scale = 1.0): THREE.Vector3 => {
  const p = position.clone().multiplyScalar(0.3);
  const t = time * 0.15;

  const n1 = Math.sin(p.x * 1.3 + t) * Math.cos(p.y * 0.9 + t * 0.7) * Math.sin(p.z * 1.1 + t * 0.5);
  const n2 = Math.cos(p.x * 0.8 + t * 1.1) * Math.sin(p.y * 1.4 + t * 0.6) * Math.cos(p.z * 0.7 + t * 0.9);
  const n3 = Math.sin(p.x * 1.1 + t * 0.8) * Math.sin(p.y * 0.7 + t * 1.2) * Math.cos(p.z * 1.3 + t * 0.4);

  return new THREE.Vector3(
    n2 - n3,
    n3 - n1,
    n1 - n2
  ).multiplyScalar(0.015 * scale); // Reduced - curve attraction is primary now
};

function Card({ card, initialPosition, initialRotation, index, physics, allPhysics, currentlyDraggingRef, phaseStateRef, curveStateRef, isInjected, mass, personality, currentRef }: CardProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { setSelectedCard, settings } = useStore();
  const showInfo = settings.showCardInfo !== false;
  const { camera, pointer, raycaster } = useThree();
  const cardBackTexture = useTexture('/card-back.png');

  useEffect(() => {
    if (cardBackTexture) {
      cardBackTexture.wrapS = THREE.ClampToEdgeWrapping;
      cardBackTexture.wrapT = THREE.ClampToEdgeWrapping;
      cardBackTexture.flipY = false;
    }
  }, [cardBackTexture]);

  // Change cursor to grab hand when hovering, grabbing hand when dragging
  useCursor(hovered && !dragging, 'grab');
  useCursor(dragging, 'grabbing');

  const dragOffset = useRef(new THREE.Vector3());
  const lastDragPosition = useRef(new THREE.Vector3());
  const dragVelocity = useRef(new THREE.Vector3());
  const hasDragged = useRef(false); // Track if user actually moved the card
  const trailRef = useRef<THREE.Vector3[]>([]);
  const lastTrailSampleRef = useRef(0);

  // Physics constants (tuned for flowy motion)
  const MOTION_SCALE = 0.5;   // Was 1.0, now 0.5 - balance between old (0.25) and new
  const MAX_VELOCITY = 1.0;   // Was 2.0 - reduced to prevent escape velocity
  const DAMPING = 0.992;      // Was 0.995 - slightly more drag to keep things controlled
  const REPULSION_STRENGTH = 5.0;
  const REPULSION_DISTANCE = 3.5;
  const CURSOR_INTERACTION_DISTANCE = 4.0;
  const CENTER_ATTRACTION = 0.02; // Reduced - curve handles this now
  const CENTER_ATTRACTION_DISTANCE = 8.0;
  const BOUNDARY_FORCE = 0.4;
  const BOUNDARY_DISTANCE = 10;
  const DRAG_REPULSION_STRENGTH = 3.5;
  const FLOCK_RADIUS = 4.5;
  const ALIGNMENT_STRENGTH = 0.008;
  const COHESION_STRENGTH = 0.003;
  const BREATH_SPEED = 0.25;
  const BREATH_AMPLITUDE = 0.018;
  const ATTENTION_STRENGTH = 0.015;
  const ATTENTION_DISTANCE = 6;
  
  // Curve following constants
  const CURVE_ATTRACTION_STRENGTH = 0.6;   // Was 0.4 - even stronger to keep cards on track
  const CURVE_T_VELOCITY_BASE = 0.015;     // Base speed of movement along curve
  const CURVE_T_VELOCITY_VARIANCE = 0.008; // Randomness in curve speed

  // Independent angular velocity so cards spin on varied axes
  const angularVelocity = useMemo(() => {
    return new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6
    );
  }, []);

  const handlePointerDown = useCallback((e: any) => {
    // Don't allow drag if another card is already being dragged
    if (currentlyDraggingRef.current !== null && currentlyDraggingRef.current !== index) {
      return;
    }

    e.stopPropagation();
    setDragging(true);
    hasDragged.current = false; // Reset drag tracking
    currentlyDraggingRef.current = index; // Mark this card as being dragged

    const group = groupRef.current;
    if (!group) return;

    // Calculate drag offset in world space
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    dragOffset.current.copy(group.position).sub(intersectPoint);
    lastDragPosition.current.copy(group.position);
    dragVelocity.current.set(0, 0, 0);

    // Stop current physics motion
    physics.current.velocity.set(0, 0, 0);
    physics.current.acceleration.set(0, 0, 0);
  }, [pointer, camera, raycaster, physics, currentlyDraggingRef, index]);

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      // Apply throw velocity
      physics.current.velocity.copy(dragVelocity.current).multiplyScalar(0.5);
    }
    currentlyDraggingRef.current = null; // Clear the dragging state even if pointerup happens elsewhere
    setDragging(false);
  }, [dragging, physics, currentlyDraggingRef]);

  // Release drag even if pointer is released off-card
  useEffect(() => {
    const onWindowPointerUp = () => handlePointerUp();
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => window.removeEventListener('pointerup', onWindowPointerUp);
  }, [handlePointerUp]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const time = state.clock.elapsedTime;
    // Ensure minimum dt of 0.016 (~60fps) to prevent zero-dt frames
    const dt = Math.max(Math.min(state.clock.getDelta(), 0.1), 0.016);
    const cardMass = mass;

    if (dragging) {
      // Update drag position
      raycaster.setFromCamera(pointer, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectPoint);

      const newPosition = intersectPoint.add(dragOffset.current);

      // Keep dragged card from overlapping others by nudging away
      allPhysics.current.forEach((otherPhysics, otherIndex) => {
        if (otherIndex === index) return;
        const direction = new THREE.Vector3().copy(newPosition).sub(otherPhysics.position);
        const distance = direction.length();
        if (distance < REPULSION_DISTANCE * 0.9 && distance > 0.05) {
          const force = DRAG_REPULSION_STRENGTH / Math.max(distance * distance, 0.01);
          direction.normalize().multiplyScalar(force);
          newPosition.add(direction.multiplyScalar(dt * 20)); // immediate nudge
        }
      });

      // Calculate drag velocity for throw
      const velocity = new THREE.Vector3().copy(newPosition).sub(lastDragPosition.current);
      dragVelocity.current.copy(velocity).divideScalar(dt);

      // Track if there was significant movement
      if (velocity.length() > 0.01) {
        hasDragged.current = true;
      }

      lastDragPosition.current.copy(newPosition);

      physics.current.position.copy(newPosition);
      group.position.copy(newPosition);
    } else {
      // Reset acceleration
      physics.current.acceleration.set(0, 0, 0);
      
      // Reset diagnostic data for this frame
      physics.current.diag.curveForce = 0;
      physics.current.diag.repulsionForce = 0;
      physics.current.diag.cohesionForce = 0;

      // === SPACE CURVE ATTRACTION (Primary movement pattern) ===
      // Update position along the curve - PHASE MODULATED
      const phaseSpeedMult = phaseStateRef.current.velocityMultiplier;
      physics.current.curveT += physics.current.curveTVelocity * dt * phaseSpeedMult;
      if (physics.current.curveT > 1) physics.current.curveT -= 1;
      if (physics.current.curveT < 0) physics.current.curveT += 1;

      // Get target position on the curve (always blend for smooth transitions)
      const curveState = curveStateRef.current;
      const curveTargetPos = blendCurves(
        physics.current.curveT,
        time,
        curveState.currentCurve,
        curveState.nextCurve,
        curveState.transitionProgress  // 0 = fully currentCurve, 1 = fully nextCurve
      );
      
      // Store curve target for diagnostics
      physics.current.diag.curveTarget.copy(curveTargetPos);

      // Calculate attraction force toward the curve - PHASE MODULATED
      const toCurve = curveTargetPos.clone().sub(physics.current.position);
      const distToCurve = toCurve.length();
      physics.current.diag.distToCurve = distToCurve;
      if (distToCurve > 0.1) {
        // Stronger attraction when far from curve, gentler when close
        // Phase multiplier makes cards snap to curve faster during fast phase
        const attractionFactor = Math.min(distToCurve * 0.5, 1.5);
        const curveForce = toCurve.normalize().multiplyScalar(
          CURVE_ATTRACTION_STRENGTH * attractionFactor * phaseSpeedMult / cardMass
        );
        physics.current.diag.curveForce = curveForce.length();
        physics.current.acceleration.add(curveForce);
      }

      // Flow field drift scaled by restlessness (micro-perturbations)
      const flowForce = flowField(physics.current.position, time, physics.current.restlessness);
      physics.current.acceleration.add(flowForce.divideScalar(cardMass));

      // Card-to-card repulsion (magnetic field)
      allPhysics.current.forEach((otherPhysics, otherIndex) => {
        if (otherIndex === index) return;

        const direction = new THREE.Vector3()
          .copy(physics.current.position)
          .sub(otherPhysics.position);

        const distance = direction.length();

        if (distance < REPULSION_DISTANCE && distance > 0.1) {
          const force = (REPULSION_STRENGTH / (distance * distance)) / cardMass;
          direction.normalize().multiplyScalar(force);
          physics.current.diag.repulsionForce += direction.length();
          physics.current.acceleration.add(direction);
        }
      });

      // Flocking: alignment + cohesion
      let avgVelocity = new THREE.Vector3();
      let avgPosition = new THREE.Vector3();
      let neighborCount = 0;

      allPhysics.current.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        const dist = physics.current.position.distanceTo(other.position);
        if (dist < FLOCK_RADIUS && dist > 0.5) {
          avgVelocity.add(other.velocity);
          avgPosition.add(other.position);
          neighborCount++;
        }
      });

      if (neighborCount > 0) {
        avgVelocity.divideScalar(neighborCount);
        avgPosition.divideScalar(neighborCount);

        const alignment = avgVelocity
          .clone()
          .sub(physics.current.velocity)
          .multiplyScalar(ALIGNMENT_STRENGTH / physics.current.mass);

        const cohesion = avgPosition
          .clone()
          .sub(physics.current.position)
          .multiplyScalar(COHESION_STRENGTH / physics.current.mass);

        physics.current.diag.cohesionForce = cohesion.length();
        physics.current.acceleration.add(alignment).add(cohesion);
      }

      // Cursor interaction varies by personality
      const cursorWorldPos = new THREE.Vector3(pointer.x * 10, pointer.y * 10, 0);
      const cursorDirection = physics.current.position.clone().sub(cursorWorldPos);
      const cursorDistance = cursorDirection.length();
      if (cursorDistance < CURSOR_INTERACTION_DISTANCE && cursorDistance > 0.1) {
        cursorDirection.normalize();
        const baseForce = 1.2 / (cursorDistance * cursorDistance);
        const personalityForce =
          personality === 'shy' ? 1.5 :
          personality === 'curious' ? -0.4 :
          0.6;
        const finalForce = (baseForce * personalityForce) / cardMass;
        physics.current.acceleration.add(
          cursorDirection.multiplyScalar(finalForce)
        );
      }

      // Center attraction (keeps cards from escaping)
      const distanceFromCenter = physics.current.position.length();
      if (distanceFromCenter > CENTER_ATTRACTION_DISTANCE) {
        const centerDirection = physics.current.position.clone().negate().normalize();
        const pullStrength = CENTER_ATTRACTION * (distanceFromCenter / CENTER_ATTRACTION_DISTANCE);
        centerDirection.multiplyScalar(pullStrength / cardMass);
        physics.current.acceleration.add(centerDirection);
      }

      // Ambient current force
      const currentForce = currentRef.current.direction.clone().multiplyScalar(currentRef.current.strength / cardMass);
      physics.current.acceleration.add(currentForce);

      // Boundary forces (keep cards in view)
      const boundaryForce = new THREE.Vector3();

      if (Math.abs(physics.current.position.x) > BOUNDARY_DISTANCE) {
        boundaryForce.x = -Math.sign(physics.current.position.x) * BOUNDARY_FORCE;
      }
      if (Math.abs(physics.current.position.y) > BOUNDARY_DISTANCE) {
        boundaryForce.y = -Math.sign(physics.current.position.y) * BOUNDARY_FORCE;
      }
      if (Math.abs(physics.current.position.z) > BOUNDARY_DISTANCE) {
        boundaryForce.z = -Math.sign(physics.current.position.z) * BOUNDARY_FORCE;
      }

      physics.current.acceleration.add(boundaryForce.divideScalar(cardMass));

      // Update velocity (mass-aware)
      physics.current.velocity.add(
        physics.current.acceleration.clone().multiplyScalar(dt / cardMass)
      );

      // Apply damping - phase-aware: less damping during fast phase to allow velocity buildup
      // Fast phase (mult=5): damping ≈ 0.996 (less drag, more momentum)
      // Slow phase (mult=0.5): damping ≈ 0.988 (more drag for graceful slowdown)
      const phaseDampingFactor = phaseSpeedMult > 1 ? 0.996 : 0.988;
      const massDampingAdjust = (cardMass - 1) * 0.001; // Heavier cards retain slightly more
      const effectiveDamping = Math.min(phaseDampingFactor + massDampingAdjust, 0.998);
      physics.current.velocity.multiplyScalar(effectiveDamping);

      // Limit velocity (phase-modulated, mass-adjusted)
      const massVelocityFactor = 1.2 - (cardMass * 0.15);
      const effectiveMaxVelocity = MAX_VELOCITY * phaseStateRef.current.velocityMultiplier * massVelocityFactor;
      if (physics.current.velocity.length() > effectiveMaxVelocity) {
        physics.current.velocity.normalize().multiplyScalar(effectiveMaxVelocity);
      }

      // Update position
      physics.current.position.add(
        physics.current.velocity.clone().multiplyScalar(dt * 60 * MOTION_SCALE)
      );

      // Apply to group
      group.position.copy(physics.current.position);

      // Trail sampling - more points during fast phase
      lastTrailSampleRef.current += dt;
      const trailSampleRate = phaseSpeedMult > 1 ? 0.02 : 0.05; // Sample faster during fast phase
      const maxTrailLength = phaseSpeedMult > 1 ? 20 : 8; // Longer trails during fast phase
      if (lastTrailSampleRef.current > trailSampleRate) {
        lastTrailSampleRef.current = 0;
        trailRef.current.push(physics.current.position.clone());
        if (trailRef.current.length > maxTrailLength) {
          trailRef.current.shift();
        }
      }
    }

    // Multi-axis rotation
    group.rotation.x += angularVelocity.x * dt * MOTION_SCALE;
    group.rotation.y += angularVelocity.y * dt * MOTION_SCALE;
    group.rotation.z += angularVelocity.z * dt * MOTION_SCALE;

    // Attention: orient toward cursor (or away if shy)
    const cursorWorldPos = new THREE.Vector3(pointer.x * 10, pointer.y * 10, 0);
    const toCursor = cursorWorldPos.clone().sub(physics.current.position);
    const cursorDist = toCursor.length();
    if (cursorDist < ATTENTION_DISTANCE && cursorDist > 0.5) {
      const attentionFactor = 1 - (cursorDist / ATTENTION_DISTANCE);
      const personalityMod =
        personality === 'curious' ? 1.0 :
        personality === 'shy' ? -0.3 :
        0.2;
      const targetRotY = Math.atan2(toCursor.x, 5);
      const targetRotX = Math.atan2(-toCursor.y, 5) * 0.3;
      const strength = ATTENTION_STRENGTH * attentionFactor * personalityMod;
      group.rotation.y += (targetRotY - group.rotation.y) * strength;
      group.rotation.x += (targetRotX - group.rotation.x) * strength * 0.5;
    }

    // Breathing / hover scale
    if (!hovered && !dragging) {
      physics.current.breathPhase += dt * BREATH_SPEED;
      if (physics.current.breathPhase > Math.PI * 2) physics.current.breathPhase -= Math.PI * 2;
      const breathScale = 1 + Math.sin(physics.current.breathPhase) * BREATH_AMPLITUDE;
      group.scale.lerp(new THREE.Vector3(breathScale, breathScale, breathScale), 0.1);
    } else if (hovered && !dragging) {
      group.scale.lerp(new THREE.Vector3(1.25, 1.25, 1.25), 0.1);
    } else if (dragging) {
      group.scale.lerp(new THREE.Vector3(1.35, 1.35, 1.35), 0.12);
    }
  });

  // Get the card name based on selected deck type
  const getCardName = () => {
    const deckType = settings.selectedDeckType;
    if (deckType === 'lord-of-mysteries-masterpiece') {
      return (card.lordOfMysteriesMasterpiece && card.lordOfMysteriesMasterpiece.pathway) || card.traditional.name;
    }
    if (deckType === 'lord-of-mysteries') return card.lordOfMysteries.pathway || card.traditional.name;
    if (deckType === 'traditional-rider-waite') return card.traditional.name;
    if (deckType === 'egyptian-tarot') return card.egyptian.deity || card.traditional.name;
    if (deckType === 'celtic-tarot') return card.celtic.figure || card.traditional.name;
    if (deckType === 'japanese-shinto') return card.shinto.kami || card.traditional.name;
    if (deckType === 'advaita-vedanta') return card.advaita.name || card.traditional.name;
    return card.traditional.name;
  };

  // Get a keyword
  const getKeyword = () => {
    const deckType = settings.selectedDeckType;
    let keywords: string[] = [];

    if (deckType === 'lord-of-mysteries-masterpiece') keywords = card.lordOfMysteriesMasterpiece?.keywords || card.lordOfMysteries.keywords;
    else if (deckType === 'lord-of-mysteries') keywords = card.lordOfMysteries.keywords;
    else if (deckType === 'traditional-rider-waite') keywords = card.traditional.keywords;
    else if (deckType === 'egyptian-tarot') keywords = card.egyptian.keywords;
    else if (deckType === 'celtic-tarot') keywords = card.celtic.keywords;
    else if (deckType === 'japanese-shinto') keywords = card.shinto.keywords;
    else if (deckType === 'advaita-vedanta') keywords = card.advaita.keywords;

    return keywords[Math.floor(Math.random() * keywords.length)] || 'mystery';
  };

  return (
    <group
      ref={groupRef}
      position={initialPosition}
      rotation={initialRotation}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        // Only trigger card selection if there was no dragging movement
        if (!hasDragged.current) {
          e.stopPropagation();
          setSelectedCard(card);
        }
      }}
    >
      {/* Glow outline */}
      <mesh
        scale={[1.05, 1.05, 0.07]}
        position={[0, 0, 0]}
      >
        <boxGeometry args={[0.8, 1.2, 0.05]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={hovered || dragging ? '#ffffff' : isInjected ? '#ff8a50' : '#ffffff'}
          emissiveIntensity={hovered ? 1.0 : dragging ? 1.1 : isInjected ? 1.2 : 0.5}
          transparent
          opacity={hovered || dragging ? 0.5 : 0.35}
          metalness={0.8}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        {/* Card body */}
        <boxGeometry args={[0.8, 1.2, 0.05]} />
        <meshStandardMaterial
          map={cardBackTexture}
          color={dragging ? '#ffffff' : hovered ? '#dddddd' : '#ffffff'}
          emissive={
            dragging ? '#7c3aed' :
            hovered ? '#9333ea' :
            isInjected ? '#ff6b35' :
            '#000000'
          }
          emissiveIntensity={
            dragging ? 0.8 :
            hovered ? 0.5 :
            isInjected ? 0.9 :
            0
          }
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Card number or symbol */}
      {showInfo && (
        <Text
          position={[0, 0.5, 0.03]}
            fontSize={settings.showCardNumbers !== false ? 0.15 : 0.13}
            color={settings.showCardNumbers !== false ? "#d4af37" : "#ffffff"}
          anchorX="center"
          anchorY="middle"
        >
          {settings.showCardNumbers !== false ? (card.number === 0 ? '0' : card.number) : '☆'}
        </Text>
      )}

      {/* Card name (shown on hover) */}
      {(hovered || dragging) && showInfo && (
        <>
          <Text
            position={[0, 0, 0.03]}
            fontSize={0.08}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.7}
          >
            {getCardName()}
          </Text>

          {/* Whispered keyword */}
          <Text
            position={[0, -0.4, 0.03]}
            fontSize={0.06}
            color="#9333ea"
            anchorX="center"
            anchorY="middle"
          >
            "{getKeyword()}"
          </Text>
        </>
      )}

      {/* Trail disabled - was distracting floating meshes
      {trailRef.current.map((pos, i) => {
        const trailLength = trailRef.current.length;
        const normalizedIndex = i / Math.max(trailLength - 1, 1); // 0 to 1
        const baseOpacity = 0.15; // Much more visible
        const opacity = baseOpacity * normalizedIndex * normalizedIndex; // Quadratic fade
        return (
          <mesh key={i} position={pos} scale={[0.2, 0.3, 0.01]}>
            <planeGeometry />
            <meshBasicMaterial color="#9333ea" transparent opacity={opacity} />
          </mesh>
        );
      })}
      */}
    </group>
  );
}

export default function CardDeck() {
  const cards = tarotData.cards as TarotCard[];
  const currentlyDraggingRef = useRef<number | null>(null); // Track which card is being dragged

  // === DIAGNOSTIC DATA COLLECTION ===
  // Logs physics data for analysis. Press 'D' to download as JSON.
  interface DiagnosticFrame {
    t: number;  // time
    phase: string;
    mult: number;  // velocity multiplier
    curve: string;  // current curve type
    cards: Array<{
      i: number;  // index
      pos: [number, number, number];
      vel: [number, number, number];
      acc: [number, number, number];
      curveT: number;
      curveTarget: [number, number, number];
      distToCurve: number;
    }>;
  }
  const diagnosticDataRef = useRef<DiagnosticFrame[]>([]);
  const diagnosticEnabledRef = useRef(true);  // Set to false to disable
  const lastDiagnosticTimeRef = useRef(0);
  const DIAGNOSTIC_INTERVAL = 0.1;  // Log every 100ms
  const MAX_DIAGNOSTIC_FRAMES = 600;  // 60 seconds of data
  
  // Download diagnostic data as JSON
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        const data = diagnosticDataRef.current;
        if (data.length === 0) {
          console.log('[Diagnostic] No data collected yet');
          return;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `card-physics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`[Diagnostic] Downloaded ${data.length} frames`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Phase cycling state (continuous, no re-renders)
  const phaseStateRef = useRef({
    elapsedTime: 0,           // 0-20s cycle counter
    currentPhase: 'fast' as 'fast' | 'slow',
    velocityMultiplier: 1.0,  // Interpolates 1.0 ↔ 0.5
    transitionProgress: 1.0,  // 0-1 during fade
  });

  // Injection timing state
  const injectionStateRef = useRef({
    timeSinceLastInjection: 0,  // 0-60s counter
  });

  const currentRef = useRef({
    direction: new THREE.Vector3(1, 0.3, 0).normalize(),
    strength: 0,
    targetStrength: 0,
    changeTimer: 0,
  });

  // Space curve state - tracks which curve cards are following
  const curveStateRef = useRef({
    currentCurve: CURVE_SEQUENCE[0] as CurveType,
    nextCurve: CURVE_SEQUENCE[1] as CurveType,
    transitionProgress: 1, // 0-1, 1 = fully on currentCurve
    cycleTime: 0,
    curveIndex: 0,
  });

  // Injection visual feedback (discrete events, triggers re-renders)
  const [injectedCardIndices, setInjectedCardIndices] = useState<Set<number>>(new Set());

  const getMass = (card: TarotCard): number => {
    if (card.number === 0) return 2.2;
    if (card.number <= 21) return 1.6;
    return 0.9 + Math.random() * 0.2;
  };

  const getPersonality = (card: TarotCard): 'shy' | 'neutral' | 'curious' => {
    const hash = (card.number * 7 + 3) % 3;
    return hash === 0 ? 'shy' : hash === 1 ? 'neutral' : 'curious';
  };

  // Initialize physics for all cards
  const allPhysicsRef = useRef<CardPhysics[]>(
    cards.map((card, index) => {
      const angle = (index / cards.length) * Math.PI * 4;
      const radius = 2 + (index % 3) * 1.5;

      const initialPos = new THREE.Vector3(
        Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
        Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 3
      );

      // Distribute cards evenly along the curve parameter space
      const curveT = index / cards.length;
      // Vary velocity slightly so cards spread out over time
      const curveTVelocity = 0.015 + (Math.random() - 0.5) * 0.008;
      
      return {
        position: initialPos.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.1
        ),
        acceleration: new THREE.Vector3(),
        targetPosition: initialPos.clone(),
        mass: getMass(card),
        personality: getPersonality(card),
        breathPhase: (index / cards.length) * Math.PI * 2,
        awarenessTarget: null,
        restlessness: 0.3 + Math.random() * 0.4,
        lastImpulseTime: 0,
        curveT,
        curveTVelocity,
        diag: {
          curveTarget: new THREE.Vector3(),
          distToCurve: 0,
          curveForce: 0,
          repulsionForce: 0,
          cohesionForce: 0,
        },
      };
    })
  );

  // Generate card positions and rotations
  const cardData = useMemo(() => {
    return cards.map((_, index) => {
      const angle = (index / cards.length) * Math.PI * 4;
      const radius = 2 + (index % 3) * 1.5;

      return {
        position: [
          Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
          Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 3,
        ] as [number, number, number],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ] as [number, number, number],
      };
    });
  }, []);

  // Create individual refs for each card's physics
  const physicsRefs = useRef(
    cards.map((_, index) => ({
      current: allPhysicsRef.current[index],
    }))
  );

  // Phase cycling logic
  useFrame((_state, dt) => {
    const phaseRef = phaseStateRef.current;
    phaseRef.elapsedTime += dt;

    // 30-second cycle: 0-10s fast, 10-30s slow (slow is 2× longer)
    if (phaseRef.elapsedTime >= 30) {
      phaseRef.elapsedTime = 0;
    }

    const targetPhase = phaseRef.elapsedTime < 10 ? 'fast' : 'slow';
    const targetMultiplier = targetPhase === 'fast' ? 5.0 : 0.5;

    // Detect phase change
    if (phaseRef.currentPhase !== targetPhase) {
      console.log(`[Animation] Phase change: ${phaseRef.currentPhase} → ${targetPhase} at ${phaseRef.elapsedTime.toFixed(2)}s, multiplier: ${phaseRef.velocityMultiplier.toFixed(2)} → ${targetMultiplier}`);
      phaseRef.currentPhase = targetPhase;
      phaseRef.transitionProgress = 0; // Start 1.5s fade
    }

    // Smooth interpolation (smoothstep easing)
    if (phaseRef.transitionProgress < 1.0) {
      phaseRef.transitionProgress = Math.min(1.0, phaseRef.transitionProgress + dt / 1.5);
      const t = phaseRef.transitionProgress;
      const smoothT = t * t * (3 - 2 * t); // smoothstep function
      phaseRef.velocityMultiplier = THREE.MathUtils.lerp(
        phaseRef.velocityMultiplier,
        targetMultiplier,
        smoothT
      );
    } else {
      phaseRef.velocityMultiplier = targetMultiplier;
    }

    // Ambient current modulation
    currentRef.current.changeTimer += dt;
    if (currentRef.current.changeTimer > 8 + Math.random() * 7) {
      currentRef.current.changeTimer = 0;
      currentRef.current.targetStrength = Math.random() < 0.3 ? 0 : 0.15 + Math.random() * 0.2;
      currentRef.current.direction = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        (Math.random() - 0.5) * 0.3
      ).normalize();
    }
    currentRef.current.strength += (currentRef.current.targetStrength - currentRef.current.strength) * dt * 0.5;

    // Debug: Log average velocity every 2 seconds
    if (Math.floor(phaseRef.elapsedTime) % 2 === 0 && phaseRef.elapsedTime - Math.floor(phaseRef.elapsedTime) < dt * 2) {
      const avgVel = allPhysicsRef.current.reduce((sum, p) => sum + p.velocity.length(), 0) / allPhysicsRef.current.length;
      console.log(`[Debug] Phase: ${phaseRef.currentPhase}, Multiplier: ${phaseRef.velocityMultiplier.toFixed(2)}, Avg velocity: ${avgVel.toFixed(4)}`);
    }

    // === DIAGNOSTIC DATA COLLECTION ===
    const currentTime = _state.clock.elapsedTime;
    if (diagnosticEnabledRef.current && currentTime - lastDiagnosticTimeRef.current >= DIAGNOSTIC_INTERVAL) {
      lastDiagnosticTimeRef.current = currentTime;
      
      // Sample only first 5 cards to keep data manageable
      const sampledCards = allPhysicsRef.current.slice(0, 5).map((p, i) => {
        const curveTarget = blendCurves(
          p.curveT,
          currentTime,
          curveStateRef.current.currentCurve,
          curveStateRef.current.nextCurve,
          curveStateRef.current.transitionProgress
        );
        return {
          i,
          pos: [p.position.x, p.position.y, p.position.z] as [number, number, number],
          vel: [p.velocity.x, p.velocity.y, p.velocity.z] as [number, number, number],
          acc: [p.acceleration.x, p.acceleration.y, p.acceleration.z] as [number, number, number],
          curveT: p.curveT,
          curveTarget: [curveTarget.x, curveTarget.y, curveTarget.z] as [number, number, number],
          distToCurve: p.position.distanceTo(curveTarget),
        };
      });
      
      diagnosticDataRef.current.push({
        t: currentTime,
        phase: phaseRef.currentPhase,
        mult: phaseRef.velocityMultiplier,
        curve: curveStateRef.current.currentCurve,
        cards: sampledCards,
      });
      
      // Keep bounded
      if (diagnosticDataRef.current.length > MAX_DIAGNOSTIC_FRAMES) {
        diagnosticDataRef.current.shift();
      }
    }

    // === SPACE CURVE CYCLING ===
    // Logic: Stay on currentCurve for CYCLE_DURATION, then blend to nextCurve over TRANSITION_DURATION
    const cState = curveStateRef.current;
    cState.cycleTime += dt;

    const totalCycleTime = CURVE_CYCLE_DURATION + CURVE_TRANSITION_DURATION;

    // Check if full cycle (stay + transition) is complete
    if (cState.cycleTime >= totalCycleTime) {
      // Transition complete, swap curves
      cState.cycleTime = 0;
      cState.curveIndex = (cState.curveIndex + 1) % CURVE_SEQUENCE.length;
      cState.currentCurve = cState.nextCurve;
      cState.nextCurve = CURVE_SEQUENCE[(cState.curveIndex + 1) % CURVE_SEQUENCE.length];
      console.log(`[Curve] Now on: ${cState.currentCurve}, next: ${cState.nextCurve}`);
    }

    // Calculate blend factor: 0 during stay phase, 0→1 during transition
    if (cState.cycleTime < CURVE_CYCLE_DURATION) {
      cState.transitionProgress = 0; // Stay on currentCurve
    } else {
      // Transitioning: progress from 0 to 1 over TRANSITION_DURATION
      cState.transitionProgress = Math.min(1, 
        (cState.cycleTime - CURVE_CYCLE_DURATION) / CURVE_TRANSITION_DURATION
      );
    }

    // Velocity injection every INJECTION_INTERVAL seconds
    const INJECTION_INTERVAL = 45;
    const INJECTION_COUNT = 8;
    const INJECTION_MAGNITUDE_MIN = 0.25;
    const INJECTION_MAGNITUDE_MAX = 0.45;
    const injRef = injectionStateRef.current;
    injRef.timeSinceLastInjection += dt;

    if (injRef.timeSinceLastInjection >= INJECTION_INTERVAL) {
      injRef.timeSinceLastInjection = 0;

      // Select random cards (no duplicates)
      const totalCards = allPhysicsRef.current.length; // 78
      const selectedIndices = new Set<number>();
      while (selectedIndices.size < INJECTION_COUNT) {
        selectedIndices.add(Math.floor(Math.random() * totalCards));
      }

      // Apply strong random impulses
      selectedIndices.forEach(index => {
        const physics = allPhysicsRef.current[index];

        const magnitude = INJECTION_MAGNITUDE_MIN + Math.random() * (INJECTION_MAGNITUDE_MAX - INJECTION_MAGNITUDE_MIN);
        const direction = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();

        const impulse = direction.multiplyScalar(magnitude);
        physics.velocity.add(impulse); // Additive to existing velocity
      });

      // Trigger visual feedback (causes re-render of 10 cards)
      setInjectedCardIndices(selectedIndices);

      // Clear glow after 500ms
      setTimeout(() => setInjectedCardIndices(new Set()), 500);
    }
  });

  return (
    <group>
      {cards.map((card, index) => (
        <Card
          key={card.number}
          card={card}
          initialPosition={cardData[index].position}
          initialRotation={cardData[index].rotation}
          index={index}
          physics={physicsRefs.current[index]}
          allPhysics={allPhysicsRef}
          currentlyDraggingRef={currentlyDraggingRef}
          phaseStateRef={phaseStateRef}
          curveStateRef={curveStateRef}
          isInjected={injectedCardIndices.has(index)}
          currentRef={currentRef}
          mass={allPhysicsRef.current[index].mass}
          personality={allPhysicsRef.current[index].personality}
        />
      ))}
    </group>
  );
}
