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
  const { selectedCard, showSettings, generatedCards, addGeneratedCard, setReturnToSettingsOnClose } = useStore();
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
    (async () => {
      try {
        const res = await fetch('/api/community-supabase');
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const data = await res.json();
        const rows = data?.galleries || [];
        if (!rows.length) return;

        // Group by deck_id (or fallback bucket for uncategorized)
        const byDeck = new Map<string, any[]>();
        rows.forEach((row: any) => {
          const key = row.deck_id || row.deckId || `uncategorized-${row.deck_type || 'community'}`;
          if (!byDeck.has(key)) byDeck.set(key, []);
          byDeck.get(key)!.push(row);
        });

        const firstDeck = Array.from(byDeck.values())[0];
        if (!firstDeck?.length) return;

        firstDeck.forEach((bundle: any) => {
          const prompt = bundle.prompt || null;
          const deckPromptSuffix = bundle.deck_prompt_suffix || bundle.deckPromptSuffix || null;
          addGeneratedCard({
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
            deckId: bundle.deck_id ?? bundle.deckId,
            deckName: bundle.deck_name ?? bundle.deckName,
            deckDescription: bundle.deck_description ?? bundle.deckDescription,
            author: bundle.author || bundle.display_name || bundle.displayName,
          });
        });

        setReturnToSettingsOnClose(true);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('communityImportedOnce', '1');
        }
      } catch (err) {
        console.error('[App] Auto-import community deck failed:', err);
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
