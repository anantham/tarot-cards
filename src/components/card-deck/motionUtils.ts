import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { blendCurves, flowField } from './curves';
import type { CardPhysics, CurveState } from './types';

const MOTION_SCALE = 0.5;
const MAX_VELOCITY = 1.0;
const REPULSION_STRENGTH = 5.0;
const REPULSION_DISTANCE = 3.5;
const CURSOR_INTERACTION_DISTANCE = 4.0;
const CENTER_ATTRACTION = 0.02;
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
const CURVE_ATTRACTION_STRENGTH = 0.6;

type DraggingMotionArgs = {
  dt: number;
  pointer: THREE.Vector2;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  index: number;
  dragOffset: THREE.Vector3;
  lastDragPositionRef: MutableRefObject<THREE.Vector3>;
  dragVelocityRef: MutableRefObject<THREE.Vector3>;
  hasDraggedRef: MutableRefObject<boolean>;
  physics: CardPhysics;
  allPhysics: CardPhysics[];
};

export function updateDraggingMotion({
  dt,
  pointer,
  camera,
  raycaster,
  index,
  dragOffset,
  lastDragPositionRef,
  dragVelocityRef,
  hasDraggedRef,
  physics,
  allPhysics,
}: DraggingMotionArgs): void {
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersectPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersectPoint);

  const newPosition = intersectPoint.add(dragOffset);
  allPhysics.forEach((otherPhysics, otherIndex) => {
    if (otherIndex === index) return;
    const direction = new THREE.Vector3().copy(newPosition).sub(otherPhysics.position);
    const distance = direction.length();
    if (distance < REPULSION_DISTANCE * 0.9 && distance > 0.05) {
      const force = DRAG_REPULSION_STRENGTH / Math.max(distance * distance, 0.01);
      direction.normalize().multiplyScalar(force);
      newPosition.add(direction.multiplyScalar(dt * 20));
    }
  });

  const velocity = new THREE.Vector3().copy(newPosition).sub(lastDragPositionRef.current);
  dragVelocityRef.current.copy(velocity).divideScalar(dt);
  if (velocity.length() > 0.01) {
    hasDraggedRef.current = true;
  }

  lastDragPositionRef.current.copy(newPosition);
  physics.position.copy(newPosition);
}

type FreeMotionArgs = {
  group: THREE.Group;
  time: number;
  dt: number;
  pointer: THREE.Vector2;
  index: number;
  cardMass: number;
  personality: 'shy' | 'neutral' | 'curious';
  phaseVelocityMultiplier: number;
  curveState: Pick<CurveState, 'currentCurve' | 'nextCurve' | 'transitionProgress'>;
  currentDirection: THREE.Vector3;
  currentStrength: number;
  physics: CardPhysics;
  allPhysics: CardPhysics[];
  trailRef: MutableRefObject<THREE.Vector3[]>;
  lastTrailSampleRef: MutableRefObject<number>;
};

