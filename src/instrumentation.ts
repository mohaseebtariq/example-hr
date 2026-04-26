/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * Seeds the mock HCM store with fixture data so the first API request
 * hits a populated store without any per-route lazy-init logic.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { hcmStore } = await import('./lib/mock-hcm/store');
    const { seedStore } = await import('./lib/mock-hcm/fixtures');
    seedStore(hcmStore);
  }
}
