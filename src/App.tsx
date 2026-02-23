import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import CardDeck from './components/CardDeck';
import CardDetail from './components/CardDetail';
import Settings from './components/Settings';
import Header from './components/Header';
import ErrorNotification, { showError } from './components/ErrorNotification';
import { useStore } from './store/useStore';
import { getAllGeneratedCards, setDatabaseErrorCallback } from './utils/idb';
import type { CommunityDeckGroup, CommunityGalleryRow } from './types';

function App() {
  const { selectedCard, showSettings, generatedCards, addGeneratedCard, setReturnToSettingsOnClose, settings } = useStore();
  const deckHydrationInFlightRef = useRef<string | null>(null);
  const hydratedDecksRef = useRef<Set<string>>(new Set());
  const prefetchedMediaRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Set up database error notification callback
    setDatabaseErrorCallback((message: string, error: unknown) => {
      console.error('[App] Database error:', message, error);
      showError(message);
    });
  }, []);

  useEffect(() => {
    // Warm card media in idle time so detail opens feel instant.
    if (typeof window === 'undefined') return;
    const selectedDeckType = settings.selectedDeckType;
    if (!selectedDeckType) return;

    const deckCards = generatedCards
      .filter((card) => card.deckType === selectedDeckType)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (deckCards.length === 0) return;

    const seenCards = new Set<number>();
    const urlsToPrefetch: string[] = [];
    deckCards.forEach((card) => {
      if (seenCards.has(card.cardNumber)) return;
      seenCards.add(card.cardNumber);
      const mediaUrl = card.gifUrl || card.frames?.[0];
      if (mediaUrl) urlsToPrefetch.push(mediaUrl);
    });

    const uncachedUrls = urlsToPrefetch.filter((url) => !prefetchedMediaRef.current.has(url));
    if (uncachedUrls.length === 0) return;

    const queuePrefetch = () => {
      uncachedUrls.forEach((url, index) => {
        setTimeout(() => {
          if (prefetchedMediaRef.current.has(url)) return;
          prefetchedMediaRef.current.add(url);
          const img = new Image();
          img.decoding = 'async';
          img.loading = 'eager';
          img.src = url;
        }, index * 60);
      });
    };

    if ('requestIdleCallback' in window) {
      (window as Window & {
        requestIdleCallback: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions
        ) => number;
      }).requestIdleCallback(() => queuePrefetch(), { timeout: 1500 });
      return;
    }

    const timer = setTimeout(queuePrefetch, 32);
    return () => clearTimeout(timer);
  }, [generatedCards, settings.selectedDeckType]);

  useEffect(() => {
    const selectedDeckType = settings.selectedDeckType;
    if (!selectedDeckType) return;
    if (deckHydrationInFlightRef.current === selectedDeckType) return;
    if (hydratedDecksRef.current.has(selectedDeckType)) return;

    let cancelled = false;
    deckHydrationInFlightRef.current = selectedDeckType;
    console.log(`[AutoImport] Starting startup hydration for deck "${selectedDeckType}"...`);

    (async () => {
      let hydrationComplete = false;
      try {
        const localCards = await getAllGeneratedCards().catch(() => []);
        const existingCardNumbers = new Set(
          [...localCards, ...generatedCards]
            .filter((card) => card.deckType === selectedDeckType)
            .map((card) => card.cardNumber)
        );

        if (existingCardNumbers.size >= 22) {
          console.log(`[AutoImport] Deck "${selectedDeckType}" already hydrated locally (${existingCardNumbers.size} cards).`);
          hydrationComplete = true;
          return;
        }

        const res = await fetch(`/api/community-supabase?deckType=${encodeURIComponent(selectedDeckType)}`);
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const data = (await res.json()) as { galleries?: CommunityGalleryRow[] };
        const rows = data.galleries || [];
        if (!rows.length) {
          hydrationComplete = true;
          return;
        }

        const byDeck = new Map<string, CommunityGalleryRow[]>();
        rows.forEach((row) => {
          const rowDeckType = row.deck_type || row.deckType || 'community';
          if (rowDeckType !== selectedDeckType) return;
          const key = row.deck_id || row.deckId;
          if (!key) return;
          if (!byDeck.has(key)) byDeck.set(key, []);
          byDeck.get(key)!.push(row);
        });

        const merged: Record<string, CommunityDeckGroup> = {};
        byDeck.forEach((cards, deckId) => {
          const sample = cards[0];
          const deckType = sample.deck_type || sample.deckType || selectedDeckType;
          const deckName = sample.deck_name || sample.deckName || deckType || 'Community Deck';
          const author = sample.author || 'Anonymous';
          const deckDescription = sample.deck_description || sample.deckDescription || '';
          const mergeKey = `${deckName}::${deckType}::${author}`;
          const stampedCards = cards.map((c): CommunityGalleryRow => ({
            ...c,
            deckType,
            deckName,
            deckDescription,
            author,
          }));
          const deckTimestamp = Math.max(...stampedCards.map((c) => c.timestamp || Date.now()));
          if (!merged[mergeKey]) {
            merged[mergeKey] = {
              id: mergeKey,
              deckId,
              deckType,
              deckName,
              deckDescription,
              author,
              timestamp: deckTimestamp,
              cards: stampedCards,
            };
          } else {
            merged[mergeKey].cards.push(...stampedCards);
            merged[mergeKey].timestamp = Math.max(merged[mergeKey].timestamp, deckTimestamp);
          }
        });

        const decks = Object.values(merged);
        if (!decks.length) {
          hydrationComplete = true;
          return;
        }

        const completeDecks = decks
          .filter((deck) => {
            const uniqueCardCount = new Set(
              (deck.cards || [])
                .map((card) => card.card_number ?? card.cardNumber)
                .filter((value): value is number => typeof value === 'number')
            ).size;
            return uniqueCardCount >= 22;
          })
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const fallbackDecks = decks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const chosen = completeDecks[0] || fallbackDecks[0];
        if (!chosen?.cards?.length) {
          hydrationComplete = true;
          return;
        }

        console.log(
          `[AutoImport] Hydrating "${selectedDeckType}" from "${chosen.deckName}" with ${chosen.cards.length} rows.`
        );

        let importedCount = 0;
        chosen.cards.forEach((bundle) => {
          const cardNumber = bundle.card_number ?? bundle.cardNumber;
          if (typeof cardNumber !== 'number') return;
          if (existingCardNumbers.has(cardNumber)) return;

          const prompt = bundle.prompt || null;
          const deckPromptSuffix = bundle.deck_prompt_suffix || bundle.deckPromptSuffix || null;
          addGeneratedCard({
            cardNumber,
            deckType: bundle.deckType ?? bundle.deck_type ?? selectedDeckType,
            frames: bundle.frames || [],
            gifUrl: bundle.gif_url ?? bundle.gifUrl,
            videoUrl: bundle.video_url ?? bundle.videoUrl,
            timestamp: bundle.timestamp || Date.now(),
            shared: true,
            source: 'community',
            bundleCID: bundle.cid || bundle.deck_id || chosen.deckId || undefined,
            prompt: prompt || undefined,
            deckPromptSuffix: deckPromptSuffix || undefined,
            deckId: bundle.deck_id ?? bundle.deckId ?? chosen.deckId ?? undefined,
            deckName: bundle.deck_name ?? bundle.deckName ?? chosen.deckName,
            deckDescription: bundle.deck_description ?? bundle.deckDescription ?? chosen.deckDescription,
            author: bundle.author || bundle.display_name || bundle.displayName || chosen.author,
          });
          existingCardNumbers.add(cardNumber);
          importedCount += 1;
        });

        if (importedCount > 0) {
          setReturnToSettingsOnClose(true);
          console.log(`[AutoImport] Imported ${importedCount} missing cards for "${selectedDeckType}".`);
        }

        hydrationComplete = true;
      } catch (err) {
        console.error('[AutoImport] Failed:', err);
      } finally {
        if (hydrationComplete) {
          hydratedDecksRef.current.add(selectedDeckType);
        }
        if (!cancelled && deckHydrationInFlightRef.current === selectedDeckType) {
          deckHydrationInFlightRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (deckHydrationInFlightRef.current === selectedDeckType) {
        deckHydrationInFlightRef.current = null;
      }
    };
  }, [addGeneratedCard, generatedCards, setReturnToSettingsOnClose, settings.selectedDeckType]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Header />

      {/* Error Notifications */}
      <ErrorNotification />

      {/* 3D Card Deck Scene - always mounted to preserve WebGL context and animation state */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        style={{
          background: 'transparent',
          // Hide but keep mounted when card detail is open
          visibility: selectedCard ? 'hidden' : 'visible',
          pointerEvents: selectedCard ? 'none' : 'auto',
        }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9333ea" />

        {/* Interactive Camera Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          minDistance={5}
          maxDistance={30}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 4}
          enabled={!selectedCard} // Disable controls when card detail is open
        />

        <CardDeck />
      </Canvas>

      {/* Card Detail View */}
      {selectedCard && <CardDetail />}

      {/* Settings Panel */}
      {showSettings && <Settings />}
    </div>
  );
}

export default App;
