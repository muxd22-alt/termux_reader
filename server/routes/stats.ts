import type { FastifyInstance } from 'fastify'
import { getReadingStats, getBookmarkCount, getLikeCount } from '../db.js'
import { getDb } from '../db/connection.js'

export async function statsRoutes(api: FastifyInstance): Promise<void> {
  api.get('/api/stats', async (request, reply) => {
    const { since, until } = request.query as { since?: string; until?: string }
    const stats = getReadingStats({ since, until })

    const feedCount = (
      getDb().prepare('SELECT COUNT(*) AS cnt FROM feeds').get() as { cnt: number }
    ).cnt
    const categoryCount = (
      getDb().prepare('SELECT COUNT(*) AS cnt FROM categories').get() as { cnt: number }
    ).cnt
    const bookmarked = getBookmarkCount()
    const liked = getLikeCount()

    reply.send({
      total_articles: stats.total,
      unread_articles: stats.unread,
      read_articles: stats.read,
      bookmarked_articles: bookmarked,
      liked_articles: liked,
      total_feeds: feedCount,
      total_categories: categoryCount,
      by_feed: stats.by_feed,
    })
  })
}
