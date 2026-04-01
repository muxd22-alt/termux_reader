import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchProgress, emitProgress, markFeedDone, getFeedState } from './progress.js'

beforeEach(() => {
  vi.useFakeTimers()
  fetchProgress.removeAllListeners()
})

afterEach(() => {
  vi.useRealTimers()
})

// --- emitProgress ---

describe('emitProgress', () => {
  it('sets feed state on feed-articles-found', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 5 })
    expect(getFeedState(1)).toEqual({ total: 5, fetched: 0, done: false })
  })

  it('updates feed state on article-done', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 5 })
    emitProgress({ type: 'article-done', feed_id: 1, fetched: 3, total: 5 })
    expect(getFeedState(1)).toEqual({ total: 5, fetched: 3, done: false })
  })

  it('does not update state on feed-complete (no state change)', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 5 })
    emitProgress({ type: 'feed-complete', feed_id: 1 })
    // State remains from feed-articles-found
    expect(getFeedState(1)).toEqual({ total: 5, fetched: 0, done: false })
  })

  it('emits event on fetchProgress EventEmitter', () => {
    const handler = vi.fn()
    fetchProgress.on('event', handler)

    const event = { type: 'feed-articles-found' as const, feed_id: 1, total: 10 }
    emitProgress(event)

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('tracks multiple feeds independently', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 3 })
    emitProgress({ type: 'feed-articles-found', feed_id: 2, total: 7 })

    expect(getFeedState(1)).toEqual({ total: 3, fetched: 0, done: false })
    expect(getFeedState(2)).toEqual({ total: 7, fetched: 0, done: false })
  })
})

// --- markFeedDone ---

describe('markFeedDone', () => {
  it('sets done flag to true', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 5 })
    markFeedDone(1)
    expect(getFeedState(1)!.done).toBe(true)
  })

  it('does not throw for unknown feed id', () => {
    expect(() => markFeedDone(999)).not.toThrow()
  })

  it('cleans up state after 10 seconds', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 5 })
    markFeedDone(1)

    expect(getFeedState(1)).toBeDefined()

    vi.advanceTimersByTime(10_000)

    expect(getFeedState(1)).toBeUndefined()
  })

  it('state persists before 10 second timeout', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 5 })
    markFeedDone(1)

    vi.advanceTimersByTime(9_999)
    expect(getFeedState(1)).toBeDefined()
  })
})

// --- getFeedState ---

describe('getFeedState', () => {
  it('returns undefined for unknown feed id', () => {
    expect(getFeedState(123)).toBeUndefined()
  })

  it('returns current state for tracked feed', () => {
    emitProgress({ type: 'feed-articles-found', feed_id: 1, total: 10 })
    emitProgress({ type: 'article-done', feed_id: 1, fetched: 5, total: 10 })

    const state = getFeedState(1)
    expect(state).toEqual({ total: 10, fetched: 5, done: false })
  })
})
