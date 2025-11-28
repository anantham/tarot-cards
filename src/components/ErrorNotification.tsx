import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorMessage {
  id: number;
  message: string;
  timestamp: number;
}

let errorQueue: ErrorMessage[] = [];
let notifyCallback: ((errors: ErrorMessage[]) => void) | null = null;

export function showError(message: string) {
  const error: ErrorMessage = {
    id: Date.now(),
    message,
    timestamp: Date.now(),
  };
  errorQueue.push(error);
  if (notifyCallback) {
    notifyCallback([...errorQueue]);
  }

  // Auto-remove after 10 seconds
  setTimeout(() => {
    errorQueue = errorQueue.filter((e) => e.id !== error.id);
    if (notifyCallback) {
      notifyCallback([...errorQueue]);
    }
  }, 10000);
}

export default function ErrorNotification() {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);

  useEffect(() => {
    notifyCallback = setErrors;
    return () => {
      notifyCallback = null;
    };
  }, []);

  const removeError = (id: number) => {
    errorQueue = errorQueue.filter((e) => e.id !== id);
    setErrors([...errorQueue]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      <AnimatePresence>
        {errors.map((error) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            style={{
              background: 'rgba(220, 38, 38, 0.95)',
              color: 'white',
              padding: '16px 20px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
                ⚠️ Database Error
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>{error.message}</div>
            </div>
            <button
              onClick={() => removeError(error.id)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                lineHeight: '1',
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
