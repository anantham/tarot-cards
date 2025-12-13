import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  calculateCardRepulsion,
  calculateCenterAttraction,
  calculateBoundaryForce,
  updatePhysicsState,
  isWithinBoundaries,
  wouldCollide,
} from './cardPhysics';

describe('Card Physics Integration Tests', () => {
  describe('Multiple cards repelling each other', () => {
    it('should separate overlapping cards over time', () => {
      // Start with two cards very close together
      const positions = [
        new THREE.Vector3(0, 0, 0),
        // Must be > 0.1, because calculateCardRepulsion returns zero at <= 0.1
        // (singularity guard).
        new THREE.Vector3(0.2, 0, 0),
      ];
      const velocities = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ];

      const initialDistance = positions[0].distanceTo(positions[1]);

      // Simulate 300 frames (give more time for separation)
      for (let frame = 0; frame < 300; frame++) {
        const accelerations = [new THREE.Vector3(), new THREE.Vector3()];

        // Calculate repulsion between cards
        const repulsion01 = calculateCardRepulsion(positions[0], positions[1]);
        const repulsion10 = calculateCardRepulsion(positions[1], positions[0]);

        accelerations[0].add(repulsion01);
        accelerations[1].add(repulsion10);

        // Update physics
        const update0 = updatePhysicsState(positions[0], velocities[0], accelerations[0], 0.016);
        const update1 = updatePhysicsState(positions[1], velocities[1], accelerations[1], 0.016);

        positions[0] = update0.position;
        velocities[0] = update0.velocity;
        positions[1] = update1.position;
        velocities[1] = update1.velocity;
      }

      // Cards should have separated significantly
      const finalDistance = positions[0].distanceTo(positions[1]);
      expect(finalDistance).toBeGreaterThan(initialDistance * 2);
    });

    it('should maintain minimum distance between cards', () => {
      // Start with 3 cards in a line
      const positions = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(2, 0, 0),
      ];
      const velocities = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ];

      // Simulate 200 frames
      for (let frame = 0; frame < 200; frame++) {
        const accelerations = positions.map(() => new THREE.Vector3());

        // Calculate repulsion between all pairs
        for (let i = 0; i < positions.length; i++) {
          for (let j = 0; j < positions.length; j++) {
            if (i !== j) {
              const repulsion = calculateCardRepulsion(positions[i], positions[j]);
              accelerations[i].add(repulsion);
            }
          }
        }

        // Update all cards
        for (let i = 0; i < positions.length; i++) {
          const update = updatePhysicsState(positions[i], velocities[i], accelerations[i], 0.016);
          positions[i] = update.position;
          velocities[i] = update.velocity;
        }
      }

      // Check no cards collide
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(wouldCollide(positions[i], positions[j], 0.5)).toBe(false);
        }
      }
    });
  });

  describe('Center attraction behavior', () => {
    it('should pull distant card back toward center', () => {
      let position = new THREE.Vector3(15, 0, 0);
      let velocity = new THREE.Vector3(0, 0, 0);

      // Simulate 500 frames
      for (let frame = 0; frame < 500; frame++) {
        const acceleration = calculateCenterAttraction(position);

        const update = updatePhysicsState(position, velocity, acceleration, 0.016);
        position = update.position;
        velocity = update.velocity;
      }

      // Card should have moved closer to center
      expect(position.length()).toBeLessThan(15);
      expect(position.length()).toBeGreaterThan(0); // But not exactly at center
    });

    it('should keep cards in bounded area with center attraction', () => {
      // Start card with outward velocity
      let position = new THREE.Vector3(7, 0, 0);
      let velocity = new THREE.Vector3(0.1, 0, 0);

      // Simulate 1000 frames
      for (let frame = 0; frame < 1000; frame++) {
        const acceleration = new THREE.Vector3();

        // Add center attraction
        acceleration.add(calculateCenterAttraction(position));

        const update = updatePhysicsState(position, velocity, acceleration, 0.016);
        position = update.position;
        velocity = update.velocity;
      }

      // Card should not have escaped too far
      expect(position.length()).toBeLessThan(20);
    });
  });

  describe('Boundary forces', () => {
    it('should prevent card from escaping boundaries', () => {
      let position = new THREE.Vector3(7, 7, 7);
      let velocity = new THREE.Vector3(0.1, 0.1, 0.1);

      // Simulate 500 frames
      for (let frame = 0; frame < 500; frame++) {
        const acceleration = calculateBoundaryForce(position);

        const update = updatePhysicsState(position, velocity, acceleration, 0.016);
        position = update.position;
        velocity = update.velocity;

        // Every frame, card should be within boundaries or moving back
        if (!isWithinBoundaries(position)) {
          // If outside, boundary acceleration at the *current* position should
          // point back inward. Velocity may still be outward for a few frames
          // because boundaries are modeled as soft acceleration, not an instant
          // velocity reflection.
          const toCenter = position.clone().negate().normalize();
          const boundaryNow = calculateBoundaryForce(position);
          expect(boundaryNow.length()).toBeGreaterThan(0);
          const dot = boundaryNow.clone().normalize().dot(toCenter);
          expect(dot).toBeGreaterThan(0);
        }
      }

      // Card should eventually be within boundaries
      expect(isWithinBoundaries(position)).toBe(true);
    });

    it('should bounce card back from boundary', () => {
      let position = new THREE.Vector3(8.5, 0, 0);
      let velocity = new THREE.Vector3(0.1, 0, 0); // Moving outward

      const initialX = position.x;

      // Simulate 200 frames
      for (let frame = 0; frame < 200; frame++) {
        const acceleration = calculateBoundaryForce(position);

        const update = updatePhysicsState(position, velocity, acceleration, 0.016);
        position = update.position;
        velocity = update.velocity;
      }

      // Card should have bounced back
      expect(position.x).toBeLessThan(initialX);
    });
  });

  describe('Combined forces stability', () => {
    it('should reach stable equilibrium with all forces', () => {
      // Start with multiple cards in random positions
      const numCards = 5;
      const positions = Array.from({ length: numCards }, () =>
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4
        )
      );
      const velocities = Array.from({ length: numCards }, () =>
        new THREE.Vector3(0, 0, 0)
      );

      // Simulate 1000 frames
      for (let frame = 0; frame < 1000; frame++) {
        const accelerations = positions.map(() => new THREE.Vector3());

        // Apply all forces
        for (let i = 0; i < positions.length; i++) {
          // Card-to-card repulsion
          for (let j = 0; j < positions.length; j++) {
            if (i !== j) {
              const repulsion = calculateCardRepulsion(positions[i], positions[j]);
              accelerations[i].add(repulsion);
            }
          }

          // Center attraction
          accelerations[i].add(calculateCenterAttraction(positions[i]));

          // Boundary forces
          accelerations[i].add(calculateBoundaryForce(positions[i]));
        }

        // Update all cards
        for (let i = 0; i < positions.length; i++) {
          const update = updatePhysicsState(positions[i], velocities[i], accelerations[i], 0.016);
          positions[i] = update.position;
          velocities[i] = update.velocity;
        }
      }

      // Check final state
      for (const position of positions) {
        // All cards should be within boundaries
        expect(isWithinBoundaries(position)).toBe(true);

        // All cards should be reasonably close to center
        expect(position.length()).toBeLessThan(10);
      }

      // No cards should be colliding
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(wouldCollide(positions[i], positions[j], 0.3)).toBe(false);
        }
      }

      // Velocities should be low (near equilibrium)
      for (const velocity of velocities) {
        expect(velocity.length()).toBeLessThan(0.05);
      }
    });

    it('should maintain separation even with continuous disturbance', () => {
      const positions = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
      ];
      const velocities = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ];

      // Simulate with random forces (like drift)
      for (let frame = 0; frame < 500; frame++) {
        const accelerations = [new THREE.Vector3(), new THREE.Vector3()];

        // Add repulsion
        accelerations[0].add(calculateCardRepulsion(positions[0], positions[1]));
        accelerations[1].add(calculateCardRepulsion(positions[1], positions[0]));

        // Add random disturbance
        accelerations[0].add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        ));
        accelerations[1].add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        ));

        // Update
        for (let i = 0; i < 2; i++) {
          const update = updatePhysicsState(positions[i], velocities[i], accelerations[i], 0.016);
          positions[i] = update.position;
          velocities[i] = update.velocity;
        }
      }

      // Cards should maintain separation despite disturbance
      expect(wouldCollide(positions[0], positions[1], 0.5)).toBe(false);
    });
  });

  describe('Performance characteristics', () => {
    it('should maintain stable motion with 22 cards (full deck)', () => {
      const numCards = 22;
      const positions = Array.from({ length: numCards }, (_, i) => {
        const angle = (i / numCards) * Math.PI * 4;
        const radius = 2 + (i % 3) * 1.5;
        return new THREE.Vector3(
          Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
          Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 3
        );
      });
      const velocities = Array.from({ length: numCards }, () =>
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.05
        )
      );

      // Simulate 500 frames - should complete quickly
      const startTime = Date.now();

      for (let frame = 0; frame < 500; frame++) {
        const accelerations = positions.map(() => new THREE.Vector3());

        // Apply all forces for all cards
        for (let i = 0; i < numCards; i++) {
          // Card-to-card repulsion
          for (let j = 0; j < numCards; j++) {
            if (i !== j) {
              accelerations[i].add(calculateCardRepulsion(positions[i], positions[j]));
            }
          }

          // Center attraction and boundary
          accelerations[i].add(calculateCenterAttraction(positions[i]));
          accelerations[i].add(calculateBoundaryForce(positions[i]));
        }

        // Update all
        for (let i = 0; i < numCards; i++) {
          const update = updatePhysicsState(positions[i], velocities[i], accelerations[i], 0.016);
          positions[i] = update.position;
          velocities[i] = update.velocity;
        }
      }

      const elapsedTime = Date.now() - startTime;

      // Should complete quickly (< 1 second for 500 frames of 22 cards)
      expect(elapsedTime).toBeLessThan(1000);

      // All cards should be stable
      for (const position of positions) {
        expect(isWithinBoundaries(position)).toBe(true);
      }

      // No collisions
      for (let i = 0; i < numCards; i++) {
        for (let j = i + 1; j < numCards; j++) {
          expect(wouldCollide(positions[i], positions[j], 0.3)).toBe(false);
        }
      }
    });
  });
});
