// Polyfill for Next.js Server Request/Response classes in raw Node.js/Express
export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit) {
        const headers = new Headers(init?.headers);
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        return new Response(JSON.stringify(body), {
            ...init,
            headers,
        });
    }

    static redirect(url: string | URL, status: number = 307) {
        return new Response(null, {
            status,
            headers: {
                Location: url.toString()
            }
        });
    }
}

export class NextRequest extends Request {
    constructor(input: URL | RequestInfo, init?: RequestInit) {
        super(input, init);
    }

    get nextUrl() {
        return new URL(this.url);
    }
}
