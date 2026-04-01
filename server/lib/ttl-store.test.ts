import { describe, it, expect, vi } from 'vitest'
import { TtlStore } from './ttl-store.js'

describe('TtlStore', () => {
  it('stores and consumes a value', () => {
    const store = new TtlStore<string>(60_000)
    store.set('key1', 'value1')
    expect(store.consume('key1')).toBe('value1')
  })

  it('returns null on second consume (single-use)', () => {
    const store = new TtlStore<string>(60_000)
    store.set('key1', 'value1')
    expect(store.consume('key1')).toBe('value1')
    expect(store.consume('key1')).toBeNull()
  })

  it('returns null for missing keys', () => {
    const store = new TtlStore<string>(60_000)
    expect(store.consume('nonexistent')).toBeNull()
  })

  it('returns null for expired entries', () => {
    vi.useFakeTimers()
    try {
      const store = new TtlStore<string>(1000)
      store.set('key1', 'value1')
      vi.advanceTimersByTime(1001)
      expect(store.consume('key1')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cleans up expired entries on interval', () => {
    vi.useFakeTimers()
    try {
      const store = new TtlStore<string>(1000, 2000)
      store.set('key1', 'value1')
      store.set('key2', 'value2')
      expect(store.size).toBe(2)
      // Advance past TTL but before cleanup interval — entries still in map
      vi.advanceTimersByTime(1500)
      expect(store.size).toBe(2)
      // Advance to trigger cleanup interval
      vi.advanceTimersByTime(500)
      expect(store.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('works with object values', () => {
    const store = new TtlStore<{ redirectURI: string }>(60_000)
    store.set('state1', { redirectURI: 'https://example.com' })
    const result = store.consume('state1')
    expect(result).toEqual({ redirectURI: 'https://example.com' })
    expect(store.consume('state1')).toBeNull()
  })
})
