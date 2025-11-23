import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useCardGeneration } from '../hooks/useCardGeneration';
import tarotData from '../data/tarot-decks.json';
import type { TarotDeckData } from '../types';

const deckData = tarotData as TarotDeckData;

export default function Settings() {
  const {
    settings,
    updateSettings,
    setShowSettings,
    clearGeneratedCards,
    isGenerating,
  } = useStore();

  const { generateSingleCard, generateAllCards, error: generationError } = useCardGeneration();

  const [testCardNumber, setTestCardNumber] = useState(0);
  const [photoPreview, setPhotoPreview] = useState(settings.userPhoto);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        updateSettings({ userPhoto: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const estimateCost = (frames: number, cards: number = 22) => {
    const totalImages = frames * cards;
    const costPerImage = deckData.costEstimation['gemini-pro-1.5'].perImage;
    return (totalImages * costPerImage).toFixed(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(10, 14, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
      onClick={() => setShowSettings(false)}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
          borderRadius: '20px',
          border: '2px solid rgba(147, 51, 234, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'auto',
          padding: '2.5rem',
        }}
      >
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '700' }}>Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#e8e8e8',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Photo Upload Section */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Your Photo
            </h3>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '12px',
                  border: '2px solid rgba(147, 51, 234, 0.5)',
                  overflow: 'hidden',
                  background: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', opacity: 0.5 }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
                    <div style={{ fontSize: '0.8rem' }}>No photo</div>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.95rem', marginBottom: '1rem', opacity: 0.8, lineHeight: '1.5' }}>
                  Upload your photo to generate personalized tarot cards. This will be used as the base for all 22 cards, placing you in each archetypal role.
                </p>
                <label
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(147, 51, 234, 0.3)',
                    border: '1px solid rgba(147, 51, 234, 0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                  }}
                >
                  📁 Choose Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Deck Type Selection */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Deck Type
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deckData.deckTypes.map((deck) => (
                <label
                  key={deck.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: settings.selectedDeckType === deck.id ? 'rgba(147, 51, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${settings.selectedDeckType === deck.id ? 'rgba(147, 51, 234, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="deckType"
                    value={deck.id}
                    checked={settings.selectedDeckType === deck.id}
                    onChange={(e) => updateSettings({ selectedDeckType: e.target.value })}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {deck.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      {deck.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Generation Settings */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Generation Settings
            </h3>

            {/* API Key */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                OpenRouter API Key
              </label>
              <input
                type="password"
                value={settings.apiKey || ''}
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                placeholder="sk-or-v1-..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                }}
              />
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                Get your API key from{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#9333ea' }}>
                  openrouter.ai
                </a>
              </p>
            </div>

            {/* Frames per card */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Frames per Card (for animation)
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={settings.framesPerCard}
                onChange={(e) => updateSettings({ framesPerCard: parseInt(e.target.value) })}
                style={{ width: '100%', marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.7 }}>
                <span>{settings.framesPerCard} frames</span>
                <span>Est. cost for all 22 cards: ${estimateCost(settings.framesPerCard)}</span>
              </div>
            </div>

            {/* Prompt suffix */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Prompt Suffix (style modifiers)
              </label>
              <textarea
                value={settings.promptSuffix}
                onChange={(e) => updateSettings({ promptSuffix: e.target.value })}
                placeholder=", highly detailed, cinematic lighting..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                }}
              />
            </div>
          </section>

          {/* Test Generation */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Test Generation
            </h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.8 }}>
              Generate one card first to test your photo and prompt before generating all 22 cards.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                  Test Card Number (0-21)
                </label>
                <input
                  type="number"
                  min="0"
                  max="21"
                  value={testCardNumber}
                  onChange={(e) => setTestCardNumber(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                  }}
                />
              </div>
              <button
                onClick={() => generateSingleCard(testCardNumber)}
                disabled={isGenerating || !settings.apiKey}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: isGenerating || !settings.apiKey ? 'rgba(100, 100, 100, 0.3)' : 'rgba(147, 51, 234, 0.3)',
                  border: '1px solid rgba(147, 51, 234, 0.5)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: isGenerating || !settings.apiKey ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: isGenerating || !settings.apiKey ? 0.5 : 1,
                }}
              >
                {isGenerating ? 'Generating...' : `Generate 1 Card ($${estimateCost(settings.framesPerCard, 1)})`}
              </button>
            </div>
          </section>

          {/* Generate All */}
          <section>
            <div style={{
              padding: '1.5rem',
              background: 'rgba(147, 51, 234, 0.1)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              borderRadius: '12px',
            }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                Generate All 22 Cards
              </h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>
                This will generate all 22 Major Arcana cards with your photo. Make sure to test one card first!
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => generateAllCards()}
                  disabled={isGenerating || !settings.apiKey}
                  style={{
                    flex: 1,
                    padding: '1rem 2rem',
                    background: isGenerating || !settings.apiKey ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isGenerating || !settings.apiKey ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4)',
                    opacity: isGenerating || !settings.apiKey ? 0.6 : 1,
                  }}
                >
                  {isGenerating ? '⏳ Generating...' : `🎴 Generate All Cards ($${estimateCost(settings.framesPerCard)})`}
                </button>
                <button
                  onClick={() => {
                    if (confirm('This will delete all generated cards. Are you sure?')) {
                      clearGeneratedCards();
                    }
                  }}
                  style={{
                    padding: '1rem 1.5rem',
                    background: 'rgba(255, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 0, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                  }}
                >
                  🗑️ Clear Cache
                </button>
              </div>
            </div>
          </section>

          {/* Error Display */}
          {generationError && (
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: '8px',
              color: '#ff6b6b',
            }}>
              <strong>Error:</strong> {generationError}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
