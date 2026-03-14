import * as route_0 from '../legacy-api/agents/create/route';
import * as route_1 from '../legacy-api/agents/delete/route';
import * as route_2 from '../legacy-api/agents/import/route';
import * as route_3 from '../legacy-api/agents/route';
import * as route_4 from '../legacy-api/agents/run/route';
import * as route_5 from '../legacy-api/analytics/file-ops/route';
import * as route_6 from '../legacy-api/analytics/nerd-stats/route';
import * as route_7 from '../legacy-api/analytics/tool-stats/route';
import * as route_8 from '../legacy-api/ask/route';
import * as route_9 from '../legacy-api/auth/route';
import * as route_10 from '../legacy-api/browser/status/route';
import * as route_11 from '../legacy-api/browser/traces/route';
import * as route_12 from '../legacy-api/chat/control/route';
import * as route_13 from '../legacy-api/chat/headless/route';
import * as route_14 from '../legacy-api/chat/route';
import * as route_15 from '../legacy-api/chat/snapshots/route';
import * as route_16 from '../legacy-api/chat/status/route';
import * as route_17 from '../legacy-api/commands/route';
import * as route_18 from '../legacy-api/config/custom-commands/route';
import * as route_19 from '../legacy-api/config/geminiignore/route';
import * as route_20 from '../legacy-api/config/route';
import * as route_21 from '../legacy-api/config/trusted-folders/route';
import * as route_22 from '../legacy-api/confirm/route';
import * as route_23 from '../legacy-api/custom-tools/route';
import * as route_24 from '../legacy-api/debug/storage/route';
import * as route_25 from '../legacy-api/directories/route';
import * as route_26 from '../legacy-api/extensions/route';
import * as route_27 from '../legacy-api/files/content/route';
import * as route_28 from '../legacy-api/files/route';
import * as route_29 from '../legacy-api/git/branch/route';
import * as route_30 from '../legacy-api/governance/steering/route';
import * as route_31 from '../legacy-api/governance/summary/route';
import * as route_32 from '../legacy-api/hooks/route';
import * as route_33 from '../legacy-api/mcp/gallery/route';
import * as route_34 from '../legacy-api/mcp/route';
import * as route_35 from '../legacy-api/memory/route';
import * as route_36 from '../legacy-api/models/route';
import * as route_37 from '../legacy-api/open/route';
import * as route_38 from '../legacy-api/presets/route';
import * as route_39 from '../legacy-api/queue/process/route';
import * as route_40 from '../legacy-api/queue/route';
import * as route_41 from '../legacy-api/queue/status/route';
import * as route_42 from '../legacy-api/quota/route';
import * as route_43 from '../legacy-api/resolve-model/route';
import * as route_44 from '../legacy-api/sessions/[id]/archive/route';
import * as route_45 from '../legacy-api/sessions/[id]/branch/route';
import * as route_46 from '../legacy-api/sessions/[id]/route';
import * as route_47 from '../legacy-api/sessions/core/route';
import * as route_48 from '../legacy-api/sessions/latest-stats/route';
import * as route_49 from '../legacy-api/sessions/route';
import * as route_50 from '../legacy-api/settings/route';
import * as route_51 from '../legacy-api/skills/route';
import * as route_52 from '../legacy-api/stats/route';
import * as route_53 from '../legacy-api/telemetry/route';
import * as route_54 from '../legacy-api/tool-output/stream/route';
import * as route_55 from '../legacy-api/tools/route';

import type { Express, Request as ExRequest, Response as ExResponse } from 'express';
import { NextRequest } from './mock-next-server';

function shouldIncludeBody(method: string) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

async function forwardWebResponse(res: ExResponse, webRes: Response) {
    res.status(webRes.status);
    webRes.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() === 'content-length') {
            return;
        }
        res.setHeader(key, value);
    });

    if (!webRes.body) {
        res.end();
        return;
    }

    const reader = webRes.body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            res.write(Buffer.from(value));
        }
    }
    res.end();
}

export function registerAutoRoutes(app: Express) {

    app.all('/api/agents/create', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_0 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/agents/delete', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_1 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/agents/import', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_2 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/agents', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_3 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/agents/run', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_4 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/analytics/file-ops', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_5 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/analytics/nerd-stats', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_6 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/analytics/tool-stats', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_7 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/ask', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_8 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/auth', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_9 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/browser/status', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_10 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/browser/traces', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_11 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/chat/control', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_12 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/chat/headless', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_13 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/chat', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_14 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/chat/snapshots', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_15 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/chat/status', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_16 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/commands', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_17 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/config/custom-commands', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_18 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/config/geminiignore', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_19 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/config', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_20 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/config/trusted-folders', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_21 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/confirm', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_22 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/custom-tools', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_23 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/debug/storage', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_24 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/directories', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_25 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/extensions', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_26 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/files/content', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_27 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/files', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_28 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/git/branch', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_29 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/governance/steering', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_30 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/governance/summary', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_31 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/hooks', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_32 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/mcp/gallery', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_33 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/mcp', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_34 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/memory', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_35 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/models', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_36 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/open', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_37 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/presets', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_38 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/queue/process', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_39 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/queue', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_40 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/queue/status', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_41 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/quota', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_42 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/resolve-model', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_43 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/sessions/:id/archive', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_44 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/sessions/:id/branch', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_45 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/sessions/:id', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_46 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/sessions/core', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_47 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/sessions/latest-stats', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_48 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/sessions', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_49 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/settings', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_50 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/skills', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_51 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/stats', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_52 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/telemetry', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_53 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/tool-output/stream', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_54 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });

    app.all('/api/tools', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (route_55 as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = `http://localhost:${req.socket.localPort}${req.originalUrl}`;
            const init: RequestInit = {
                method,
                headers: req.headers as HeadersInit,
            };
            
            if (shouldIncludeBody(method) && req.body) {
                init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
            
            const webReq = new NextRequest(url, init);
            // Some legacy handlers read req.nextUrl directly; define it as an own
            // property so we do not rely on Request subclass getter semantics.
            Object.defineProperty(webReq, 'nextUrl', {
                value: new URL(url),
                configurable: true,
                enumerable: false,
            });
            const webRes = await handler(webReq, { params: req.params });
            
            if (webRes) {
                await forwardWebResponse(res, webRes);
            } else {
                res.end();
            }
        } catch (error: any) {
            console.error('[Sidecar AutoRoute Error]', error);
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    });
}
