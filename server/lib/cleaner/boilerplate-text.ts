/**
 * Multilingual boilerplate text patterns for web content cleaning.
 *
 * Non-English patterns are consolidated here so they don't scatter
 * across individual source files. Add new language patterns to the
 * relevant array below.
 */

// ---------------------------------------------------------------------------
// Generic link text — used to detect "read more" style links that are
// not real article titles (e.g. in CssSelectorBridge card extraction).
// ---------------------------------------------------------------------------
export const GENERIC_LINK_TEXT_PATTERNS = [
  'read\\s*more', 'learn\\s*more', 'see\\s*more', 'view', 'details',
  // ja
  '続きを読む', '詳細', 'もっと見る',
]

/** Pre-built RegExp for matching generic link text (anchored, case-insensitive). */
export const GENERIC_LINK_TEXT = new RegExp(
  `^(${GENERIC_LINK_TEXT_PATTERNS.join('|')})$`,
  'i',
)

// ---------------------------------------------------------------------------
// Navigation indicators — text content that signals non-content blocks.
// Used by content-scorer to penalize navigation/chrome elements.
// ---------------------------------------------------------------------------
export const NAVIGATION_INDICATORS = [
  // English
  'skip to', 'jump to', 'go to', 'back to top', 'return to top',
  'click here', 'read more', 'learn more', 'see more', 'view all',
  'next page', 'previous page', 'older posts', 'newer posts',
  'subscribe', 'sign up', 'log in', 'sign in', 'register',
  'follow us', 'share this', 'tweet this', 'pin it',
  'terms of', 'privacy policy', 'cookie policy', 'all rights reserved',
  'powered by', 'built with',
  // ja
  'トップに戻る', '続きを読む', 'もっと見る', '全て見る',
  '次のページ', '前のページ', '新しい記事', '古い記事',
  '登録する', 'ログイン', 'サインアップ',
  'フォローする', 'シェアする', 'ツイートする',
  '利用規約', 'プライバシーポリシー',
]
