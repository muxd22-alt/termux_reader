import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./fetcher', () => ({
  apiPost: vi.fn(),
}))

vi.mock('./offlineQueue', () => ({
  queueSeenIds: vi.fn(),
}))

import { markSeenOnServer } from './markSeenWithQueue'
import { apiPost } from './fetcher'
import { queueSeenIds } from './offlineQueue'

describe('markSeenOnServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls apiPost with article ids', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined)
    await markSeenOnServer([1, 2, 3])
    expect(apiPost).toHaveBeenCalledWith('/api/articles/batch-seen', { ids: [1, 2, 3] })
    expect(queueSeenIds).not.toHaveBeenCalled()
  })

  it('queues ids to offline queue when apiPost fails', async () => {
    vi.mocked(apiPost).mockRejectedValue(new Error('network error'))
    await markSeenOnServer([4, 5])
    expect(queueSeenIds).toHaveBeenCalledWith([4, 5])
  })
})
