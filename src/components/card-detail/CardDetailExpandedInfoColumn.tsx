import type { Dispatch, SetStateAction } from 'react';
import type { CardInterpretation, TarotCard } from '../../types';

type CardDetailExpandedInfoColumnProps = {
  selectedCard: TarotCard;
  interpretation: CardInterpretation;
  totalCards: number;
  currentCardPosition: number;
  getTitle: () => string;
  promptText: string;
  setPromptText: Dispatch<SetStateAction<string>>;
  onSavePrompt: () => void;
};

export function CardDetailExpandedInfoColumn({
  selectedCard,
  interpretation,
  totalCards,
  currentCardPosition,
  getTitle,
  promptText,
  setPromptText,
  onSavePrompt,
}: CardDetailExpandedInfoColumnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem' }}>
          Card {currentCardPosition} / {totalCards}
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

      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
          Personal Story
        </h3>
        <p
          style={{
            fontSize: '1rem',
            lineHeight: '1.6',
            opacity: selectedCard.personalLore.startsWith('FILL THIS') ? 0.5 : 0.8,
            fontStyle: selectedCard.personalLore.startsWith('FILL THIS') ? 'italic' : 'normal',
          }}
        >
          {selectedCard.personalLore}
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Generation Prompt
        </h3>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onBlur={onSavePrompt}
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
  );
}
