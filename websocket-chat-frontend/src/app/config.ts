declare const process: {
    env?: {
        NEXT_PUBLIC_API_BASE?: string;
    };
};

const envApiBase = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE)
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined;

const DEFAULT_API_BASE = 'http://localhost:8080';

export const API_BASE: string = envApiBase ?? DEFAULT_API_BASE;

let cachedResolvedApiBase: string | null = null;

export const getApiBase = async (): Promise<string> => {
    if (cachedResolvedApiBase) return cachedResolvedApiBase;
    // Prefer querying local ngrok API via our Next.js route to get the BE public URL
    try {
        const res = await fetch('/api/ngrok/be', { cache: 'no-store' });
        if (res.ok) {
            const data = (await res.json()) as { publicUrl?: string };
            if (data.publicUrl) {
                cachedResolvedApiBase = data.publicUrl;
                return cachedResolvedApiBase;
            }
        }
    } catch {
        // ignore and fall back
    }
    // Fallback to env var if provided
    if (envApiBase) return envApiBase;
    // Final fallback to localhost
    return DEFAULT_API_BASE;
};

export const withApiBase = (path: string): string => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${normalizedPath}`;
};

export const withApiBaseAsync = async (path: string): Promise<string> => {
    const base = await getApiBase();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
};


