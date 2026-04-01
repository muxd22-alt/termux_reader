import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsTouchDevice } from './use-is-touch-device'

describe('useIsTouchDevice', () => {
  let changeListeners: Array<(e: { matches: boolean }) => void>
  let matchesValue: boolean

  beforeEach(() => {
    changeListeners = []
    matchesValue = false

    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: matchesValue,
      media: query,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        changeListeners.push(cb)
      },
      removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        changeListeners = changeListeners.filter(l => l !== cb)
      },
    })))
  })

  it('returns false on non-touch device', () => {
    matchesValue = false
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(false)
  })

  it('returns true on touch device', () => {
    matchesValue = true
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(true)
  })

  it('updates when media query changes', () => {
    matchesValue = false
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(false)

    act(() => {
      changeListeners.forEach(cb => cb({ matches: true }))
    })
    expect(result.current).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useIsTouchDevice())
    expect(changeListeners).toHaveLength(1)
    unmount()
    expect(changeListeners).toHaveLength(0)
  })
})