export function updateFreeMotion({
  group,
  time,
  dt,
  pointer,
  index,
  cardMass,
  personality,
  phaseVelocityMultiplier,
  curveState,
  currentDirection,
  currentStrength,
  physics,
  allPhysics,
  trailRef,
  lastTrailSampleRef,
}: FreeMotionArgs): void {
  physics.acceleration.set(0, 0, 0);
  physics.diag.curveForce = 0;
  physics.diag.repulsionForce = 0;
  physics.diag.cohesionForce = 0;

  physics.curveT += physics.curveTVelocity * dt * phaseVelocityMultiplier;
  if (physics.curveT > 1) physics.curveT -= 1;
  if (physics.curveT < 0) physics.curveT += 1;

  const curveTargetPos = blendCurves(
    physics.curveT,
    time,
    curveState.currentCurve,
    curveState.nextCurve,
    curveState.transitionProgress
  );
  physics.diag.curveTarget.copy(curveTargetPos);

  const toCurve = curveTargetPos.clone().sub(physics.position);
  const distToCurve = toCurve.length();
  physics.diag.distToCurve = distToCurve;
  if (distToCurve > 0.1) {
    const attractionFactor = Math.min(distToCurve * 0.5, 1.5);
    const curveForce = toCurve.normalize().multiplyScalar(
      CURVE_ATTRACTION_STRENGTH * attractionFactor * phaseVelocityMultiplier / cardMass
    );
    physics.diag.curveForce = curveForce.length();
    physics.acceleration.add(curveForce);
  }

  const flowForce = flowField(physics.position, time, physics.restlessness);
  physics.acceleration.add(flowForce.divideScalar(cardMass));

  allPhysics.forEach((otherPhysics, otherIndex) => {
    if (otherIndex === index) return;
    const direction = new THREE.Vector3().copy(physics.position).sub(otherPhysics.position);
    const distance = direction.length();
    if (distance < REPULSION_DISTANCE && distance > 0.1) {
      const force = (REPULSION_STRENGTH / (distance * distance)) / cardMass;
      direction.normalize().multiplyScalar(force);
      physics.diag.repulsionForce += direction.length();
      physics.acceleration.add(direction);
    }
  });

  let avgVelocity = new THREE.Vector3();
  let avgPosition = new THREE.Vector3();
  let neighborCount = 0;
  allPhysics.forEach((other, otherIndex) => {
    if (otherIndex === index) return;
    const dist = physics.position.distanceTo(other.position);
    if (dist < FLOCK_RADIUS && dist > 0.5) {
      avgVelocity.add(other.velocity);
      avgPosition.add(other.position);
      neighborCount++;
    }
  });

  if (neighborCount > 0) {
    avgVelocity.divideScalar(neighborCount);
    avgPosition.divideScalar(neighborCount);

    const alignment = avgVelocity.clone().sub(physics.velocity).multiplyScalar(ALIGNMENT_STRENGTH / physics.mass);
    const cohesion = avgPosition.clone().sub(physics.position).multiplyScalar(COHESION_STRENGTH / physics.mass);

    physics.diag.cohesionForce = cohesion.length();
    physics.acceleration.add(alignment).add(cohesion);
  }

  const cursorWorldPos = new THREE.Vector3(pointer.x * 10, pointer.y * 10, 0);
  const cursorDirection = physics.position.clone().sub(cursorWorldPos);
  const cursorDistance = cursorDirection.length();
  if (cursorDistance < CURSOR_INTERACTION_DISTANCE && cursorDistance > 0.1) {
    cursorDirection.normalize();
    const baseForce = 1.2 / (cursorDistance * cursorDistance);
    const personalityForce = personality === 'shy' ? 1.5 : personality === 'curious' ? -0.4 : 0.6;
    const finalForce = (baseForce * personalityForce) / cardMass;
    physics.acceleration.add(cursorDirection.multiplyScalar(finalForce));
  }

  const distanceFromCenter = physics.position.length();
  if (distanceFromCenter > CENTER_ATTRACTION_DISTANCE) {
    const centerDirection = physics.position.clone().negate().normalize();
    const pullStrength = CENTER_ATTRACTION * (distanceFromCenter / CENTER_ATTRACTION_DISTANCE);
    centerDirection.multiplyScalar(pullStrength / cardMass);
    physics.acceleration.add(centerDirection);
  }

  const currentForce = currentDirection.clone().multiplyScalar(currentStrength / cardMass);
  physics.acceleration.add(currentForce);

  const boundaryForce = new THREE.Vector3();
  if (Math.abs(physics.position.x) > BOUNDARY_DISTANCE) boundaryForce.x = -Math.sign(physics.position.x) * BOUNDARY_FORCE;
  if (Math.abs(physics.position.y) > BOUNDARY_DISTANCE) boundaryForce.y = -Math.sign(physics.position.y) * BOUNDARY_FORCE;
  if (Math.abs(physics.position.z) > BOUNDARY_DISTANCE) boundaryForce.z = -Math.sign(physics.position.z) * BOUNDARY_FORCE;
  physics.acceleration.add(boundaryForce.divideScalar(cardMass));

  physics.velocity.add(physics.acceleration.clone().multiplyScalar(dt / cardMass));
  const phaseDampingFactor = phaseVelocityMultiplier > 1 ? 0.996 : 0.988;
  const massDampingAdjust = (cardMass - 1) * 0.001;
  const effectiveDamping = Math.min(phaseDampingFactor + massDampingAdjust, 0.998);
  physics.velocity.multiplyScalar(effectiveDamping);

  const massVelocityFactor = 1.2 - (cardMass * 0.15);
  const effectiveMaxVelocity = MAX_VELOCITY * phaseVelocityMultiplier * massVelocityFactor;
  if (physics.velocity.length() > effectiveMaxVelocity) {
    physics.velocity.normalize().multiplyScalar(effectiveMaxVelocity);
  }

  physics.position.add(physics.velocity.clone().multiplyScalar(dt * 60 * MOTION_SCALE));
  group.position.copy(physics.position);

  lastTrailSampleRef.current += dt;
  const trailSampleRate = phaseVelocityMultiplier > 1 ? 0.02 : 0.05;
  const maxTrailLength = phaseVelocityMultiplier > 1 ? 20 : 8;
  if (lastTrailSampleRef.current > trailSampleRate) {
    lastTrailSampleRef.current = 0;
    trailRef.current.push(physics.position.clone());
    if (trailRef.current.length > maxTrailLength) {
      trailRef.current.shift();
    }
  }
}

