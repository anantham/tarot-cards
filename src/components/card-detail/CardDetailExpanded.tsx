import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { CardInterpretation, GeneratedCard, TarotCard } from '../../types';
import { CardDetailExpandedMediaColumn } from './CardDetailExpandedMediaColumn';
import { CardDetailExpandedInfoColumn } from './CardDetailExpandedInfoColumn';

type FlipOrientation = {
  targetAngle: 0 | 180;
  startAngle: number;
  startTilt: number;
};

type CardDetailExpandedProps = {
  selectedCard: TarotCard;
  interpretation: CardInterpretation;
  generatedCard?: GeneratedCard;
  allGenerations: GeneratedCard[];
  currentGenerationIndex: number;
  onPrevGeneration: () => void;
  onNextGeneration: () => void;
  onDeleteCurrent: () => void;
  onGenerateVideo: () => void;
  isGenerating: boolean;
  generationError?: string;
  promptText: string;
  setPromptText: Dispatch<SetStateAction<string>>;
  onSavePrompt: () => void;
  getTitle: () => string;
  flipOrientation: FlipOrientation;
  flipTrigger: number;
  loadedMediaRef: MutableRefObject<Set<string>>;
  onCardReady: (src: string) => void;
  totalCards: number;
  currentCardPosition: number;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  videoSrc?: string;
};

export function CardDetailExpanded(props: CardDetailExpandedProps) {
  return (
    <>
      <CardDetailExpandedMediaColumn
        selectedCard={props.selectedCard}
        generatedCard={props.generatedCard}
        allGenerations={props.allGenerations}
        currentGenerationIndex={props.currentGenerationIndex}
        onPrevGeneration={props.onPrevGeneration}
        onNextGeneration={props.onNextGeneration}
        onDeleteCurrent={props.onDeleteCurrent}
        onGenerateVideo={props.onGenerateVideo}
        isGenerating={props.isGenerating}
        generationError={props.generationError}
        keywords={props.interpretation.keywords}
        getTitle={props.getTitle}
        flipOrientation={props.flipOrientation}
        flipTrigger={props.flipTrigger}
        loadedMediaRef={props.loadedMediaRef}
        onCardReady={props.onCardReady}
        videoRef={props.videoRef}
        videoSrc={props.videoSrc}
      />

      <CardDetailExpandedInfoColumn
        selectedCard={props.selectedCard}
        interpretation={props.interpretation}
        totalCards={props.totalCards}
        currentCardPosition={props.currentCardPosition}
        getTitle={props.getTitle}
        promptText={props.promptText}
        setPromptText={props.setPromptText}
        onSavePrompt={props.onSavePrompt}
      />
    </>
  );
}
