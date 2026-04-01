import { apiPost } from './fetcher'
import { queueSeenIds } from './offlineQueue'

export async function markSeenOnServer(ids: number[]): Promise<void> {
  try {
    await apiPost('/api/articles/batch-seen', { ids })
  } catch {
    await queueSeenIds(ids)
  }
}