type VisualMotionArgs = {
  group: THREE.Group;
  dt: number;
  pointer: THREE.Vector2;
  angularVelocity: THREE.Vector3;
  physics: CardPhysics;
  personality: 'shy' | 'neutral' | 'curious';
  hovered: boolean;
  dragging: boolean;
};

export function applyCardVisualMotion({
  group,
  dt,
  pointer,
  angularVelocity,
  physics,
  personality,
  hovered,
  dragging,
}: VisualMotionArgs): void {
  group.rotation.x += angularVelocity.x * dt * MOTION_SCALE;
  group.rotation.y += angularVelocity.y * dt * MOTION_SCALE;
  group.rotation.z += angularVelocity.z * dt * MOTION_SCALE;

  const cursorWorldPos = new THREE.Vector3(pointer.x * 10, pointer.y * 10, 0);
  const toCursor = cursorWorldPos.clone().sub(physics.position);
  const cursorDist = toCursor.length();
  if (cursorDist < ATTENTION_DISTANCE && cursorDist > 0.5) {
    const attentionFactor = 1 - (cursorDist / ATTENTION_DISTANCE);
    const personalityMod = personality === 'curious' ? 1.0 : personality === 'shy' ? -0.3 : 0.2;
    const targetRotY = Math.atan2(toCursor.x, 5);
    const targetRotX = Math.atan2(-toCursor.y, 5) * 0.3;
    const strength = ATTENTION_STRENGTH * attentionFactor * personalityMod;
    group.rotation.y += (targetRotY - group.rotation.y) * strength;
    group.rotation.x += (targetRotX - group.rotation.x) * strength * 0.5;
  }

  if (!hovered && !dragging) {
    physics.breathPhase += dt * BREATH_SPEED;
    if (physics.breathPhase > Math.PI * 2) physics.breathPhase -= Math.PI * 2;
    const breathScale = 1 + Math.sin(physics.breathPhase) * BREATH_AMPLITUDE;
    group.scale.lerp(new THREE.Vector3(breathScale, breathScale, breathScale), 0.1);
    return;
  }
  if (hovered && !dragging) {
    group.scale.lerp(new THREE.Vector3(1.25, 1.25, 1.25), 0.1);
    return;
  }
  group.scale.lerp(new THREE.Vector3(1.35, 1.35, 1.35), 0.12);
}
