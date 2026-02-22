import type { MutableRefObject } from 'react';
import { CardFlipImageInner } from '../CardFlipImageInner';
import type { GeneratedCard, TarotCard } from '../../types';

type FlipOrientation = {
  targetAngle: 0 | 180;
  startAngle: number;
  startTilt: number;
};

type CardDetailExpandedMediaColumnProps = {
  selectedCard: TarotCard;
  generatedCard?: GeneratedCard;
  allGenerations: GeneratedCard[];
  currentGenerationIndex: number;
  onPrevGeneration: () => void;
  onNextGeneration: () => void;
  onDeleteCurrent: () => void;
  onGenerateVideo: () => void;
  isGenerating: boolean;
  generationError?: string;
  keywords: string[];
  getTitle: () => string;
  flipOrientation: FlipOrientation;
  flipTrigger: number;
  loadedMediaRef: MutableRefObject<Set<string>>;
  onCardReady: (src: string) => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  videoSrc?: string;
};

export function CardDetailExpandedMediaColumn({
  selectedCard,
  generatedCard,
  allGenerations,
  currentGenerationIndex,
  onPrevGeneration,
  onNextGeneration,
  onDeleteCurrent,
  onGenerateVideo,
  isGenerating,
  generationError,
  keywords,
  getTitle,
  flipOrientation,
  flipTrigger,
  loadedMediaRef,
  onCardReady,
  videoRef,
  videoSrc,
}: CardDetailExpandedMediaColumnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '2/3',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0a0e27 100%)',
          borderRadius: '12px',
          border: '3px solid rgba(212, 175, 55, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {generatedCard?.gifUrl ? (
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
            <div style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
              Go to Settings to generate your personalized cards
            </div>
          </div>
        )}
      </div>

      {generatedCard?.videoUrl ? (
        <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '10px', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <button
          onClick={onGenerateVideo}
          disabled={isGenerating}
          style={{
            padding: '0.75rem 1.5rem',
            background: isGenerating ? 'rgba(100,100,100,0.4)' : 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? 'Generating video...' : 'Generate 8s Video (Veo 3.1)'}
        </button>
      )}

      {allGenerations.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem',
            background: 'rgba(147, 51, 234, 0.1)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '8px',
          }}
        >
          <button
            onClick={onPrevGeneration}
            disabled={currentGenerationIndex === 0}
            style={{
              padding: '0.5rem 1rem',
              background: currentGenerationIndex === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(147, 51, 234, 0.3)',
              border: '1px solid rgba(147, 51, 234, 0.4)',
              borderRadius: '6px',
              color: currentGenerationIndex === 0 ? 'rgba(255,255,255,0.3)' : '#e8e8e8',
              cursor: currentGenerationIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            ← Prev
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              Generation {currentGenerationIndex + 1} / {allGenerations.length}
            </span>
            {generatedCard && (
              <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                {new Date(generatedCard.timestamp).toLocaleDateString()}
              </span>
            )}
          </div>

          <button
            onClick={onNextGeneration}
            disabled={currentGenerationIndex >= allGenerations.length - 1}
            style={{
              padding: '0.5rem 1rem',
              background: currentGenerationIndex >= allGenerations.length - 1 ? 'rgba(0,0,0,0.2)' : 'rgba(147, 51, 234, 0.3)',
              border: '1px solid rgba(147, 51, 234, 0.4)',
              borderRadius: '6px',
              color: currentGenerationIndex >= allGenerations.length - 1 ? 'rgba(255,255,255,0.3)' : '#e8e8e8',
              cursor: currentGenerationIndex >= allGenerations.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Next →
          </button>
        </div>
      )}

      {generationError && (
        <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>
          {generationError}
        </div>
      )}

      {generatedCard && (
        <button
          onClick={onDeleteCurrent}
          style={{
            padding: '0.75rem',
            background: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid rgba(255, 0, 0, 0.4)',
            borderRadius: '8px',
            color: '#ff6b6b',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 0, 0.2)';
          }}
        >
          🗑️ Delete This Generation
        </button>
      )}

      <div>
        <h3 style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Keywords
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {keywords.map((keyword, i) => (
            <span
              key={i}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'rgba(147, 51, 234, 0.2)',
                border: '1px solid rgba(147, 51, 234, 0.4)',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
