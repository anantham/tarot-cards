import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useCardGeneration } from '../hooks/useCardGeneration';
import type { CardInterpretation } from '../types';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard } from '../types';
import { CardFlipImageInner } from './CardFlipImageInner';

const START_ANGLE = 180;
const START_TILT = -14;

type CardFlipImageProps = {
  src: string;
  alt: string;
  targetAngle: number;
  flipTrigger: number;
  loadedMediaRef: React.MutableRefObject<Set<string>>;
  onReady: (src: string) => void;
};

const CardFlipImage: React.FC<CardFlipImageProps> = React.memo(
  ({ src, alt, targetAngle, flipTrigger, loadedMediaRef, onReady }) => (
    <CardFlipImageInner
      key={src}
      src={src}
      alt={alt}
      startAngle={START_ANGLE}
      startTilt={START_TILT}
      targetAngle={targetAngle}
      flipTrigger={flipTrigger}
      loadedMediaRef={loadedMediaRef}
      onReady={onReady}
    />
  )
);

export default function CardDetail() {
  const {
    selectedCard,
    setSelectedCard,
    settings,
    getAllGenerationsForCard,
    deleteGeneratedCard,
    generatedCards,
    updateGeneratedCard,
    isGenerating,
    returnToSettingsOnClose,
    setReturnToSettingsOnClose,
    setShowSettings,
  } = useStore();
  const { generateVideo, error: generationError } = useCardGeneration();
  const cards = tarotData.cards as TarotCard[];
  const totalCards = cards.length;
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [currentGenerationIndex, setCurrentGenerationIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const navEnabled = settings.navigateWithArrows === true;
  const [tilt, setTilt] = useState({ x: 0, y: 0, shineX: 50, shineY: 50 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | undefined>(undefined);
  const [videoMuted, setVideoMuted] = useState(true);
  const [promptText, setPromptText] = useState<string>('');
  const [flipTrigger, setFlipTrigger] = useState(0);
  const [flipOrientation, setFlipOrientation] = useState(() => ({
    targetAngle: 180 as 0 | 180,
  }));
  const [isCardReady, setIsCardReady] = useState(false);
  const loadedMediaRef = useRef<Set<string>>(new Set());
  const triggerFlip = useCallback(() => {
    const revealInverted = Math.random() < 0.5;
    setFlipOrientation({
      targetAngle: revealInverted ? 180 : 0,
    });
    console.log('[CardDetail] triggerFlip', { revealInverted });
    setFlipTrigger((k) => k + 1);
  }, []);

  useEffect(() => {
    setShowDetails(false);
    setCurrentGenerationIndex(0);
  }, [selectedCard?.number, settings.selectedDeckType]);

  if (!selectedCard) return null;

  // Get the correct interpretation based on selected deck type
  const getInterpretation = (): CardInterpretation => {
    const deckType = settings.selectedDeckType;
    if (deckType === 'lord-of-mysteries-masterpiece') {
      return selectedCard.lordOfMysteriesMasterpiece || selectedCard.lordOfMysteries;
    }
    if (deckType === 'lord-of-mysteries') return selectedCard.lordOfMysteries;
    if (deckType === 'traditional-rider-waite') return selectedCard.traditional;
    if (deckType === 'egyptian-tarot') return selectedCard.egyptian;
    if (deckType === 'celtic-tarot') return selectedCard.celtic;
    if (deckType === 'japanese-shinto') return selectedCard.shinto;
    if (deckType === 'advaita-vedanta') return selectedCard.advaita;
    return selectedCard.traditional;
  };

  const interpretation = getInterpretation();
  // Prefer generations for the selected deck; fall back to any deck that has this card number
  const primaryGenerations = getAllGenerationsForCard(selectedCard.number, settings.selectedDeckType);
  const fallbackGenerations = useMemo(() => {
    if (primaryGenerations.length > 0) return primaryGenerations;
    return generatedCards
      .filter((c) => c.cardNumber === selectedCard.number)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [primaryGenerations, generatedCards, selectedCard.number]);

  const allGenerations = primaryGenerations.length > 0 ? primaryGenerations : fallbackGenerations;
  const generatedCard = allGenerations[currentGenerationIndex];

  // Default prompt for this card/deck (from tarot data) as fallback
  const defaultPrompt = useMemo(() => {
    const deckType = settings.selectedDeckType;
    if (!selectedCard) return '';
    if (deckType === 'lord-of-mysteries-masterpiece') return selectedCard.lordOfMysteriesMasterpiece?.prompt || '';
    if (deckType === 'lord-of-mysteries') return selectedCard.lordOfMysteries?.prompt || '';
    if (deckType === 'traditional-rider-waite') return selectedCard.traditional?.prompt || '';
    if (deckType === 'egyptian-tarot') return selectedCard.egyptian?.prompt || '';
    if (deckType === 'celtic-tarot') return selectedCard.celtic?.prompt || '';
    if (deckType === 'japanese-shinto') return selectedCard.shinto?.prompt || '';
    if (deckType === 'advaita-vedanta') return selectedCard.advaita?.prompt || '';
    return '';
  }, [selectedCard, settings.selectedDeckType]);

  useEffect(() => {
    setPromptText(generatedCard?.prompt || defaultPrompt || '');
  }, [generatedCard?.prompt, defaultPrompt, generatedCard?.timestamp]);

  // Memoized primary media src (gif preferred, else first frame)
  const primaryMediaSrc = useMemo(
    () => generatedCard?.gifUrl || generatedCard?.frames?.[0] || null,
    [generatedCard?.gifUrl, generatedCard?.frames]
  );
  const lastMediaSrcRef = useRef<string | null>(null);
  const handleCardReady = useCallback((_src: string) => {
    setIsCardReady(true);
  }, []);

  // Trigger flip once when the displayed media changes (strictly when URL changes)
  useEffect(() => {
    if (!primaryMediaSrc) return;
    if (primaryMediaSrc === lastMediaSrcRef.current) return;
    lastMediaSrcRef.current = primaryMediaSrc;
    setIsCardReady(false);
    if (loadedMediaRef.current.has(primaryMediaSrc)) {
      console.log('[CardDetail] media already loaded, skipping flip', { media: primaryMediaSrc });
      return;
    }
    console.log('[CardDetail] media changed, triggering flip', {
      media: primaryMediaSrc,
      isGif: !!generatedCard?.gifUrl,
    });
    triggerFlip();
  }, [primaryMediaSrc, triggerFlip, generatedCard?.gifUrl]);

  useEffect(() => {
    // cleanup blob URL when switching videos
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
        setVideoObjectUrl(undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedCard?.videoUrl]);

  useEffect(() => {
    if (!generatedCard?.videoUrl) {
      setVideoSrc(undefined);
      return;
    }
    // Try to append API key for Gemini file downloads if not present
    const hasKeyParam = generatedCard.videoUrl.includes('key=');
    const signedUrl =
      !hasKeyParam && settings.apiProvider === 'gemini' && settings.geminiApiKey
        ? `${generatedCard.videoUrl}${generatedCard.videoUrl.includes('?') ? '&' : '?'}key=${encodeURIComponent(settings.geminiApiKey)}`
        : generatedCard.videoUrl;
    setVideoSrc(signedUrl);
  }, [generatedCard?.videoUrl, settings.apiProvider, settings.geminiApiKey]);

  const handleDeleteCurrent = () => {
    if (!generatedCard) return;
    const ok = window.confirm('Delete this card from your gallery?');
    if (!ok) return;
    deleteGeneratedCard(generatedCard.timestamp);

    // After deletion, adjust index or close if none remain
    const remaining = allGenerations.filter((c) => c.timestamp !== generatedCard.timestamp);
    if (remaining.length === 0) {
      setSelectedCard(null);
      return;
    }
    if (currentGenerationIndex >= remaining.length) {
      setCurrentGenerationIndex(remaining.length - 1);
    }
  };

  const handleSavePrompt = () => {
    if (!generatedCard) return;
    const updated = { ...generatedCard, prompt: promptText };
    updateGeneratedCard(updated);
  };

  const handlePrevGeneration = () => {
    setCurrentGenerationIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextGeneration = () => {
    setCurrentGenerationIndex((prev) => Math.min(allGenerations.length - 1, prev + 1));
  };

  const getTitle = () => {
    return interpretation.name || interpretation.pathway || interpretation.deity || interpretation.figure || interpretation.kami || 'Unknown';
  };

  const closeDetail = () => {
    setSelectedCard(null);
    if (returnToSettingsOnClose) {
      setShowSettings(true);
    }
    setReturnToSettingsOnClose(false);
  };

  const navigateCard = (step: number) => {
    const currentIndex = cards.findIndex((c) => c.number === selectedCard.number);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + step + totalCards) % totalCards;
    setNavDirection(step >= 0 ? 1 : -1);
    setSelectedCard(cards[nextIndex]);
  };

  useEffect(() => {
    return () => setReturnToSettingsOnClose(false);
  }, [setReturnToSettingsOnClose]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const onError = () => {
      const err = videoEl.error;
      console.error('[Video] playback error', {
        code: err?.code,
        message: err?.message,
        videoUrl: videoSrc,
      });
      // Fallback: try fetching with API key and play from blob
      if (settings.apiProvider === 'gemini' && settings.geminiApiKey && videoSrc && videoSrc.startsWith('https://')) {
        fetch(videoSrc, {
          headers: {
            'x-goog-api-key': settings.geminiApiKey,
          },
        })
          .then(async (resp) => {
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
            const blob = await resp.blob();
            if (videoObjectUrl) {
              URL.revokeObjectURL(videoObjectUrl);
            }
            const url = URL.createObjectURL(blob);
            setVideoObjectUrl(url);
            setVideoSrc(url);
          })
          .catch((fetchErr) => {
            console.error('[Video] fallback fetch error', fetchErr);
          });
      }
    };
    const onLoaded = () => {
      console.log('[Video] loaded metadata', {
        duration: videoEl.duration,
        readyState: videoEl.readyState,
        videoUrl: videoSrc,
      });
    };
    videoEl.addEventListener('error', onError);
    videoEl.addEventListener('loadedmetadata', onLoaded);
    return () => {
      videoEl.removeEventListener('error', onError);
      videoEl.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [generatedCard?.videoUrl]);

  useEffect(() => {
    if (!navEnabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateCard(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateCard(-1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCard, totalCards, navEnabled]);

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
      onClick={closeDetail}
    >
      {/* Nav buttons (optional) */}
      {navEnabled && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <button
            aria-label="Previous card"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); navigateCard(-1); }}
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
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); navigateCard(1); }}
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
        key={selectedCard.number}
        initial={{ scale: 0.85, rotateY: 90 }}
        animate={{ scale: 1, rotateY: 0, x: navDirection * 10 }}
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
            onClick={() => setShowDetails((prev) => !prev)}
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
              onClick={handleDeleteCurrent}
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
                setTilt({ x, y, shineX: ((e.clientX - rect.left) / rect.width) * 100, shineY: ((e.clientY - rect.top) / rect.height) * 100 });
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
                      setVideoMuted((m) => !m);
                      if (videoRef.current) {
                        videoRef.current.muted = !videoMuted;
                      }
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
                <img
                  src={generatedCard.gifUrl}
                  alt={getTitle()}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : generatedCard?.frames?.[0] ? (
                <img
                  src={generatedCard.frames[0]}
                  alt={getTitle()}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
        )}
        {showDetails && (
          <>
        {/* Left side - Card Image */}
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
              <CardFlipImage
                src={generatedCard.gifUrl}
                alt={getTitle()}
                targetAngle={flipOrientation.targetAngle}
                flipTrigger={flipTrigger}
                loadedMediaRef={loadedMediaRef}
                onReady={handleCardReady}
              />
            ) : generatedCard?.frames?.[0] ? (
              <CardFlipImage
                src={generatedCard.frames[0]}
                alt={getTitle()}
                targetAngle={flipOrientation.targetAngle}
                flipTrigger={flipTrigger}
                loadedMediaRef={loadedMediaRef}
                onReady={handleCardReady}
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

            {/* Video display / CTA */}
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
                onClick={() => generateVideo(selectedCard.number)}
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
                {isGenerating ? 'Generating video…' : 'Generate 8s Video (Veo 3.1)'}
              </button>
            )}

            {/* Generation Navigation - only show if there are generated cards */}
            {allGenerations.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem',
              background: 'rgba(147, 51, 234, 0.1)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              borderRadius: '8px',
            }}>
              <button
                onClick={handlePrevGeneration}
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
                onClick={handleNextGeneration}
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

            {/* Prompt editor */}
            {/* Delete button - only show if there is a generated card */}
            {generatedCard && (
              <button
                onClick={handleDeleteCurrent}
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

          {/* Keywords */}
          <div>
            <h3 style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Keywords
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {interpretation.keywords.map((keyword, i) => (
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

        {/* Right side - Card Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header */}
          <div>
            <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem' }}>
              Card {cards.findIndex((c) => c.number === selectedCard.number) + 1} / {totalCards}
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#d4af37' }}>
              {getTitle()}
            </h2>
            {interpretation.sequence && (
              <div style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                {interpretation.sequence}
              </div>
            )}
          </div>

          {/* Meaning */}
          {interpretation.meaning && (
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
                Traditional Meaning
              </h3>
              <p style={{ fontSize: '1rem', lineHeight: '1.6', opacity: 0.8 }}>
                {interpretation.meaning}
              </p>
            </div>
          )}

          {/* Abilities (for LoTM) */}
          {interpretation.abilities && (
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
                Abilities
              </h3>
              <p style={{ fontSize: '1rem', lineHeight: '1.6', opacity: 0.8 }}>
                {interpretation.abilities}
              </p>
            </div>
          )}

          {/* Personal Lore */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
              Personal Story
            </h3>
            <p style={{
              fontSize: '1rem',
              lineHeight: '1.6',
              opacity: selectedCard.personalLore.startsWith('FILL THIS') ? 0.5 : 0.8,
              fontStyle: selectedCard.personalLore.startsWith('FILL THIS') ? 'italic' : 'normal',
            }}>
              {selectedCard.personalLore}
            </p>
          </div>

          {/* Prompt Editor */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', opacity: 0.9 }}>
              Generation Prompt
            </h3>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onBlur={handleSavePrompt}
              rows={6}
              style={{
                width: '100%',
                padding: '0.9rem 1rem',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                borderRadius: '10px',
                color: '#e8e8e8',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'monospace',
              }}
              placeholder="Edit the generation prompt for this card"
            />
            <div style={{ fontSize: '0.85rem', opacity: 0.65, marginTop: '0.35rem' }}>
              Changes save on blur. Future uploads/share will include this prompt.
            </div>
          </div>
        </div>

          </>
        )}
      </motion.div>
    </motion.div>
  );
}
