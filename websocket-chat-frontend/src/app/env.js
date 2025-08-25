// Expose API_BASE and NEXT_PUBLIC_API_BASE from a plain JS module.
// - Prefers NEXT_PUBLIC_API_BASE if defined at build time
// - Falls back to resolving ngrok BE public URL via /api/ngrok/be
// - Defaults to http://localhost:8080

/* eslint-disable no-undef */
const NEXT_PUBLIC_API_BASE = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE)
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined;

const DEFAULT_API_BASE = 'http://localhost:8080';

let __cachedApiBase = null;

export async function getApiBase() {
    if (NEXT_PUBLIC_API_BASE) return NEXT_PUBLIC_API_BASE;
    if (__cachedApiBase) return __cachedApiBase;
    try {
        const res = await fetch('/api/ngrok/be', { cache: 'no-store' });
        if (!res.ok) return DEFAULT_API_BASE;
        const data = await res.json();
        __cachedApiBase = data && data.publicUrl ? data.publicUrl : DEFAULT_API_BASE;
        return __cachedApiBase;
    } catch (e) {
        return DEFAULT_API_BASE;
    }
}

export function getNextPublicApiBase() {
    return NEXT_PUBLIC_API_BASE || null;
}

export async function getEnvBases() {
    const apiBase = await getApiBase();
    return {
        apiBase,
        nextPublicApiBase: getNextPublicApiBase(),
    };
}


