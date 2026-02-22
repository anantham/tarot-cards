import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useCardGeneration } from '../hooks/useCardGeneration';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard } from '../types';
import { debugLog } from '../utils/logger';
import { getInterpretationForDeck } from '../utils/deckInterpretation';
import { CardDetailModal } from './card-detail/CardDetailModal';
import { useVideoPlaybackFallback } from './card-detail/useVideoPlaybackFallback';

const START_TILT = -14;

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | undefined>(undefined);
  const [videoMuted, setVideoMuted] = useState(true);
  const [promptText, setPromptText] = useState<string>('');
  const [flipTrigger, setFlipTrigger] = useState(0);
  const [flipOrientation, setFlipOrientation] = useState(() => ({
    targetAngle: 0 as 0 | 180,
    startAngle: 0,
    startTilt: 0,
  }));
  const [isCardReady, setIsCardReady] = useState(false);
  const loadedMediaRef = useRef<Set<string>>(new Set());
  const triggerFlip = useCallback(() => {
    const revealInverted = Math.random() < 0.5;
    const newOrientation = {
      targetAngle: 0 as 0 | 180,
      startAngle: revealInverted ? 180 : 0,
      startTilt: revealInverted ? START_TILT : 0,
    };
    debugLog('[CardDetail] triggerFlip CALLED', {
      revealInverted,
      newOrientation,
      currentFlipTrigger: flipTrigger,
    });
    setFlipOrientation(newOrientation);
    setFlipTrigger((k) => {
      debugLog('[CardDetail] flipTrigger incremented', { old: k, new: k + 1 });
      return k + 1;
    });
  }, [flipTrigger]);

  useEffect(() => {
    setShowDetails(false);
    setCurrentGenerationIndex(0);
  }, [selectedCard?.number, settings.selectedDeckType]);

  if (!selectedCard) return null;

  const interpretation = getInterpretationForDeck(selectedCard, settings.selectedDeckType);
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
    debugLog('[CardDetail] useEffect[primaryMediaSrc] CHECK', {
      primaryMediaSrc: primaryMediaSrc?.slice(-40),
      lastMediaSrc: lastMediaSrcRef.current?.slice(-40),
      loadedMediaRefSize: loadedMediaRef.current.size,
      loadedMediaRefContents: Array.from(loadedMediaRef.current).map(s => s.slice(-30)),
    });

    if (!primaryMediaSrc) {
      debugLog('[CardDetail] useEffect[primaryMediaSrc] SKIP: no primaryMediaSrc');
      return;
    }
    if (primaryMediaSrc === lastMediaSrcRef.current) {
      debugLog('[CardDetail] useEffect[primaryMediaSrc] SKIP: same as lastMediaSrcRef');
      return;
    }

    debugLog('[CardDetail] useEffect[primaryMediaSrc] ACCEPTED: new media detected');
    lastMediaSrcRef.current = primaryMediaSrc;
    setIsCardReady(false);

    if (loadedMediaRef.current.has(primaryMediaSrc)) {
      debugLog('[CardDetail] media already in loadedMediaRef, skipping flip', { media: primaryMediaSrc.slice(-40) });
      setIsCardReady(true); // Already revealed, so mark ready immediately
      return;
    }

    debugLog('[CardDetail] TRIGGERING FLIP for new media', {
      media: primaryMediaSrc.slice(-40),
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
  const currentCardPosition = cards.findIndex((c) => c.number === selectedCard.number) + 1;

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

  useVideoPlaybackFallback({
    videoRef,
    videoUrl: generatedCard?.videoUrl,
    videoSrc,
    videoObjectUrl,
    setVideoObjectUrl,
    setVideoSrc,
    apiProvider: settings.apiProvider,
    geminiApiKey: settings.geminiApiKey,
  });

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
    <CardDetailModal
      navEnabled={navEnabled}
      onNavigatePrev={() => navigateCard(-1)}
      onNavigateNext={() => navigateCard(1)}
      onClose={closeDetail}
      selectedCardNumber={selectedCard.number}
      navDirection={navDirection}
      showDetails={showDetails}
      onToggleDetails={() => setShowDetails((prev) => !prev)}
      isCardReady={isCardReady}
      generatedCard={generatedCard}
      onDeleteCurrent={handleDeleteCurrent}
      selectedCard={selectedCard}
      videoSrc={videoSrc}
      videoRef={videoRef}
      videoMuted={videoMuted}
      setVideoMuted={setVideoMuted}
      getTitle={getTitle}
      flipOrientation={flipOrientation}
      flipTrigger={flipTrigger}
      loadedMediaRef={loadedMediaRef}
      onCardReady={handleCardReady}
      interpretation={interpretation}
      allGenerations={allGenerations}
      currentGenerationIndex={currentGenerationIndex}
      onPrevGeneration={handlePrevGeneration}
      onNextGeneration={handleNextGeneration}
      onGenerateVideo={() => generateVideo(selectedCard.number)}
      isGenerating={isGenerating}
      generationError={generationError ?? undefined}
      promptText={promptText}
      setPromptText={setPromptText}
      onSavePrompt={handleSavePrompt}
      totalCards={totalCards}
      currentCardPosition={currentCardPosition}
    />
  );
}
