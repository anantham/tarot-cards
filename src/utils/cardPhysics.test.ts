import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  calculateCardRepulsion,
  calculateCursorRepulsion,
  calculateCenterAttraction,
  calculateBoundaryForce,
  calculateDriftForce,
  applyDamping,
  limitVelocity,
  updatePhysicsState,
  wouldCollide,
  isWithinBoundaries,
  DEFAULT_PHYSICS_CONSTANTS,
} from './cardPhysics';

describe('Card Physics', () => {
  describe('calculateCardRepulsion', () => {
    it('should return zero force when cards are too far apart', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(10, 0, 0);

      const force = calculateCardRepulsion(pos1, pos2);

      expect(force.length()).toBeCloseTo(0);
    });

    it('should return zero force when cards are at same position', () => {
      const pos1 = new THREE.Vector3(5, 5, 5);
      const pos2 = new THREE.Vector3(5, 5, 5);

      const force = calculateCardRepulsion(pos1, pos2);

      expect(force.length()).toBeCloseTo(0);
    });

    it('should apply inverse square law - stronger force at closer distance', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2Close = new THREE.Vector3(0.5, 0, 0);
      const pos2Far = new THREE.Vector3(1, 0, 0);

      const forceClose = calculateCardRepulsion(pos1, pos2Close);
      const forceFar = calculateCardRepulsion(pos1, pos2Far);

      expect(forceClose.length()).toBeGreaterThan(forceFar.length());
    });

    it('should push cards apart along the line between them', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(1, 0, 0);

      const force = calculateCardRepulsion(pos1, pos2);

      // Force should be in negative x direction (away from pos2)
      expect(force.x).toBeLessThan(0);
      expect(force.y).toBeCloseTo(0);
      expect(force.z).toBeCloseTo(0);
    });

    it('should respect custom repulsion constants', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(1, 0, 0);

      const customConstants = {
        ...DEFAULT_PHYSICS_CONSTANTS,
        REPULSION_STRENGTH: 10,
      };

      const force = calculateCardRepulsion(pos1, pos2, customConstants);

      expect(force.length()).toBeGreaterThan(0);
    });
  });

  describe('calculateCursorRepulsion', () => {
    it('should return zero force when cursor is too far', () => {
      const cardPos = new THREE.Vector3(0, 0, 0);
      const cursorPos = new THREE.Vector3(10, 0, 0);

      const force = calculateCursorRepulsion(cardPos, cursorPos);

      expect(force.length()).toBeCloseTo(0);
    });

    it('should push card away from cursor when close', () => {
      const cardPos = new THREE.Vector3(0, 0, 0);
      const cursorPos = new THREE.Vector3(1, 0, 0);

      const force = calculateCursorRepulsion(cardPos, cursorPos);

      expect(force.length()).toBeGreaterThan(0);
      expect(force.x).toBeLessThan(0); // Push away from cursor
    });

    it('should use weaker force than card repulsion', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(1, 0, 0);

      const cardForce = calculateCardRepulsion(pos1, pos2);
      const cursorForce = calculateCursorRepulsion(pos1, pos2);

      expect(cursorForce.length()).toBeLessThan(cardForce.length());
    });
  });

  describe('calculateCenterAttraction', () => {
    it('should return zero force when card is near center', () => {
      const pos = new THREE.Vector3(1, 1, 1);

      const force = calculateCenterAttraction(pos);

      expect(force.length()).toBeCloseTo(0);
    });

    it('should pull card toward center when far away', () => {
      const pos = new THREE.Vector3(10, 0, 0);

      const force = calculateCenterAttraction(pos);

      expect(force.length()).toBeGreaterThan(0);
      expect(force.x).toBeLessThan(0); // Pull toward center (negative x)
    });

    it('should increase force strength with distance', () => {
      const posFar = new THREE.Vector3(20, 0, 0);
      const posNear = new THREE.Vector3(7, 0, 0);

      const forceFar = calculateCenterAttraction(posFar);
      const forceNear = calculateCenterAttraction(posNear);

      expect(forceFar.length()).toBeGreaterThan(forceNear.length());
    });

    it('should pull in the direction toward origin', () => {
      const pos = new THREE.Vector3(10, 10, 10);

      const force = calculateCenterAttraction(pos);

      // All components should be negative (pulling toward origin)
      expect(force.x).toBeLessThan(0);
      expect(force.y).toBeLessThan(0);
      expect(force.z).toBeLessThan(0);
    });
  });

  describe('calculateBoundaryForce', () => {
    it('should return zero force when card is within boundaries', () => {
      const pos = new THREE.Vector3(5, 5, 5);

      const force = calculateBoundaryForce(pos);

      expect(force.length()).toBeCloseTo(0);
    });

    it('should push back on X axis when beyond boundary', () => {
      const pos = new THREE.Vector3(10, 0, 0);

      const force = calculateBoundaryForce(pos);

      expect(force.x).toBeLessThan(0);
    });

    it('should push back on Y axis when beyond boundary', () => {
      const pos = new THREE.Vector3(0, 10, 0);

      const force = calculateBoundaryForce(pos);

      expect(force.y).toBeLessThan(0);
    });

    it('should push back on Z axis when beyond boundary', () => {
      const pos = new THREE.Vector3(0, 0, 10);

      const force = calculateBoundaryForce(pos);

      expect(force.z).toBeLessThan(0);
    });

    it('should apply force on multiple axes if needed', () => {
      const pos = new THREE.Vector3(10, 10, 0);

      const force = calculateBoundaryForce(pos);

      expect(force.x).toBeLessThan(0);
      expect(force.y).toBeLessThan(0);
      expect(force.z).toBeCloseTo(0);
    });
  });

  describe('calculateDriftForce', () => {
    it('should generate smooth drift patterns', () => {
      const driftParams = {
        speed: 0.3,
        xOffset: 0,
        yOffset: Math.PI / 2,
        zOffset: Math.PI,
        xAmplitude: 0.2,
        yAmplitude: 0.15,
        zAmplitude: 0.1,
      };

      const force1 = calculateDriftForce(0, driftParams);
      const force2 = calculateDriftForce(1, driftParams);

      // Forces should be different but small
      expect(force1.distanceTo(force2)).toBeGreaterThan(0);
      expect(force1.length()).toBeLessThan(0.01);
      expect(force2.length()).toBeLessThan(0.01);
    });

    it('should produce continuous movement over time', () => {
      const driftParams = {
        speed: 0.5,
        xOffset: 0,
        yOffset: 0,
        zOffset: 0,
        xAmplitude: 0.2,
        yAmplitude: 0.2,
        zAmplitude: 0.2,
      };

      const forces = [];
      for (let t = 0; t < 10; t += 0.1) {
        forces.push(calculateDriftForce(t, driftParams));
      }

      // Check that drift changes smoothly
      for (let i = 1; i < forces.length; i++) {
        const change = forces[i].distanceTo(forces[i - 1]);
        expect(change).toBeLessThan(0.001);
      }
    });
  });

  describe('applyDamping', () => {
    it('should reduce velocity magnitude', () => {
      const velocity = new THREE.Vector3(1, 1, 1);

      const damped = applyDamping(velocity);

      expect(damped.length()).toBeLessThan(velocity.length());
    });

    it('should preserve velocity direction', () => {
      const velocity = new THREE.Vector3(1, 2, 3);
      const normalized = velocity.clone().normalize();

      const damped = applyDamping(velocity);
      const dampedNormalized = damped.clone().normalize();

      expect(dampedNormalized.x).toBeCloseTo(normalized.x);
      expect(dampedNormalized.y).toBeCloseTo(normalized.y);
      expect(dampedNormalized.z).toBeCloseTo(normalized.z);
    });

    it('should apply damping factor correctly', () => {
      const velocity = new THREE.Vector3(10, 0, 0);

      const damped = applyDamping(velocity);

      expect(damped.x).toBeCloseTo(10 * DEFAULT_PHYSICS_CONSTANTS.DAMPING);
    });
  });

  describe('limitVelocity', () => {
    it('should not change velocity below max', () => {
      const velocity = new THREE.Vector3(0.1, 0, 0);

      const limited = limitVelocity(velocity);

      expect(limited.length()).toBeCloseTo(velocity.length());
    });

    it('should cap velocity at maximum', () => {
      const velocity = new THREE.Vector3(10, 10, 10);

      const limited = limitVelocity(velocity);

      expect(limited.length()).toBeCloseTo(DEFAULT_PHYSICS_CONSTANTS.MAX_VELOCITY);
    });

    it('should preserve velocity direction when limiting', () => {
      const velocity = new THREE.Vector3(10, 20, 30);
      const normalized = velocity.clone().normalize();

      const limited = limitVelocity(velocity);
      const limitedNormalized = limited.clone().normalize();

      expect(limitedNormalized.x).toBeCloseTo(normalized.x);
      expect(limitedNormalized.y).toBeCloseTo(normalized.y);
      expect(limitedNormalized.z).toBeCloseTo(normalized.z);
    });
  });

  describe('updatePhysicsState', () => {
    it('should update position based on velocity', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const velocity = new THREE.Vector3(0.1, 0, 0);
      const acceleration = new THREE.Vector3(0, 0, 0);
      const dt = 0.016; // ~60fps

      const { position: newPos } = updatePhysicsState(position, velocity, acceleration, dt);

      expect(newPos.x).toBeGreaterThan(position.x);
    });

    it('should update velocity based on acceleration', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const velocity = new THREE.Vector3(0, 0, 0);
      const acceleration = new THREE.Vector3(1, 0, 0);
      const dt = 0.016;

      const { velocity: newVel } = updatePhysicsState(position, velocity, acceleration, dt);

      expect(newVel.x).toBeGreaterThan(0);
    });

    it('should apply damping automatically', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const velocity = new THREE.Vector3(1, 0, 0);
      const acceleration = new THREE.Vector3(0, 0, 0);
      const dt = 0.016;

      const { velocity: newVel } = updatePhysicsState(position, velocity, acceleration, dt);

      expect(newVel.length()).toBeLessThan(velocity.length());
    });

    it('should limit maximum velocity', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const velocity = new THREE.Vector3(0, 0, 0);
      const acceleration = new THREE.Vector3(100, 0, 0); // Large acceleration
      const dt = 1;

      const { velocity: newVel } = updatePhysicsState(position, velocity, acceleration, dt);

      expect(newVel.length()).toBeLessThanOrEqual(DEFAULT_PHYSICS_CONSTANTS.MAX_VELOCITY);
    });
  });

  describe('wouldCollide', () => {
    it('should detect collision when cards are very close', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(0.2, 0, 0);

      const collides = wouldCollide(pos1, pos2);

      expect(collides).toBe(true);
    });

    it('should not detect collision when cards are far apart', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(5, 0, 0);

      const collides = wouldCollide(pos1, pos2);

      expect(collides).toBe(false);
    });

    it('should respect custom minimum distance', () => {
      const pos1 = new THREE.Vector3(0, 0, 0);
      const pos2 = new THREE.Vector3(1, 0, 0);

      const collides = wouldCollide(pos1, pos2, 2);

      expect(collides).toBe(true);
    });
  });

  describe('isWithinBoundaries', () => {
    it('should return true when position is within boundaries', () => {
      const pos = new THREE.Vector3(5, 5, 5);

      const within = isWithinBoundaries(pos);

      expect(within).toBe(true);
    });

    it('should return false when X is beyond boundary', () => {
      const pos = new THREE.Vector3(10, 0, 0);

      const within = isWithinBoundaries(pos);

      expect(within).toBe(false);
    });

    it('should return false when Y is beyond boundary', () => {
      const pos = new THREE.Vector3(0, 10, 0);

      const within = isWithinBoundaries(pos);

      expect(within).toBe(false);
    });

    it('should return false when Z is beyond boundary', () => {
      const pos = new THREE.Vector3(0, 0, 10);

      const within = isWithinBoundaries(pos);

      expect(within).toBe(false);
    });

    it('should return true at boundary edge', () => {
      const pos = new THREE.Vector3(
        DEFAULT_PHYSICS_CONSTANTS.BOUNDARY_DISTANCE,
        DEFAULT_PHYSICS_CONSTANTS.BOUNDARY_DISTANCE,
        DEFAULT_PHYSICS_CONSTANTS.BOUNDARY_DISTANCE
      );

      const within = isWithinBoundaries(pos);

      expect(within).toBe(true);
    });
  });
});
