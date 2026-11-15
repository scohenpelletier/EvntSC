/** Keys for any account-scoped data the browser may hold. Cleared on sign-out. */
export const PRIVATE_PREFIX = "evntsc:acct:";

export function clearPrivateClientState() {
  for (const store of [safe(() => window.localStorage), safe(() => window.sessionStorage)]) {
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PRIVATE_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {
      /* storage unavailable */
    }
  }
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
