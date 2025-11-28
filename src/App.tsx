import { useEffect } from 'react';
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
  const { selectedCard, showSettings } = useStore();

  useEffect(() => {
    // Set up database error notification callback
    setDatabaseErrorCallback((message: string, error: unknown) => {
      console.error('[App] Database error:', message, error);
      showError(message);
    });
  }, []);

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
