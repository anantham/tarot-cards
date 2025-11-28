import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGallerySharing } from '../hooks/useGallerySharing';
import type { GalleryBundle } from '../types';

interface CommunityGalleryProps {
  embedded?: boolean;
}

export default function CommunityGallery({ embedded = false }: CommunityGalleryProps) {
  const [galleries, setGalleries] = useState<GalleryBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCID, setLoadingCID] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { downloadGallery, error } = useGallerySharing();

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await fetch('/api/galleries?limit=50&offset=0');
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status} ${response.statusText})`);
      }
      const data = await response.json();
      setGalleries(data.galleries || []);
    } catch (err) {
      console.error('[CommunityGallery] Fetch failed:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load community galleries');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGallery = async (cid: string) => {
    setLoadingCID(cid);
    const count = await downloadGallery(cid);
    setLoadingCID(null);

    if (count > 0) {
      alert(`Successfully loaded ${count} cards from the community!`);
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
            {galleries.map((bundle) => (
              <motion.div
                key={bundle.cid}
                whileHover={{ scale: embedded ? 1.01 : 1.02 }}
                style={{
                  padding: '1.25rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
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
                    {bundle.author || 'Anonymous'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#e8e8e8',
                      opacity: 0.7,
                    }}
                  >
                    {bundle.cardCount} card{bundle.cardCount !== 1 ? 's' : ''}
                    {' • '}
                    {new Date(bundle.timestamp).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#e8e8e8',
                      opacity: 0.6,
                      marginBottom: '0.25rem',
                    }}
                  >
                    Decks:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {bundle.deckTypes.map((deck) => (
                      <span
                        key={deck}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(147, 51, 234, 0.2)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: '#e8e8e8',
                        }}
                      >
                        {deck}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleLoadGallery(bundle.cid)}
                  disabled={loadingCID === bundle.cid}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: loadingCID === bundle.cid
                      ? 'rgba(147, 51, 234, 0.3)'
                      : 'rgba(147, 51, 234, 0.5)',
                    border: '1px solid rgba(147, 51, 234, 0.7)',
                    borderRadius: '6px',
                    color: '#e8e8e8',
                    fontSize: '0.9rem',
                    cursor: loadingCID === bundle.cid ? 'wait' : 'pointer',
                  }}
                >
                  {loadingCID === bundle.cid ? '⏳ Loading...' : '📥 Load Gallery'}
                </button>

                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.7rem',
                    color: '#e8e8e8',
                    opacity: 0.5,
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bundle.cid}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
