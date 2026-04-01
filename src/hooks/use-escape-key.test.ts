import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEscapeKey } from './use-escape-key'

describe('useEscapeKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls callback on Escape key press', () => {
    const callback = vi.fn()
    renderHook(() => useEscapeKey(callback))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(callback).toHaveBeenCalledOnce()
  })

  it('does not call callback on other keys', () => {
    const callback = vi.fn()
    renderHook(() => useEscapeKey(callback))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(callback).not.toHaveBeenCalled()
  })

  it('removes listener on unmount', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(callback))

    unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(callback).not.toHaveBeenCalled()
  })

  it('uses updated callback when it changes', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useEscapeKey(cb), {
      initialProps: { cb: first },
    })

    rerender({ cb: second })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
