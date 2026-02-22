import * as THREE from 'three';
import type { TarotCard } from '../../types';
import type { CardPhysics } from './types';

function getMass(card: TarotCard): number {
  if (card.number === 0) return 2.2;
  if (card.number <= 21) return 1.6;
  return 0.9 + Math.random() * 0.2;
}

function getPersonality(card: TarotCard): 'shy' | 'neutral' | 'curious' {
  const hash = (card.number * 7 + 3) % 3;
  return hash === 0 ? 'shy' : hash === 1 ? 'neutral' : 'curious';
}

export function createInitialPhysics(cards: TarotCard[]): CardPhysics[] {
  return cards.map((card, index) => {
    const angle = (index / cards.length) * Math.PI * 4;
    const radius = 2 + (index % 3) * 1.5;
    const initialPos = new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
      Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 3
    );
    const curveT = index / cards.length;
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
  });
}

export function createInitialCardData(cards: TarotCard[]): Array<{
  position: [number, number, number];
  rotation: [number, number, number];
}> {
  return cards.map((_, index) => {
    const angle = (index / cards.length) * Math.PI * 4;
    const radius = 2 + (index % 3) * 1.5;

    return {
      position: [
        Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
        Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 3,
      ],
      rotation: [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ],
    };
  });
}
