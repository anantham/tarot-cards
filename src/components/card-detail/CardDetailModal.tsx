import { motion } from 'framer-motion';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { CardInterpretation, GeneratedCard, TarotCard } from '../../types';
import { CardDetailPreview } from './CardDetailPreview';
import { CardDetailExpanded } from './CardDetailExpanded';

type FlipOrientation = {
  targetAngle: 0 | 180;
  startAngle: number;
  startTilt: number;
};

type CardDetailModalProps = {
  navEnabled: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onClose: () => void;
  selectedCardNumber: number;
  navDirection: 1 | -1;
  showDetails: boolean;
  onToggleDetails: () => void;
  isCardReady: boolean;
  generatedCard?: GeneratedCard;
  onDeleteCurrent: () => void;
  selectedCard: TarotCard;
  videoSrc?: string;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  videoMuted: boolean;
  setVideoMuted: Dispatch<SetStateAction<boolean>>;
  getTitle: () => string;
  flipOrientation: FlipOrientation;
  flipTrigger: number;
  loadedMediaRef: MutableRefObject<Set<string>>;
  onCardReady: (src: string) => void;
  interpretation: CardInterpretation;
  allGenerations: GeneratedCard[];
  currentGenerationIndex: number;
  onPrevGeneration: () => void;
  onNextGeneration: () => void;
  onGenerateVideo: () => void;
  isGenerating: boolean;
  generationError?: string;
  promptText: string;
  setPromptText: Dispatch<SetStateAction<string>>;
  onSavePrompt: () => void;
  totalCards: number;
  currentCardPosition: number;
};

export function CardDetailModal({
  navEnabled,
  onNavigatePrev,
  onNavigateNext,
  onClose,
  selectedCardNumber,
  navDirection,
  showDetails,
  onToggleDetails,
  isCardReady,
  generatedCard,
  onDeleteCurrent,
  selectedCard,
  videoSrc,
  videoRef,
  videoMuted,
  setVideoMuted,
  getTitle,
  flipOrientation,
  flipTrigger,
  loadedMediaRef,
  onCardReady,
  interpretation,
  allGenerations,
  currentGenerationIndex,
  onPrevGeneration,
  onNextGeneration,
  onGenerateVideo,
  isGenerating,
  generationError,
  promptText,
  setPromptText,
  onSavePrompt,
  totalCards,
  currentCardPosition,
}: CardDetailModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(10, 14, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
      onClick={onClose}
    >
      {navEnabled && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <button
            aria-label="Previous card"
            onClick={(e) => {
              e.stopPropagation();
              onNavigatePrev();
            }}
            style={{
              position: 'absolute',
              left: '1.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.25)',
              color: '#e8e8e8',
              fontSize: '1.2rem',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            ←
          </button>
          <button
            aria-label="Next card"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateNext();
            }}
            style={{
              position: 'absolute',
              right: '1.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.25)',
              color: '#e8e8e8',
              fontSize: '1.2rem',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            →
          </button>
        </div>
      )}

      <motion.div
        key={selectedCardNumber}
        initial={{ scale: 0.85 }}
        animate={{ scale: 1, x: navDirection * 10 }}
        transition={{ type: 'spring', duration: 0.7 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: showDetails ? '1200px' : '720px',
          width: '100%',
          maxHeight: '90vh',
          background: showDetails ? 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)' : 'transparent',
          borderRadius: showDetails ? '20px' : '0',
          border: showDetails ? '2px solid rgba(147, 51, 234, 0.3)' : 'none',
          boxShadow: showDetails ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(147, 51, 234, 0.3)' : 'none',
          overflow: showDetails ? 'auto' : 'visible',
          display: showDetails ? 'grid' : 'flex',
          gridTemplateColumns: showDetails ? '1fr 1fr' : undefined,
          gap: showDetails ? '2rem' : undefined,
          padding: showDetails ? '3rem' : '0',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.35rem' }}>
          <button
            onClick={() => {
              if (!isCardReady) return;
              onToggleDetails();
            }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.05)',
              color: 'rgba(255,255,255,0.25)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            aria-label={showDetails ? 'Hide details' : 'Show details'}
            title={showDetails ? 'Hide details' : 'Show details'}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
            }}
          >
            👁
          </button>
          {generatedCard && showDetails && (
            <button
              onClick={onDeleteCurrent}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,0,0,0.12)',
                color: '#ffb4b4',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              aria-label="Delete this card"
              title="Delete this card"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,0,0,0.25)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,0,0,0.12)';
                e.currentTarget.style.color = '#ffb4b4';
              }}
            >
              🗑
            </button>
          )}
        </div>

        {!showDetails && (
          <CardDetailPreview
            selectedCard={selectedCard}
            generatedCard={generatedCard}
            videoSrc={videoSrc}
            videoRef={videoRef}
            videoMuted={videoMuted}
            setVideoMuted={setVideoMuted}
            getTitle={getTitle}
            flipOrientation={flipOrientation}
            flipTrigger={flipTrigger}
            loadedMediaRef={loadedMediaRef}
            onCardReady={onCardReady}
            isCardReady={isCardReady}
          />
        )}

        {showDetails && (
          <CardDetailExpanded
            selectedCard={selectedCard}
            interpretation={interpretation}
            generatedCard={generatedCard}
            allGenerations={allGenerations}
            currentGenerationIndex={currentGenerationIndex}
            onPrevGeneration={onPrevGeneration}
            onNextGeneration={onNextGeneration}
            onDeleteCurrent={onDeleteCurrent}
            onGenerateVideo={onGenerateVideo}
            isGenerating={isGenerating}
            generationError={generationError}
            promptText={promptText}
            setPromptText={setPromptText}
            onSavePrompt={onSavePrompt}
            getTitle={getTitle}
            flipOrientation={flipOrientation}
            flipTrigger={flipTrigger}
            loadedMediaRef={loadedMediaRef}
            onCardReady={onCardReady}
            totalCards={totalCards}
            currentCardPosition={currentCardPosition}
            videoRef={videoRef}
            videoSrc={videoSrc}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
