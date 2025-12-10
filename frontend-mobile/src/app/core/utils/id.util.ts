export function generateClientId(): string {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && typeof (globalThis as any).crypto.randomUUID === 'function') {
      return (globalThis as any).crypto.randomUUID();
    }
  } catch {}
  return `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
