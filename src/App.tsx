import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import CardDeck from './components/CardDeck';
import CardDetail from './components/CardDetail';
import Settings from './components/Settings';
import Header from './components/Header';
import { useStore } from './store/useStore';

function App() {
  const { selectedCard, showSettings } = useStore();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Header />

      {/* 3D Card Deck Scene */}
      {!selectedCard && (
        <Canvas
          camera={{ position: [0, 0, 10], fov: 50 }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9333ea" />
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
