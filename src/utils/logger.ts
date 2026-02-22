function readEnvDebugFlag(): boolean {
  const envValue = (import.meta as { env?: Record<string, unknown> }).env?.VITE_DEBUG_LOGS;
  if (typeof envValue === 'string') {
    const normalized = envValue.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function readStorageDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const value = window.localStorage.getItem('tarot:debugLogs');
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  } catch {
    return false;
  }
}

export function isDebugLoggingEnabled(): boolean {
  return readEnvDebugFlag() || readStorageDebugFlag();
}

export function debugLog(...args: unknown[]): void {
  if (!isDebugLoggingEnabled()) return;
  console.log(...args);
}
