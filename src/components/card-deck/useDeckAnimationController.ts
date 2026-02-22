import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { debugLog } from '../../utils/logger';
import { blendCurves, CURVE_CYCLE_DURATION, CURVE_SEQUENCE, CURVE_TRANSITION_DURATION } from './curves';
import type {
  AmbientCurrentState,
  CardPhysics,
  CurveState,
  DiagnosticFrame,
  InjectionState,
  PhaseState,
} from './types';

type UseDeckAnimationControllerArgs = {
  allPhysicsRef: MutableRefObject<CardPhysics[]>;
  curveStateRef: MutableRefObject<CurveState>;
  phaseStateRef: MutableRefObject<PhaseState>;
  currentRef: MutableRefObject<AmbientCurrentState>;
  injectionStateRef: MutableRefObject<InjectionState>;
  setInjectedCardIndices: Dispatch<SetStateAction<Set<number>>>;
};

export function useDeckAnimationController({
  allPhysicsRef,
  curveStateRef,
  phaseStateRef,
  currentRef,
  injectionStateRef,
  setInjectedCardIndices,
}: UseDeckAnimationControllerArgs) {
  const diagnosticDataRef = useRef<DiagnosticFrame[]>([]);
  const diagnosticEnabledRef = useRef(true);
  const lastDiagnosticTimeRef = useRef(0);
  const DIAGNOSTIC_INTERVAL = 0.1;
  const MAX_DIAGNOSTIC_FRAMES = 600;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        const data = diagnosticDataRef.current;
        if (data.length === 0) {
          debugLog('[Diagnostic] No data collected yet');
          return;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `card-physics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        debugLog(`[Diagnostic] Downloaded ${data.length} frames`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useFrame((state, dt) => {
    const phaseRef = phaseStateRef.current;
    phaseRef.elapsedTime += dt;
    if (phaseRef.elapsedTime >= 30) {
      phaseRef.elapsedTime = 0;
    }

    const targetPhase = phaseRef.elapsedTime < 10 ? 'fast' : 'slow';
    const targetMultiplier = targetPhase === 'fast' ? 5.0 : 0.5;
    if (phaseRef.currentPhase !== targetPhase) {
      debugLog(
        `[Animation] Phase change: ${phaseRef.currentPhase} → ${targetPhase} at ${phaseRef.elapsedTime.toFixed(2)}s, multiplier: ${phaseRef.velocityMultiplier.toFixed(2)} → ${targetMultiplier}`
      );
      phaseRef.currentPhase = targetPhase;
      phaseRef.transitionProgress = 0;
    }

    if (phaseRef.transitionProgress < 1.0) {
      phaseRef.transitionProgress = Math.min(1.0, phaseRef.transitionProgress + dt / 1.5);
      const t = phaseRef.transitionProgress;
      const smoothT = t * t * (3 - 2 * t);
      phaseRef.velocityMultiplier = THREE.MathUtils.lerp(
        phaseRef.velocityMultiplier,
        targetMultiplier,
        smoothT
      );
    } else {
      phaseRef.velocityMultiplier = targetMultiplier;
    }

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

    if (Math.floor(phaseRef.elapsedTime) % 2 === 0 && phaseRef.elapsedTime - Math.floor(phaseRef.elapsedTime) < dt * 2) {
      const avgVel = allPhysicsRef.current.reduce((sum, p) => sum + p.velocity.length(), 0) / allPhysicsRef.current.length;
      debugLog(
        `[Debug] Phase: ${phaseRef.currentPhase}, Multiplier: ${phaseRef.velocityMultiplier.toFixed(2)}, Avg velocity: ${avgVel.toFixed(4)}`
      );
    }

    const currentTime = state.clock.elapsedTime;
    if (diagnosticEnabledRef.current && currentTime - lastDiagnosticTimeRef.current >= DIAGNOSTIC_INTERVAL) {
      lastDiagnosticTimeRef.current = currentTime;
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
      if (diagnosticDataRef.current.length > MAX_DIAGNOSTIC_FRAMES) {
        diagnosticDataRef.current.shift();
      }
    }

    const cState = curveStateRef.current;
    cState.cycleTime += dt;
    const totalCycleTime = CURVE_CYCLE_DURATION + CURVE_TRANSITION_DURATION;
    if (cState.cycleTime >= totalCycleTime) {
      cState.cycleTime = 0;
      cState.curveIndex = (cState.curveIndex + 1) % CURVE_SEQUENCE.length;
      cState.currentCurve = cState.nextCurve;
      cState.nextCurve = CURVE_SEQUENCE[(cState.curveIndex + 1) % CURVE_SEQUENCE.length];
      debugLog(`[Curve] Now on: ${cState.currentCurve}, next: ${cState.nextCurve}`);
    }
    if (cState.cycleTime < CURVE_CYCLE_DURATION) {
      cState.transitionProgress = 0;
    } else {
      cState.transitionProgress = Math.min(
        1,
        (cState.cycleTime - CURVE_CYCLE_DURATION) / CURVE_TRANSITION_DURATION
      );
    }

    const INJECTION_INTERVAL = 45;
    const INJECTION_COUNT = 8;
    const INJECTION_MAGNITUDE_MIN = 0.25;
    const INJECTION_MAGNITUDE_MAX = 0.45;
    const injRef = injectionStateRef.current;
    injRef.timeSinceLastInjection += dt;

    if (injRef.timeSinceLastInjection >= INJECTION_INTERVAL) {
      injRef.timeSinceLastInjection = 0;
      const totalCards = allPhysicsRef.current.length;
      const selectedIndices = new Set<number>();
      while (selectedIndices.size < INJECTION_COUNT) {
        selectedIndices.add(Math.floor(Math.random() * totalCards));
      }

      selectedIndices.forEach((index) => {
        const physics = allPhysicsRef.current[index];
        const magnitude = INJECTION_MAGNITUDE_MIN + Math.random() * (INJECTION_MAGNITUDE_MAX - INJECTION_MAGNITUDE_MIN);
        const direction = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();

        const impulse = direction.multiplyScalar(magnitude);
        physics.velocity.add(impulse);
      });

      setInjectedCardIndices(selectedIndices);
      setTimeout(() => setInjectedCardIndices(new Set()), 500);
    }
  });
}
