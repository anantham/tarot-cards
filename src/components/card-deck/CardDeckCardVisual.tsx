import { useEffect } from 'react';
import { Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { TarotCard } from '../../types';
import { getCardNameForDeck, getRandomKeywordForDeck } from './cardInfo';

type CardDeckCardVisualProps = {
  card: TarotCard;
  hovered: boolean;
  dragging: boolean;
  isInjected: boolean;
  showInfo: boolean;
  selectedDeckType: string;
  showCardNumbers: boolean;
};

export function CardDeckCardVisual({
  card,
  hovered,
  dragging,
  isInjected,
  showInfo,
  selectedDeckType,
  showCardNumbers,
}: CardDeckCardVisualProps) {
  const cardBackTexture = useTexture('/card-back.png');
  useEffect(() => {
    if (cardBackTexture) {
      cardBackTexture.wrapS = THREE.ClampToEdgeWrapping;
      cardBackTexture.wrapT = THREE.ClampToEdgeWrapping;
      cardBackTexture.flipY = false;
    }
  }, [cardBackTexture]);

  return (
    <>
      <mesh scale={[1.05, 1.05, 0.07]} position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.05]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={hovered || dragging ? '#ffffff' : isInjected ? '#ff8a50' : '#ffffff'}
          emissiveIntensity={hovered ? 1.0 : dragging ? 1.1 : isInjected ? 1.2 : 0.5}
          transparent
          opacity={hovered || dragging ? 0.5 : 0.35}
          metalness={0.8}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        <boxGeometry args={[0.8, 1.2, 0.05]} />
        <meshStandardMaterial
          map={cardBackTexture}
          color={dragging ? '#ffffff' : hovered ? '#dddddd' : '#ffffff'}
          emissive={
            dragging ? '#7c3aed' :
            hovered ? '#9333ea' :
            isInjected ? '#ff6b35' :
            '#000000'
          }
          emissiveIntensity={
            dragging ? 0.8 :
            hovered ? 0.5 :
            isInjected ? 0.9 :
            0
          }
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {showInfo && (
        <Text
          position={[0, 0.5, 0.03]}
          fontSize={showCardNumbers ? 0.15 : 0.13}
          color={showCardNumbers ? '#d4af37' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
        >
          {showCardNumbers ? (card.number === 0 ? '0' : card.number) : '☆'}
        </Text>
      )}

      {(hovered || dragging) && showInfo && (
        <>
          <Text
            position={[0, 0, 0.03]}
            fontSize={0.08}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.7}
          >
            {getCardNameForDeck(card, selectedDeckType)}
          </Text>
          <Text
            position={[0, -0.4, 0.03]}
            fontSize={0.06}
            color="#9333ea"
            anchorX="center"
            anchorY="middle"
          >
            "{getRandomKeywordForDeck(card, selectedDeckType)}"
          </Text>
        </>
      )}
    </>
  );
}
