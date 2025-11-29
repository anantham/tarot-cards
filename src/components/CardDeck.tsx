import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useCursor } from '@react-three/drei';
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
  isInjected: boolean;
}

function Card({ card, initialPosition, initialRotation, index, physics, allPhysics, currentlyDraggingRef, phaseStateRef, isInjected }: CardProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { setSelectedCard, settings } = useStore();
  const showInfo = settings.showCardInfo !== false;
  const { camera, pointer, raycaster } = useThree();

  // Change cursor to grab hand when hovering, grabbing hand when dragging
  useCursor(hovered && !dragging, 'grab');
  useCursor(dragging, 'grabbing');

  const dragOffset = useRef(new THREE.Vector3());
  const lastDragPosition = useRef(new THREE.Vector3());
  const dragVelocity = useRef(new THREE.Vector3());
  const hasDragged = useRef(false); // Track if user actually moved the card

  // Physics constants
  const REPULSION_STRENGTH = 6.0;
  const REPULSION_DISTANCE = 4.0;
  const CURSOR_REPULSION_STRENGTH = 1.0;
  const CURSOR_REPULSION_DISTANCE = 3.0;
  const CENTER_ATTRACTION = 0.05; // stronger pull toward origin
  const CENTER_ATTRACTION_DISTANCE = 5.0; // Start pulling when farther than this
  const DAMPING = 0.965;
  const MAX_VELOCITY = 0.45;
  const BOUNDARY_FORCE = 0.5;
  const BOUNDARY_DISTANCE = 9;
  const ORBITAL_SPIN = 0.25;
  const DRAG_REPULSION_STRENGTH = 3.5;

  // Random drift parameters
  const driftParams = useMemo(() => ({
    speed: 0.35 + Math.random() * 0.4,
    xOffset: Math.random() * Math.PI * 2,
    yOffset: Math.random() * Math.PI * 2,
    zOffset: Math.random() * Math.PI * 2,
    xAmplitude: 0.25 + Math.random() * 0.3,
    yAmplitude: 0.2 + Math.random() * 0.25,
    zAmplitude: 0.1 + Math.random() * 0.2,
    rotSpeed: 0.35 + Math.random() * 0.4,
  }), []);

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

      // Random trajectory drift
      const driftX = Math.sin(time * driftParams.speed + driftParams.xOffset) * driftParams.xAmplitude * 0.01;
      const driftY = Math.cos(time * driftParams.speed + driftParams.yOffset) * driftParams.yAmplitude * 0.01;
      const driftZ = Math.sin(time * driftParams.speed * 0.5 + driftParams.zOffset) * driftParams.zAmplitude * 0.01;
      physics.current.acceleration.add(new THREE.Vector3(driftX, driftY, driftZ));

      // Card-to-card repulsion (magnetic field)
      allPhysics.current.forEach((otherPhysics, otherIndex) => {
        if (otherIndex === index) return;

        const direction = new THREE.Vector3()
          .copy(physics.current.position)
          .sub(otherPhysics.position);

        const distance = direction.length();

        if (distance < REPULSION_DISTANCE && distance > 0.1) {
          const force = REPULSION_STRENGTH / (distance * distance);
          direction.normalize().multiplyScalar(force);
          physics.current.acceleration.add(direction);
        }
      });

      // Cursor repulsion
      const cursorWorldPos = new THREE.Vector3(pointer.x * 10, pointer.y * 10, 0);
      const cursorDirection = new THREE.Vector3()
        .copy(physics.current.position)
        .sub(cursorWorldPos);

      const cursorDistance = cursorDirection.length();
      if (cursorDistance < CURSOR_REPULSION_DISTANCE && cursorDistance > 0.1) {
        const cursorForce = CURSOR_REPULSION_STRENGTH / (cursorDistance * cursorDistance);
        cursorDirection.normalize().multiplyScalar(cursorForce);
        physics.current.acceleration.add(cursorDirection);
      }

      // Center attraction (keeps cards from escaping)
      const distanceFromCenter = physics.current.position.length();
      if (distanceFromCenter > CENTER_ATTRACTION_DISTANCE) {
        const centerDirection = new THREE.Vector3()
          .copy(physics.current.position)
          .negate()
          .normalize();

        // Stronger pull the farther from center
        const pullStrength = CENTER_ATTRACTION * (distanceFromCenter / CENTER_ATTRACTION_DISTANCE);
        centerDirection.multiplyScalar(pullStrength);
        physics.current.acceleration.add(centerDirection);
      }

      // Orbital swirl around origin for constant motion
      const tangential = new THREE.Vector3(
        -physics.current.position.y,
        physics.current.position.x,
        0
      ).normalize().multiplyScalar(ORBITAL_SPIN);
      physics.current.acceleration.add(tangential);

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

      physics.current.acceleration.add(boundaryForce);

      // Update velocity
      physics.current.velocity.add(
        physics.current.acceleration.multiplyScalar(dt)
      );

      // Apply damping
      physics.current.velocity.multiplyScalar(DAMPING);

      // Limit velocity (phase-modulated)
      const effectiveMaxVelocity = MAX_VELOCITY * phaseStateRef.current.velocityMultiplier;
      if (physics.current.velocity.length() > effectiveMaxVelocity) {
        physics.current.velocity.normalize().multiplyScalar(effectiveMaxVelocity);
      }

      // Update position
      physics.current.position.add(
        physics.current.velocity.clone().multiplyScalar(dt * 60)
      );

      // Apply to group
      group.position.copy(physics.current.position);
    }

    // Multi-axis rotation with a bit of wobble
    group.rotation.x += angularVelocity.x * dt;
    group.rotation.y += angularVelocity.y * dt;
    group.rotation.z += angularVelocity.z * dt;
    group.rotation.x += Math.sin(time * driftParams.rotSpeed) * 0.02;
    group.rotation.y += Math.cos(time * driftParams.rotSpeed * 0.8) * 0.02;
    group.rotation.z += Math.sin(time * driftParams.rotSpeed * 0.6) * 0.015;

    // Hover effect - scale up and emit light
    if (hovered && !dragging) {
      group.scale.lerp(new THREE.Vector3(1.3, 1.3, 1.3), 0.1);
    } else if (dragging) {
      group.scale.lerp(new THREE.Vector3(1.4, 1.4, 1.4), 0.15);
    } else {
      group.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
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
      <mesh>
        {/* Card body */}
        <boxGeometry args={[0.8, 1.2, 0.05]} />
        <meshStandardMaterial
          color={dragging ? '#7c3aed' : hovered ? '#9333ea' : '#1a1a2e'}
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

      {/* Card number */}
      {showInfo && (
        <Text
          position={[0, 0.5, 0.03]}
          fontSize={0.15}
          color="#d4af37"
          anchorX="center"
          anchorY="middle"
        >
          {card.number === 0 ? '0' : card.number}
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
    </group>
  );
}

export default function CardDeck() {
  const cards = tarotData.cards as TarotCard[];
  const currentlyDraggingRef = useRef<number | null>(null); // Track which card is being dragged

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

  // Injection visual feedback (discrete events, triggers re-renders)
  const [injectedCardIndices, setInjectedCardIndices] = useState<Set<number>>(new Set());

  // Initialize physics for all cards
  const allPhysicsRef = useRef<CardPhysics[]>(
    cards.map((_, index) => {
      const angle = (index / cards.length) * Math.PI * 4;
      const radius = 2 + (index % 3) * 1.5;

      const initialPos = new THREE.Vector3(
        Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
        Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 3
      );

      return {
        position: initialPos.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.2
        ),
        acceleration: new THREE.Vector3(),
        targetPosition: initialPos.clone(),
        mass: 1.0,
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

    // 20-second cycle: 0-10s fast, 10-20s slow
    if (phaseRef.elapsedTime >= 20) {
      phaseRef.elapsedTime = 0;
    }

    const targetPhase = phaseRef.elapsedTime < 10 ? 'fast' : 'slow';
    const targetMultiplier = targetPhase === 'fast' ? 1.0 : 0.5;

    // Detect phase change
    if (phaseRef.currentPhase !== targetPhase) {
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

    // Velocity injection every 60 seconds
    const injRef = injectionStateRef.current;
    injRef.timeSinceLastInjection += dt;

    if (injRef.timeSinceLastInjection >= 60) {
      injRef.timeSinceLastInjection = 0;

      // Select 10 random cards (no duplicates)
      const totalCards = allPhysicsRef.current.length; // 78
      const selectedIndices = new Set<number>();
      while (selectedIndices.size < 10) {
        selectedIndices.add(Math.floor(Math.random() * totalCards));
      }

      // Apply strong random impulses
      selectedIndices.forEach(index => {
        const physics = allPhysicsRef.current[index];

        // Random direction + magnitude (0.3-0.5)
        const magnitude = 0.3 + Math.random() * 0.2;
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
          isInjected={injectedCardIndices.has(index)}
        />
      ))}
    </group>
  );
}
