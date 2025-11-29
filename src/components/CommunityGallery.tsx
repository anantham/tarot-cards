import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import type { GeneratedCard } from '../types';

interface CommunityGalleryProps {
  embedded?: boolean;
}

export default function CommunityGallery({ embedded = false }: CommunityGalleryProps) {
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCID, setLoadingCID] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { addGeneratedCard, setSelectedCard, setReturnToSettingsOnClose } = useStore();

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await fetch('/api/community-supabase');
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status} ${response.statusText})`);
      }
      const data = await response.json();
      const rows = data.galleries || [];
      // Group by deck_id; fallback to timestamp-based id if missing
      const byDeck: Record<string, any> = {};
      rows.forEach((row: any) => {
        const id = row.deck_id || row.deckId || `deck-${row.timestamp}`;
        if (!byDeck[id]) {
          byDeck[id] = {
            id,
            deckId: id,
            deckName: row.deck_name || row.deckName || 'Community Deck',
            deckDescription: row.deck_description || row.deckDescription || '',
            author: row.author || 'Anonymous',
            timestamp: row.timestamp || Date.now(),
            cards: [],
          };
        }
        byDeck[id].cards.push(row);
      });
      setGalleries(Object.values(byDeck));
    } catch (err) {
      console.error('[CommunityGallery] Fetch failed:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load community galleries');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSupabaseCard = async (bundle: any) => {
    try {
      setLoadingCID(bundle.id || bundle.cid || `${bundle.card_number}-${bundle.timestamp}`);
      const prompt = bundle.prompt || null;
      const deckPromptSuffix = bundle.deck_prompt_suffix || bundle.deckPromptSuffix || null;

      // Build a GeneratedCard from Supabase metadata
      const generated: GeneratedCard = {
        cardNumber: bundle.card_number ?? bundle.cardNumber,
        deckType: bundle.deck_type ?? bundle.deckType,
        frames: bundle.frames || [],
        gifUrl: bundle.gif_url ?? bundle.gifUrl,
        videoUrl: bundle.video_url ?? bundle.videoUrl,
        timestamp: bundle.timestamp || Date.now(),
        shared: true,
        source: 'community',
        bundleCID: bundle.cid || undefined,
        prompt: prompt || undefined,
        deckPromptSuffix: deckPromptSuffix || undefined,
      };
      addGeneratedCard(generated);
      setSelectedCard(null);
      setReturnToSettingsOnClose(true);
      alert(`Imported card ${generated.cardNumber} from community.`);
    } catch (err) {
      console.error('[CommunityGallery] Import error:', err);
      alert('Failed to import this card.');
    } finally {
      setLoadingCID(null);
    }
  };

  const handleImportAll = async () => {
    try {
      if (galleries.length === 0) return;
      setLoadingCID('all');
      galleries.forEach((deck) => {
        (deck.cards || []).forEach((bundle: any) => {
          const prompt = bundle.prompt || null;
          const deckPromptSuffix = bundle.deck_prompt_suffix || bundle.deckPromptSuffix || null;

          const generated: GeneratedCard = {
            cardNumber: bundle.card_number ?? bundle.cardNumber,
            deckType: bundle.deck_type ?? bundle.deckType,
            frames: bundle.frames || [],
            gifUrl: bundle.gif_url ?? bundle.gifUrl,
            videoUrl: bundle.video_url ?? bundle.videoUrl,
            timestamp: bundle.timestamp || Date.now(),
            shared: true,
            source: 'community',
            bundleCID: bundle.cid || bundle.deck_id || undefined,
            prompt: prompt || undefined,
            deckPromptSuffix: deckPromptSuffix || undefined,
          };
          addGeneratedCard(generated);
        });
      });
      setSelectedCard(null);
      setReturnToSettingsOnClose(true);
      alert(`Imported ${galleries.reduce((sum, d) => sum + (d.cards?.length || 0), 0)} cards from community.`);
    } catch (err) {
      console.error('[CommunityGallery] Import all error:', err);
      alert('Failed to import community deck.');
    } finally {
      setLoadingCID(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: embedded ? 'auto' : '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e8e8e8',
          padding: embedded ? '1rem' : undefined,
        }}
      >
        <div>Loading community galleries...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: embedded ? 'auto' : '100vh',
        padding: embedded ? '1rem' : '2rem',
        background: embedded ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(to bottom, #1a0b2e, #2d1b4e)',
        borderRadius: embedded ? '12px' : undefined,
      }}
    >
      <div style={{ maxWidth: embedded ? '100%' : '1200px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: embedded ? '1.6rem' : '2.5rem',
            marginBottom: embedded ? '0.75rem' : '1rem',
            color: '#ffd1d1',
            textAlign: embedded ? 'left' : 'center',
          }}
        >
          🌐 Community Gallery
        </h1>

        <p
          style={{
            textAlign: embedded ? 'left' : 'center',
            marginBottom: embedded ? '1rem' : '2rem',
            color: '#e8e8e8',
            opacity: 0.8,
          }}
        >
          Browse and load tarot card collections shared by the community
        </p>

        {fetchError && (
          <div
            style={{
              padding: '1rem',
              marginBottom: embedded ? '0.75rem' : '1rem',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: '8px',
              color: '#ff6b6b',
            }}
          >
            Error loading galleries: {fetchError}
            <button
              onClick={fetchGalleries}
              style={{
                marginLeft: '0.75rem',
                padding: '0.35rem 0.6rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#e8e8e8',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
          }}>
            Error: {error}
          </div>
        )}

        {galleries.length === 0 ? (
          <div
            style={{
              textAlign: embedded ? 'left' : 'center',
              padding: embedded ? '1rem 0' : '3rem',
              color: '#e8e8e8',
              opacity: 0.6,
            }}
          >
            No community galleries yet. Be the first to share!
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {galleries.map((deck) => (
              <motion.div
                key={deck.id}
                whileHover={{ scale: embedded ? 1.01 : 1.02 }}
                style={{
                  padding: '1.25rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: loadingCID === deck.id ? 'wait' : 'pointer',
                }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      color: '#ffd1d1',
                      marginBottom: '0.35rem',
                    }}
                  >
                    {deck.deckName || 'Community Deck'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#e8e8e8',
                      opacity: 0.7,
                    }}
                  >
                    {deck.cards?.length || 0} card{(deck.cards?.length || 0) !== 1 ? 's' : ''} • {deck.author || 'Anonymous'}
                  </div>
                  {deck.deckDescription && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#e8e8e8', opacity: 0.7 }}>
                      {deck.deckDescription}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setLoadingCID(deck.id);
                    deck.cards?.forEach((bundle: any) => handleLoadSupabaseCard(bundle));
                    setLoadingCID(null);
                  }}
                  disabled={loadingCID === deck.id}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: loadingCID === deck.id
                      ? 'rgba(147, 51, 234, 0.3)'
                      : 'rgba(147, 51, 234, 0.5)',
                    border: '1px solid rgba(147, 51, 234, 0.7)',
                    borderRadius: '6px',
                    color: '#e8e8e8',
                    fontSize: '0.9rem',
                    cursor: loadingCID === deck.id ? 'wait' : 'pointer',
                  }}
                >
                  {loadingCID === deck.id ? '⏳ Importing…' : '📥 Import Deck'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
