/**
 * Turns an untrusted `next` value into a same-origin path. The value is resolved
 * the way a browser would (so tricks like "//evil", "/\evil", tabs or encoded
 * slashes that normalize to another host are caught), and anything that lands on
 * a different origin falls back to `fallback`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/plans"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  const base = "https://app.internal";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  const path = url.pathname + url.search + url.hash;
  // Belt and braces: the normalized result must itself be a single-slash path.
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}
