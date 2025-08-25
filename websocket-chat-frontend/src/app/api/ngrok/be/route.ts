type NgrokTunnel = {
    name?: string;
    public_url?: string;
    proto?: string;
    config?: {
        addr?: string | number;
    };
};

type NgrokApiResponse = {
    tunnels?: NgrokTunnel[];
};

export async function GET() {
    try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels', { cache: 'no-store' });
        if (!res.ok) {
            return new Response(JSON.stringify({ error: 'Failed to query ngrok API' }), {
                status: 502,
                headers: { 'content-type': 'application/json' },
            });
        }

        const data = (await res.json()) as NgrokApiResponse;
        const tunnels = data.tunnels || [];

        // Prefer HTTPS tunnel for BE; fall back to HTTP
        const isBackendTunnel = (t: NgrokTunnel) => {
            const name = (t.name || '').toLowerCase();
            const addr = (t.config?.addr ?? '').toString();
            const byName = name === 'be' || name.includes('be');
            const byAddr = addr === '8080' || addr.endsWith(':8080') || addr.endsWith('//localhost:8080') || addr.endsWith('//127.0.0.1:8080');
            return byName || byAddr;
        };

        const httpsBe = tunnels.find((t) => isBackendTunnel(t) && (t.proto || '').toLowerCase() === 'https');
        const httpBe = tunnels.find((t) => isBackendTunnel(t) && (t.proto || '').toLowerCase() === 'http');
        const beTunnel = httpsBe || httpBe;

        if (!beTunnel || !beTunnel.public_url) {
            return new Response(JSON.stringify({ error: 'BE tunnel not found' }), {
                status: 404,
                headers: { 'content-type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ publicUrl: beTunnel.public_url }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Unable to reach local ngrok API' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        });
    }
}


