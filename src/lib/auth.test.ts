import { describe, it, expect, beforeEach, vi } from 'vitest'
// The module caches the token in a module-level variable, so we need
// a fresh module for each test to reset that cache.
describe('auth', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.resetModules()
  })

  async function loadAuth() {
    const mod = await import('./auth')
    return mod
  }

  describe('getAuthToken', () => {
    it('returns null when no token stored', async () => {
      const { getAuthToken } = await loadAuth()
      expect(getAuthToken()).toBeNull()
    })

    it('returns token from localStorage', async () => {
      localStorage.setItem('auth_token', 'abc123')
      const { getAuthToken } = await loadAuth()
      expect(getAuthToken()).toBe('abc123')
    })

    it('caches token in memory after first read', async () => {
      localStorage.setItem('auth_token', 'abc123')
      const { getAuthToken } = await loadAuth()
      getAuthToken()
      // Even if localStorage changes, the cached value is returned
      localStorage.setItem('auth_token', 'changed')
      expect(getAuthToken()).toBe('abc123')
    })
  })

  describe('setAuthToken', () => {
    it('stores token in localStorage', async () => {
      const { setAuthToken } = await loadAuth()
      setAuthToken('tok_abc')
      expect(localStorage.getItem('auth_token')).toBe('tok_abc')
    })

    it('removes token from localStorage when null', async () => {
      localStorage.setItem('auth_token', 'existing')
      const { setAuthToken } = await loadAuth()
      setAuthToken(null)
      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('updates the in-memory cache', async () => {
      const { setAuthToken, getAuthToken } = await loadAuth()
      setAuthToken('new_token')
      expect(getAuthToken()).toBe('new_token')
    })
  })

  describe('logoutClient', () => {
    it('clears token and dispatches logout event', async () => {
      const { setAuthToken, logoutClient, getAuthToken, AUTH_LOGOUT_EVENT } = await loadAuth()
      setAuthToken('tok_abc')

      const handler = vi.fn()
      window.addEventListener(AUTH_LOGOUT_EVENT, handler)

      const replaceStateSpy = vi.spyOn(window.history, 'replaceState')
      logoutClient()

      expect(getAuthToken()).toBeNull()
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/')
      expect(handler).toHaveBeenCalledTimes(1)

      window.removeEventListener(AUTH_LOGOUT_EVENT, handler)
      replaceStateSpy.mockRestore()
    })
  })
})
