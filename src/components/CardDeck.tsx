import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard } from '../types';
import { CURVE_SEQUENCE } from './card-deck/curves';
import { CardDeckCard } from './card-deck/CardDeckCard';
import { createInitialCardData, createInitialPhysics } from './card-deck/initialization';
import { useDeckAnimationController } from './card-deck/useDeckAnimationController';
import type {
  AmbientCurrentState,
  CardPhysics,
  CurveState,
  InjectionState,
  PhaseState,
} from './card-deck/types';

export default function CardDeck() {
  const cards = tarotData.cards as TarotCard[];
  const currentlyDraggingRef = useRef<number | null>(null);

  const phaseStateRef = useRef<PhaseState>({
    elapsedTime: 0,
    currentPhase: 'fast',
    velocityMultiplier: 1.0,
    transitionProgress: 1.0,
  });

  const injectionStateRef = useRef<InjectionState>({
    timeSinceLastInjection: 0,
  });

  const currentRef = useRef<AmbientCurrentState>({
    direction: new THREE.Vector3(1, 0.3, 0).normalize(),
    strength: 0,
    targetStrength: 0,
    changeTimer: 0,
  });

  const curveStateRef = useRef<CurveState>({
    currentCurve: CURVE_SEQUENCE[0],
    nextCurve: CURVE_SEQUENCE[1],
    transitionProgress: 1,
    cycleTime: 0,
    curveIndex: 0,
  });

  const [injectedCardIndices, setInjectedCardIndices] = useState<Set<number>>(new Set());

  const allPhysicsRef = useRef<CardPhysics[]>(createInitialPhysics(cards));
  const cardData = useMemo(() => createInitialCardData(cards), [cards]);
  const physicsRefs = useRef(
    cards.map((_, index) => ({
      current: allPhysicsRef.current[index],
    }))
  );

  useDeckAnimationController({
    allPhysicsRef,
    curveStateRef,
    phaseStateRef,
    currentRef,
    injectionStateRef,
    setInjectedCardIndices,
  });

  return (
    <group>
      {cards.map((card, index) => (
        <CardDeckCard
          key={card.number}
          card={card}
          initialPosition={cardData[index].position}
          initialRotation={cardData[index].rotation}
          index={index}
          physics={physicsRefs.current[index]}
          allPhysics={allPhysicsRef}
          currentlyDraggingRef={currentlyDraggingRef}
          phaseStateRef={phaseStateRef}
          curveStateRef={curveStateRef}
          isInjected={injectedCardIndices.has(index)}
          currentRef={currentRef}
          mass={allPhysicsRef.current[index].mass}
          personality={allPhysicsRef.current[index].personality}
        />
      ))}
    </group>
  );
}
