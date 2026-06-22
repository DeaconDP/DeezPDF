import type { Connect, Plugin } from 'vite';

export const PDF_PROXY_PATH = '/api/pdf-download';

const MAX_BYTES = 200 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0.0.0.0') return true;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }

  return false;
}

function isPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

async function fetchRemotePdf(target: URL): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/pdf,*/*;q=0.8',
        ...(target.hostname.endsWith('archive.org')
          ? { Referer: 'https://archive.org/' }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const chunks: Buffer[] = [];
    let total = 0;

    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.byteLength > MAX_BYTES) {
        throw new Error('PDF exceeds size limit');
      }
      if (!isPdfBuffer(buffer) && !contentType.includes('pdf')) {
        throw new Error('Response is not a PDF');
      }
      return { buffer, contentType };
    }

    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > MAX_BYTES) {
        throw new Error('PDF exceeds size limit');
      }
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    if (!isPdfBuffer(buffer) && !contentType.includes('pdf')) {
      throw new Error('Response is not a PDF');
    }

    return { buffer, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function createProxyMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const requestUrl = req.url ?? '';
    if (!requestUrl.startsWith(PDF_PROXY_PATH)) {
      next();
      return;
    }

    void (async () => {
      try {
        const parsed = new URL(requestUrl, 'http://127.0.0.1');
        const rawTarget = parsed.searchParams.get('url')?.trim();
        if (!rawTarget) {
          res.statusCode = 400;
          res.end('Missing url parameter');
          return;
        }

        let target: URL;
        try {
          target = new URL(rawTarget);
        } catch {
          res.statusCode = 400;
          res.end('Invalid url');
          return;
        }

        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
          res.statusCode = 400;
          res.end('Only http and https URLs are supported');
          return;
        }

        if (isPrivateHost(target.hostname)) {
          res.statusCode = 403;
          res.end('Target host is not allowed');
          return;
        }

        const { buffer, contentType } = await fetchRemotePdf(target);
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType.includes('pdf') ? contentType : 'application/pdf');
        res.setHeader('Content-Length', String(buffer.byteLength));
        res.setHeader('Cache-Control', 'no-store');
        res.end(buffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Download failed';
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(message);
      }
    })();
  };
}

export function pdfDownloadProxy(): Plugin {
  const middleware = createProxyMiddleware();
  return {
    name: 'pdf-download-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
