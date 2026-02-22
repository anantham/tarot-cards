import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { CardFlipImageInner } from '../CardFlipImageInner';
import type { GeneratedCard, TarotCard } from '../../types';

type FlipOrientation = {
  targetAngle: 0 | 180;
  startAngle: number;
  startTilt: number;
};

type CardDetailPreviewProps = {
  selectedCard: TarotCard;
  generatedCard?: GeneratedCard;
  videoSrc?: string;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  videoMuted: boolean;
  setVideoMuted: Dispatch<SetStateAction<boolean>>;
  getTitle: () => string;
  flipOrientation: FlipOrientation;
  flipTrigger: number;
  loadedMediaRef: MutableRefObject<Set<string>>;
  onCardReady: (src: string) => void;
  isCardReady: boolean;
};

export function CardDetailPreview({
  selectedCard,
  generatedCard,
  videoSrc,
  videoRef,
  videoMuted,
  setVideoMuted,
  getTitle,
  flipOrientation,
  flipTrigger,
  loadedMediaRef,
  onCardReady,
  isCardReady,
}: CardDetailPreviewProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, shineX: 50, shineY: 50 });

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '2/3',
          width: '100%',
          maxWidth: '500px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0a0e27 100%)',
          borderRadius: '14px',
          border: 'none',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          perspective: '1000px',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.15s ease',
          pointerEvents: isCardReady ? 'auto' : 'none',
        }}
        onMouseMove={(e) => {
          if (!isCardReady) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
          const y = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
          setTilt({
            x,
            y,
            shineX: ((e.clientX - rect.left) / rect.width) * 100,
            shineY: ((e.clientY - rect.top) / rect.height) * 100,
          });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0, shineX: 50, shineY: 50 })}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(600px circle at ${tilt.shineX}% ${tilt.shineY}%, rgba(255,255,255,0.12), transparent 40%)`,
            pointerEvents: 'none',
          }}
        />
        {generatedCard?.videoUrl && videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              loop
              playsInline
              muted={videoMuted}
              controls={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVideoMuted((current) => {
                  const next = !current;
                  if (videoRef.current) {
                    videoRef.current.muted = next;
                  }
                  return next;
                });
              }}
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                right: '0.5rem',
                padding: '0.35rem 0.5rem',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(0,0,0,0.45)',
                color: '#e8e8e8',
                fontSize: '0.85rem',
                cursor: 'pointer',
                opacity: 0.75,
              }}
            >
              {videoMuted ? '🔇' : '🔊'}
            </button>
          </>
        ) : generatedCard?.gifUrl ? (
          <CardFlipImageInner
            key={generatedCard.gifUrl}
            src={generatedCard.gifUrl}
            alt={getTitle()}
            startAngle={flipOrientation.startAngle}
            startTilt={flipOrientation.startTilt}
            targetAngle={flipOrientation.targetAngle}
            flipTrigger={flipTrigger}
            loadedMediaRef={loadedMediaRef}
            onReady={onCardReady}
          />
        ) : generatedCard?.frames?.[0] ? (
          <CardFlipImageInner
            key={generatedCard.frames[0]}
            src={generatedCard.frames[0]}
            alt={getTitle()}
            startAngle={flipOrientation.startAngle}
            startTilt={flipOrientation.startTilt}
            targetAngle={flipOrientation.targetAngle}
            flipTrigger={flipTrigger}
            loadedMediaRef={loadedMediaRef}
            onReady={onCardReady}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎴</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              {selectedCard.number === 0 ? '0' : selectedCard.number}
            </div>
            <div style={{ fontSize: '0.9rem' }}>Card not generated yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
