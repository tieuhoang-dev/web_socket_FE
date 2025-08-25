// Standalone tester for src/app/env.js
// Usage:
//   TEST_BASE=http://localhost:3000 NEXT_PUBLIC_API_BASE= node scripts/test-env.mjs
// If NEXT_PUBLIC_API_BASE is set, it will be used directly. Otherwise this script
// will call your running Next.js app at TEST_BASE to resolve ngrok URL via /api/ngrok/be.

const BASE = process.env.TEST_BASE || 'http://localhost:3000';

// Ensure relative fetch URLs work in Node by prefixing with BASE
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : input;
    return originalFetch(url, init);
};

const { getApiBase, getNextPublicApiBase, getEnvBases } = await import('../src/app/env.js');

async function main() {
    const nextPublic = getNextPublicApiBase();
    const apiBase = await getApiBase();
    const both = await getEnvBases();

    console.log('TEST_BASE           =', BASE);
    console.log('NEXT_PUBLIC_API_BASE=', nextPublic);
    console.log('getApiBase()        =', apiBase);
    console.log('getEnvBases()       =', both);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});



