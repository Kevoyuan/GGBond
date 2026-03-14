import fs from 'fs';
import path from 'path';

const legacyApiDir = path.join(process.cwd(), 'legacy-api');
const outputFile = path.join(process.cwd(), 'src-sidecar/auto-routes.ts');

function findRouteFiles(dir: string, base: string = ''): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat && stat.isDirectory()) {
            results = results.concat(findRouteFiles(fullPath, path.join(base, file)));
        } else if (file === 'route.ts') {
            results.push(path.join(base, file));
        }
    }
    return results;
}

const routes = findRouteFiles(legacyApiDir);

let imports = '';
let registration = `import type { Express, Request as ExRequest, Response as ExResponse } from 'express';\n`;
registration += `import { NextRequest } from './mock-next-server';\n\n`;
registration += `function shouldIncludeBody(method: string) {\n`;
registration += `    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);\n`;
registration += `}\n\n`;
registration += `async function forwardWebResponse(res: ExResponse, webRes: Response) {\n`;
registration += `    res.status(webRes.status);\n`;
registration += `    webRes.headers.forEach((value: string, key: string) => {\n`;
registration += `        if (key.toLowerCase() === 'content-length') {\n`;
registration += `            return;\n`;
registration += `        }\n`;
registration += `        res.setHeader(key, value);\n`;
registration += `    });\n\n`;
registration += `    if (!webRes.body) {\n`;
registration += `        res.end();\n`;
registration += `        return;\n`;
registration += `    }\n\n`;
registration += `    const reader = webRes.body.getReader();\n`;
registration += `    while (true) {\n`;
registration += `        const { done, value } = await reader.read();\n`;
registration += `        if (done) break;\n`;
registration += `        if (value) {\n`;
registration += `            res.write(Buffer.from(value));\n`;
registration += `        }\n`;
registration += `    }\n`;
registration += `    res.end();\n`;
registration += `}\n\n`;
registration += `export function registerAutoRoutes(app: Express) {\n`;

let index = 0;
for (const route of routes) {
    const routeName = `route_${index++}`;
    // e.g. path is "skills/route.ts". API path should be "/api/skills"
    let apiPath = '/api/' + route.replace('/route.ts', '').replace(/\\/g, '/');
    if (apiPath === '/api/route.ts') apiPath = '/api'; // root /api if any

    // Handle dynamic segments like [id]
    apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1');

    imports += `import * as ${routeName} from '../legacy-api/${route.replace('.ts', '').replace(/\\/g, '/')}';\n`;

    registration += `
    app.all('${apiPath}', async (req: ExRequest, res: ExResponse) => {
        try {
            const method = req.method;
            const handler = (${routeName} as any)[method];
            
            if (!handler) {
                res.status(405).json({ error: 'Method Not Allowed' });
                return;
            }

            const url = \`http://localhost:\${req.socket.localPort}\${req.originalUrl}\`;
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
    });\n`;
}

registration += `}\n`;

fs.writeFileSync(outputFile, imports + '\n' + registration);
console.log(`Successfully generated auto-routes.ts with ${routes.length} endpoints.`);
