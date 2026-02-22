import { useRef, useState } from 'react';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import type { CardProps } from './types';
import { useCardMotion } from './useCardMotion';
import { CardDeckCardVisual } from './CardDeckCardVisual';

export function CardDeckCard({
  card,
  initialPosition,
  initialRotation,
  index,
  physics,
  allPhysics,
  currentlyDraggingRef,
  phaseStateRef,
  curveStateRef,
  isInjected,
  mass,
  personality,
  currentRef,
}: CardProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { setSelectedCard, settings } = useStore();
  const showInfo = settings.showCardInfo !== false;

  const { dragging, handlePointerDown, handlePointerUp, hasDraggedRef } = useCardMotion({
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
  });

  useCursor(hovered && !dragging, 'grab');
  useCursor(dragging, 'grabbing');

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
        if (!hasDraggedRef.current) {
          e.stopPropagation();
          setSelectedCard(card);
        }
      }}
    >
      <CardDeckCardVisual
        card={card}
        hovered={hovered}
        dragging={dragging}
        isInjected={isInjected}
        showInfo={showInfo}
        selectedDeckType={settings.selectedDeckType}
        showCardNumbers={settings.showCardNumbers !== false}
      />
    </group>
  );
}
