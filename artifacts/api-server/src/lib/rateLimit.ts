interface Attempt {
  count: number;
  windowResetAt: number;
  lockedUntil: number;
}

const store = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;

function prune(now: number): void {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.lockedUntil < now && entry.windowResetAt < now) {
      store.delete(key);
    }
  }
}

export interface RateLimitStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitStatus {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function registerFailure(key: string): void {
  const now = Date.now();
  prune(now);
  let entry = store.get(key);
  if (!entry || entry.windowResetAt < now) {
    entry = { count: 0, windowResetAt: now + WINDOW_MS, lockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
    entry.count = 0;
    entry.windowResetAt = now + WINDOW_MS;
  }
  store.set(key, entry);
}

export function clearRateLimit(key: string): void {
  store.delete(key);
}
