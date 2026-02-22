import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AmbientCurrentState, CardPhysics, CurveState, PhaseState } from './types';
import { applyCardVisualMotion, updateDraggingMotion, updateFreeMotion } from './motionUtils';

type UseCardMotionArgs = {
  index: number;
  physics: MutableRefObject<CardPhysics>;
  allPhysics: MutableRefObject<CardPhysics[]>;
  currentlyDraggingRef: MutableRefObject<number | null>;
  phaseStateRef: MutableRefObject<PhaseState>;
  curveStateRef: MutableRefObject<CurveState>;
  mass: number;
  personality: 'shy' | 'neutral' | 'curious';
  currentRef: MutableRefObject<AmbientCurrentState>;
  groupRef: MutableRefObject<THREE.Group | null>;
  hovered: boolean;
};

export function useCardMotion({
  index,
  physics,
  allPhysics,
  currentlyDraggingRef,
  phaseStateRef,
  curveStateRef,
  mass,
  personality,
  currentRef,
  groupRef,
  hovered,
}: UseCardMotionArgs) {
  const [dragging, setDragging] = useState(false);
  const { camera, pointer, raycaster } = useThree();
  const dragOffset = useRef(new THREE.Vector3());
  const lastDragPositionRef = useRef(new THREE.Vector3());
  const dragVelocityRef = useRef(new THREE.Vector3());
  const hasDraggedRef = useRef(false);
  const trailRef = useRef<THREE.Vector3[]>([]);
  const lastTrailSampleRef = useRef(0);
  const angularVelocity = useMemo(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      ),
    []
  );

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (currentlyDraggingRef.current !== null && currentlyDraggingRef.current !== index) {
      return;
    }
    e.stopPropagation();
    setDragging(true);
    hasDraggedRef.current = false;
    currentlyDraggingRef.current = index;

    const group = groupRef.current;
    if (!group) return;
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    dragOffset.current.copy(group.position).sub(intersectPoint);
    lastDragPositionRef.current.copy(group.position);
    dragVelocityRef.current.set(0, 0, 0);
    physics.current.velocity.set(0, 0, 0);
    physics.current.acceleration.set(0, 0, 0);
  }, [camera, groupRef, index, pointer, raycaster, physics, currentlyDraggingRef]);

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      physics.current.velocity.copy(dragVelocityRef.current).multiplyScalar(0.5);
    }
    currentlyDraggingRef.current = null;
    setDragging(false);
  }, [dragging, physics, currentlyDraggingRef]);

  useEffect(() => {
    const onWindowPointerUp = () => handlePointerUp();
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => window.removeEventListener('pointerup', onWindowPointerUp);
  }, [handlePointerUp]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const time = state.clock.elapsedTime;
    const dt = Math.max(Math.min(state.clock.getDelta(), 0.1), 0.016);
    const phaseVelocityMultiplier = phaseStateRef.current.velocityMultiplier;

    if (dragging) {
      updateDraggingMotion({
        dt,
        pointer,
        camera,
        raycaster,
        index,
        dragOffset: dragOffset.current,
        lastDragPositionRef,
        dragVelocityRef,
        hasDraggedRef,
        physics: physics.current,
        allPhysics: allPhysics.current,
      });
      group.position.copy(physics.current.position);
    } else {
      updateFreeMotion({
        group,
        time,
        dt,
        pointer,
        index,
        cardMass: mass,
        personality,
        phaseVelocityMultiplier,
        curveState: curveStateRef.current,
        currentDirection: currentRef.current.direction,
        currentStrength: currentRef.current.strength,
        physics: physics.current,
        allPhysics: allPhysics.current,
        trailRef,
        lastTrailSampleRef,
      });
    }

    applyCardVisualMotion({
      group,
      dt,
      pointer,
      angularVelocity,
      physics: physics.current,
      personality,
      hovered,
      dragging,
    });
  });

  return {
    dragging,
    handlePointerDown,
    handlePointerUp,
    hasDraggedRef,
  };
}
