/**
 * Generic in-memory store with TTL and atomic consume().
 * Used for challenges, OAuth states, and exchange codes
 * where entries must be single-use (replay attack prevention).
 */
export class TtlStore<T> {
  private store = new Map<string, { value: T; expires: number }>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor(private ttlMs: number, cleanupIntervalMs = 60_000) {
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs)
    this.cleanupTimer.unref()
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs })
  }

  /** Atomically retrieve and delete an entry. Returns null if missing or expired. */
  consume(key: string): T | null {
    const entry = this.store.get(key)
    this.store.delete(key)
    if (!entry || Date.now() > entry.expires) return null
    return entry.value
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expires) this.store.delete(key)
    }
  }

  /** Visible for testing */
  get size(): number {
    return this.store.size
  }
}
