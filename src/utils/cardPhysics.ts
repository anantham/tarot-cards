import * as THREE from 'three';

export interface PhysicsConstants {
  REPULSION_STRENGTH: number;
  REPULSION_DISTANCE: number;
  CURSOR_REPULSION_STRENGTH: number;
  CURSOR_REPULSION_DISTANCE: number;
  CENTER_ATTRACTION: number;
  CENTER_ATTRACTION_DISTANCE: number;
  DAMPING: number;
  MAX_VELOCITY: number;
  BOUNDARY_FORCE: number;
  BOUNDARY_DISTANCE: number;
}

export const DEFAULT_PHYSICS_CONSTANTS: PhysicsConstants = {
  REPULSION_STRENGTH: 2.5,
  REPULSION_DISTANCE: 3.0,
  CURSOR_REPULSION_STRENGTH: 0.8,
  CURSOR_REPULSION_DISTANCE: 2.5,
  CENTER_ATTRACTION: 0.015,
  CENTER_ATTRACTION_DISTANCE: 5.0,
  DAMPING: 0.98,
  MAX_VELOCITY: 0.15,
  BOUNDARY_FORCE: 0.3,
  BOUNDARY_DISTANCE: 8,
};

/**
 * Calculate card-to-card repulsion force (magnetic field effect)
 * Uses inverse square law: F = strength / distance²
 */
export function calculateCardRepulsion(
  position: THREE.Vector3,
  otherPosition: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): THREE.Vector3 {
  const direction = new THREE.Vector3().copy(position).sub(otherPosition);
  const distance = direction.length();

  if (distance >= constants.REPULSION_DISTANCE || distance <= 0.1) {
    return new THREE.Vector3(0, 0, 0);
  }

  const force = constants.REPULSION_STRENGTH / (distance * distance);
  return direction.normalize().multiplyScalar(force);
}

/**
 * Calculate cursor repulsion force
 */
export function calculateCursorRepulsion(
  position: THREE.Vector3,
  cursorPosition: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): THREE.Vector3 {
  const direction = new THREE.Vector3().copy(position).sub(cursorPosition);
  const distance = direction.length();

  if (distance >= constants.CURSOR_REPULSION_DISTANCE || distance <= 0.1) {
    return new THREE.Vector3(0, 0, 0);
  }

  const force = constants.CURSOR_REPULSION_STRENGTH / (distance * distance);
  return direction.normalize().multiplyScalar(force);
}

/**
 * Calculate center attraction force (keeps cards from escaping)
 * Strength increases with distance from center
 */
export function calculateCenterAttraction(
  position: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): THREE.Vector3 {
  const distanceFromCenter = position.length();

  if (distanceFromCenter <= constants.CENTER_ATTRACTION_DISTANCE) {
    return new THREE.Vector3(0, 0, 0);
  }

  const centerDirection = new THREE.Vector3().copy(position).negate().normalize();
  const pullStrength = constants.CENTER_ATTRACTION * (distanceFromCenter / constants.CENTER_ATTRACTION_DISTANCE);

  return centerDirection.multiplyScalar(pullStrength);
}

/**
 * Calculate boundary forces (keep cards in view)
 */
export function calculateBoundaryForce(
  position: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): THREE.Vector3 {
  const boundaryForce = new THREE.Vector3();

  if (Math.abs(position.x) > constants.BOUNDARY_DISTANCE) {
    boundaryForce.x = -Math.sign(position.x) * constants.BOUNDARY_FORCE;
  }
  if (Math.abs(position.y) > constants.BOUNDARY_DISTANCE) {
    boundaryForce.y = -Math.sign(position.y) * constants.BOUNDARY_FORCE;
  }
  if (Math.abs(position.z) > constants.BOUNDARY_DISTANCE) {
    boundaryForce.z = -Math.sign(position.z) * constants.BOUNDARY_FORCE;
  }

  return boundaryForce;
}

/**
 * Calculate random drift force (wandering behavior)
 */
export function calculateDriftForce(
  time: number,
  driftParams: {
    speed: number;
    xOffset: number;
    yOffset: number;
    zOffset: number;
    xAmplitude: number;
    yAmplitude: number;
    zAmplitude: number;
  }
): THREE.Vector3 {
  const driftX = Math.sin(time * driftParams.speed + driftParams.xOffset) * driftParams.xAmplitude * 0.01;
  const driftY = Math.cos(time * driftParams.speed + driftParams.yOffset) * driftParams.yAmplitude * 0.01;
  const driftZ = Math.sin(time * driftParams.speed * 0.5 + driftParams.zOffset) * driftParams.zAmplitude * 0.01;

  return new THREE.Vector3(driftX, driftY, driftZ);
}

/**
 * Apply damping to velocity
 */
export function applyDamping(
  velocity: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): THREE.Vector3 {
  return velocity.clone().multiplyScalar(constants.DAMPING);
}

/**
 * Limit velocity to maximum
 */
export function limitVelocity(
  velocity: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): THREE.Vector3 {
  const speed = velocity.length();

  if (speed > constants.MAX_VELOCITY) {
    return velocity.clone().normalize().multiplyScalar(constants.MAX_VELOCITY);
  }

  return velocity.clone();
}

/**
 * Update physics state for one timestep
 */
export function updatePhysicsState(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  acceleration: THREE.Vector3,
  dt: number,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): { position: THREE.Vector3; velocity: THREE.Vector3 } {
  // Update velocity with acceleration
  const newVelocity = velocity.clone().add(
    acceleration.clone().multiplyScalar(dt)
  );

  // Apply damping
  const dampedVelocity = applyDamping(newVelocity, constants);

  // Limit velocity
  const limitedVelocity = limitVelocity(dampedVelocity, constants);

  // Update position
  const newPosition = position.clone().add(
    limitedVelocity.clone().multiplyScalar(dt * 60)
  );

  return { position: newPosition, velocity: limitedVelocity };
}

/**
 * Check if two cards would collide
 */
export function wouldCollide(
  pos1: THREE.Vector3,
  pos2: THREE.Vector3,
  minDistance: number = 0.5
): boolean {
  return pos1.distanceTo(pos2) < minDistance;
}

/**
 * Check if position is within boundaries
 */
export function isWithinBoundaries(
  position: THREE.Vector3,
  constants: PhysicsConstants = DEFAULT_PHYSICS_CONSTANTS
): boolean {
  return (
    Math.abs(position.x) <= constants.BOUNDARY_DISTANCE &&
    Math.abs(position.y) <= constants.BOUNDARY_DISTANCE &&
    Math.abs(position.z) <= constants.BOUNDARY_DISTANCE
  );
}
