import { EventEmitter } from 'events'

export type FetchProgressEvent =
  | { type: 'feed-articles-found'; feed_id: number; total: number }
  | { type: 'article-done'; feed_id: number; fetched: number; total: number }
  | { type: 'feed-complete'; feed_id: number }

export const fetchProgress = new EventEmitter()

// Late subscriber: per-feed latest progress
const feedState = new Map<number, { total: number; fetched: number; done: boolean }>()

export function emitProgress(event: FetchProgressEvent) {
  if (event.type === 'feed-articles-found') {
    feedState.set(event.feed_id, { total: event.total, fetched: 0, done: false })
  } else if (event.type === 'article-done') {
    feedState.set(event.feed_id, { total: event.total, fetched: event.fetched, done: false })
  }
  fetchProgress.emit('event', event)
}

export function markFeedDone(feedId: number) {
  const state = feedState.get(feedId)
  if (state) state.done = true
  setTimeout(() => feedState.delete(feedId), 10_000)
}

export function getFeedState(feedId: number) {
  return feedState.get(feedId)
}
