import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('readTracker', () => {
  let trackRead: typeof import('./readTracker').trackRead
  let isReadInSession: typeof import('./readTracker').isReadInSession

  beforeEach(async () => {
    // Reset module state between tests
    vi.resetModules()
    const mod = await import('./readTracker')
    trackRead = mod.trackRead
    isReadInSession = mod.isReadInSession
  })

  it('returns false for untracked article', () => {
    expect(isReadInSession(1)).toBe(false)
  })

  it('returns true after tracking', () => {
    trackRead(42)
    expect(isReadInSession(42)).toBe(true)
  })

  it('does not cross-contaminate between articles', () => {
    trackRead(10)
    expect(isReadInSession(10)).toBe(true)
    expect(isReadInSession(11)).toBe(false)
  })
})
