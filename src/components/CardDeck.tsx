import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard } from '../types';

interface CardProps {
  card: TarotCard;
  position: [number, number, number];
  rotation: [number, number, number];
  index: number;
}

function Card({ card, position, rotation }: CardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { setSelectedCard, settings } = useStore();

  // Random drift parameters for each card
  const driftParams = useMemo(() => ({
    speed: 0.3 + Math.random() * 0.4,
    xOffset: Math.random() * Math.PI * 2,
    yOffset: Math.random() * Math.PI * 2,
    zOffset: Math.random() * Math.PI * 2,
    xAmplitude: 0.3 + Math.random() * 0.5,
    yAmplitude: 0.2 + Math.random() * 0.4,
    zAmplitude: 0.1 + Math.random() * 0.3,
    rotSpeed: 0.1 + Math.random() * 0.2,
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;

    // Floating/drifting animation
    const x = position[0] + Math.sin(time * driftParams.speed + driftParams.xOffset) * driftParams.xAmplitude;
    const y = position[1] + Math.cos(time * driftParams.speed + driftParams.yOffset) * driftParams.yAmplitude;
    const z = position[2] + Math.sin(time * driftParams.speed * 0.5 + driftParams.zOffset) * driftParams.zAmplitude;

    meshRef.current.position.set(x, y, z);

    // Gentle rotation
    meshRef.current.rotation.x = rotation[0] + Math.sin(time * driftParams.rotSpeed) * 0.1;
    meshRef.current.rotation.y = rotation[1] + Math.cos(time * driftParams.rotSpeed) * 0.1;
    meshRef.current.rotation.z = rotation[2] + Math.sin(time * driftParams.rotSpeed * 0.5) * 0.05;

    // Hover effect - orient toward camera and scale up
    if (hovered) {
      meshRef.current.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.1);

      // Orient toward camera (not fully, just slightly)
      const currentRotation = new THREE.Euler().setFromQuaternion(meshRef.current.quaternion);
      const targetQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(currentRotation.x * 0.7, currentRotation.y * 0.7, 0)
      );
      meshRef.current.quaternion.slerp(targetQuaternion, 0.05);
    } else {
      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  // Get the card name based on selected deck type
  const getCardName = () => {
    const deckType = settings.selectedDeckType;
    if (deckType === 'lord-of-mysteries') return card.lordOfMysteries.pathway || card.traditional.name;
    if (deckType === 'traditional-rider-waite') return card.traditional.name;
    if (deckType === 'egyptian-tarot') return card.egyptian.deity || card.traditional.name;
    if (deckType === 'celtic-tarot') return card.celtic.figure || card.traditional.name;
    if (deckType === 'japanese-shinto') return card.shinto.kami || card.traditional.name;
    return card.traditional.name;
  };

  // Get a keyword to whisper on hover
  const getKeyword = () => {
    const deckType = settings.selectedDeckType;
    let keywords: string[] = [];

    if (deckType === 'lord-of-mysteries') keywords = card.lordOfMysteries.keywords;
    else if (deckType === 'traditional-rider-waite') keywords = card.traditional.keywords;
    else if (deckType === 'egyptian-tarot') keywords = card.egyptian.keywords;
    else if (deckType === 'celtic-tarot') keywords = card.celtic.keywords;
    else if (deckType === 'japanese-shinto') keywords = card.shinto.keywords;

    return keywords[Math.floor(Math.random() * keywords.length)] || 'mystery';
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={() => setSelectedCard(card)}
      >
        {/* Card body */}
        <boxGeometry args={[0.8, 1.2, 0.05]} />
        <meshStandardMaterial
          color={hovered ? '#9333ea' : '#1a1a2e'}
          emissive={hovered ? '#9333ea' : '#000000'}
          emissiveIntensity={hovered ? 0.5 : 0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Card number */}
      <Text
        position={[position[0], position[1] + 0.5, position[2] + 0.03]}
        fontSize={0.15}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
      >
        {card.number === 0 ? '0' : card.number}
      </Text>

      {/* Card name (shown on hover) */}
      {hovered && (
        <>
          <Text
            position={[position[0], position[1], position[2] + 0.03]}
            fontSize={0.08}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.7}
          >
            {getCardName()}
          </Text>

          {/* Whispered keyword */}
          <Text
            position={[position[0], position[1] - 0.4, position[2] + 0.03]}
            fontSize={0.06}
            color="#9333ea"
            anchorX="center"
            anchorY="middle"
          >
            "{getKeyword()}"
          </Text>
        </>
      )}
    </group>
  );
}

export default function CardDeck() {
  const cards = tarotData.cards as TarotCard[];

  // Generate random positions for cards in 3D space
  // Cards should be spread out but visible within camera view
  const cardPositions = useMemo(() => {
    return cards.map((_, index) => {
      // Create a spiral-like distribution
      const angle = (index / cards.length) * Math.PI * 4;
      const radius = 2 + (index % 3) * 1.5;

      return {
        position: [
          Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
          Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 3,
        ] as [number, number, number],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ] as [number, number, number],
      };
    });
  }, []);

  return (
    <group>
      {cards.map((card, index) => (
        <Card
          key={card.number}
          card={card}
          position={cardPositions[index].position}
          rotation={cardPositions[index].rotation}
          index={index}
        />
      ))}
    </group>
  );
}
