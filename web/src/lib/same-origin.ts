/** Compare with the incoming host because Next.js may rewrite the request URL. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const url = URL.parse(origin);
  if (!url || !["http:", "https:"].includes(url.protocol)) return false;
  return url.host === (request.headers.get("host") ?? new URL(request.url).host);
}
