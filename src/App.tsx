import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import CardDeck from './components/CardDeck';
import CardDetail from './components/CardDetail';
import Settings from './components/Settings';
import Header from './components/Header';
import ErrorNotification, { showError } from './components/ErrorNotification';
import { useStore } from './store/useStore';
import { setDatabaseErrorCallback } from './utils/idb';

function App() {
  const { selectedCard, showSettings, generatedCards, addGeneratedCard, setReturnToSettingsOnClose, settings, updateSettings } = useStore();
  const autoImportStarted = useRef(false);

  useEffect(() => {
    // Set up database error notification callback
    setDatabaseErrorCallback((message: string, error: unknown) => {
      console.error('[App] Database error:', message, error);
      showError(message);
    });
  }, []);

  useEffect(() => {
    // Auto-import a community deck on first load if the user has no cards yet.
    if (generatedCards.length > 0) return;
    if (autoImportStarted.current) return;
    if (typeof window !== 'undefined' && window.localStorage.getItem('communityImportedOnce') === '1') return;

    autoImportStarted.current = true;
    console.log('[AutoImport] Starting first-load import...');
    (async () => {
      try {
        const res = await fetch('/api/community-supabase');
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const data = await res.json();
        const rows = data?.galleries || [];
        if (!rows.length) return;

        // Group by deck_id (skip uncategorized for auto-import)
        const byDeck = new Map<string, any[]>();
        rows.forEach((row: any) => {
          const key = row.deck_id || row.deckId;
          if (!key) return; // ignore uncategorized for auto-import
          if (!byDeck.has(key)) byDeck.set(key, []);
          byDeck.get(key)!.push(row);
        });

        // Merge decks that share name/type/author to avoid splits
        const merged: Record<string, any> = {};
        byDeck.forEach((cards, deckId) => {
          const sample = cards[0];
          const deckType = sample.deck_type || sample.deckType || 'community';
          const deckName = sample.deck_name || sample.deckName || deckType || 'Community Deck';
          const author = sample.author || 'Anonymous';
          const deckDescription = sample.deck_description || sample.deckDescription || '';
          const mergeKey = `${deckName}::${deckType}::${author}`;
          const stampedCards = cards.map((c: any) => ({
            ...c,
            deckType,
            deckName,
            deckDescription,
            author,
          }));
          const deckTimestamp = Math.max(...stampedCards.map((c: any) => c.timestamp || Date.now()));
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

        const decks = Object.values(merged) as any[];
        if (!decks.length) return;

        // Prefer complete decks (>=22 cards), pick the most recent
        const completeDecks = decks
          .filter((d) => (d.cards?.length || 0) >= 22)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const fallbackDecks = decks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const chosen = completeDecks[0] || fallbackDecks[0];
        if (!chosen?.cards?.length) return;

        console.log(
          `[AutoImport] Found ${decks.length} merged decks; importing "${chosen.deckName}" with ${chosen.cards.length} cards (complete=${
            chosen.cards.length >= 22
          }).`
        );

        let importedDeckType: string | undefined = chosen.deckType;
        chosen.cards.forEach((bundle: any, idx: number) => {
          const prompt = bundle.prompt || null;
          const deckPromptSuffix = bundle.deck_prompt_suffix || bundle.deckPromptSuffix || null;
          addGeneratedCard({
            cardNumber: bundle.card_number ?? bundle.cardNumber,
            deckType: bundle.deckType ?? bundle.deck_type ?? importedDeckType,
            frames: bundle.frames || [],
            gifUrl: bundle.gif_url ?? bundle.gifUrl,
            videoUrl: bundle.video_url ?? bundle.videoUrl,
            timestamp: bundle.timestamp || Date.now(),
            shared: true,
            source: 'community',
            bundleCID: bundle.cid || bundle.deck_id || chosen.deckId || undefined,
            prompt: prompt || undefined,
            deckPromptSuffix: deckPromptSuffix || undefined,
            deckId: bundle.deck_id ?? bundle.deckId ?? chosen.deckId,
            deckName: bundle.deck_name ?? bundle.deckName ?? chosen.deckName,
            deckDescription: bundle.deck_description ?? bundle.deckDescription ?? chosen.deckDescription,
            author: bundle.author || bundle.display_name || bundle.displayName || chosen.author,
          });
          console.log(
            `[AutoImport] Added card ${idx + 1}/${chosen.cards.length}: #${bundle.card_number ?? bundle.cardNumber}`
          );
        });

        setReturnToSettingsOnClose(true);
        // If the user had no cards, align the selected deck to the imported deck type to avoid "not generated yet" view.
        if (!settings.selectedDeckType && importedDeckType) {
          updateSettings({ selectedDeckType: importedDeckType });
        }
        console.log('[AutoImport] Import completed.');
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('communityImportedOnce', '1');
        }
      } catch (err) {
        console.error('[AutoImport] Failed:', err);
      } finally {
        autoImportStarted.current = false;
      }
    })();
  }, [generatedCards.length, addGeneratedCard, setReturnToSettingsOnClose]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Header />

      {/* Error Notifications */}
      <ErrorNotification />

      {/* 3D Card Deck Scene */}
      {!selectedCard && (
        <Canvas
          camera={{ position: [0, 0, 10], fov: 50 }}
          style={{ background: 'transparent' }}
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
          />

          <CardDeck />
        </Canvas>
      )}

      {/* Card Detail View */}
      {selectedCard && <CardDetail />}

      {/* Settings Panel */}
      {showSettings && <Settings />}
    </div>
  );
}

export default App;
