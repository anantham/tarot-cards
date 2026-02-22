import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { TarotCard } from '../../types';

export interface CardPhysics {
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
  curveT: number;
  curveTVelocity: number;
  diag: {
    curveTarget: THREE.Vector3;
    distToCurve: number;
    curveForce: number;
    repulsionForce: number;
    cohesionForce: number;
  };
}

export type CurveType = 'torusKnot' | 'trefoil' | 'lissajous3D' | 'cinquefoil' | 'rose' | 'lorenz';

export type PhaseState = {
  elapsedTime: number;
  currentPhase: 'fast' | 'slow';
  velocityMultiplier: number;
  transitionProgress: number;
};

export type CurveState = {
  currentCurve: CurveType;
  nextCurve: CurveType;
  transitionProgress: number;
  cycleTime: number;
  curveIndex: number;
};

export type AmbientCurrentState = {
  direction: THREE.Vector3;
  strength: number;
  targetStrength: number;
  changeTimer: number;
};

export type InjectionState = {
  timeSinceLastInjection: number;
};

export interface CardProps {
  card: TarotCard;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  index: number;
  physics: MutableRefObject<CardPhysics>;
  allPhysics: MutableRefObject<CardPhysics[]>;
  currentlyDraggingRef: MutableRefObject<number | null>;
  phaseStateRef: MutableRefObject<PhaseState>;
  curveStateRef: MutableRefObject<CurveState>;
  isInjected: boolean;
  mass: number;
  personality: 'shy' | 'neutral' | 'curious';
  currentRef: MutableRefObject<AmbientCurrentState>;
}

export interface DiagnosticFrame {
  t: number;
  phase: string;
  mult: number;
  curve: string;
  cards: Array<{
    i: number;
    pos: [number, number, number];
    vel: [number, number, number];
    acc: [number, number, number];
    curveT: number;
    curveTarget: [number, number, number];
    distToCurve: number;
  }>;
}
