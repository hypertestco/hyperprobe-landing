const ZERPLY_EVENTS_URL = 'https://api.zerply.ai/ingest/crawler-events';
const ZERPLY_PATTERNS_URL = 'https://api.zerply.ai/ingest/crawler-patterns';
const PATTERN_TTL_MS = 60 * 60 * 1000;

const FALLBACK_CRAWLERS = new RegExp(
  'Amazonbot|Applebot|Bytespider|CCBot|ChatGPT-User|Claude-SearchBot|Claude-User|ClaudeBot|DuckAssistBot|Google-CloudVertexBot|GoogleOther|GPTBot|meta-externalagent|OAI-SearchBot|Perplexity-User|PerplexityBot',
  'i',
);

let crawlerRegex = FALLBACK_CRAWLERS;
let patternsFetchedAt = 0;
let patternRefresh: Promise<void> | undefined;

type RequestContext = {
  waitUntil(promise: Promise<unknown>): void;
};

function refreshCrawlerPatterns(): Promise<void> {
  if (patternRefresh) return patternRefresh;

  patternRefresh = fetch(ZERPLY_PATTERNS_URL)
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((body: { data?: { source?: unknown } }) => {
      const source = body.data?.source;
      if (typeof source !== 'string' || source.length === 0) return;

      crawlerRegex = new RegExp(source, 'i');
      patternsFetchedAt = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      patternRefresh = undefined;
    });

  return patternRefresh;
}

function continueRequest(): Response {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

export default function middleware(request: Request, context: RequestContext) {
  const userAgent = request.headers.get('user-agent') ?? '';

  if (!crawlerRegex.test(userAgent)) {
    return continueRequest();
  }

  if (Date.now() - patternsFetchedAt > PATTERN_TTL_MS) {
    context.waitUntil(refreshCrawlerPatterns());
  }

  const ingestionKey = process.env.ZERPLY_INGEST_KEY;
  if (ingestionKey) {
    const url = new URL(request.url);

    context.waitUntil(
      fetch(ZERPLY_EVENTS_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-zerply-key': ingestionKey,
        },
        body: JSON.stringify({
          events: [
            {
              ts: new Date().toISOString(),
              host: url.hostname,
              path: url.pathname,
              ua: userAgent,
            },
          ],
        }),
      }).catch(() => {}),
    );
  }

  return continueRequest();
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next(?:/|$)|_astro(?:/|$)|static(?:/|$)|images?(?:/|$)|fonts?(?:/|$)|favicon\\.ico$|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|woff2?|ttf|eot|map|xml|txt)$).*)',
  ],
};
