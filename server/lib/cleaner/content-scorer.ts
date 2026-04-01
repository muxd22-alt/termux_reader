/**
 * Content scoring module — CJK-aware text analysis for non-content block removal.
 *
 * Ported from defuddle's ContentScorer (scoring.ts) with key changes:
 *   - All text measurement uses character count (not word count) for CJK support
 *   - Thresholds calibrated for character-based measurement
 *   - Exported as pure functions (no static class)
 */

// ---------------------------------------------------------------------------
// Block elements to evaluate for scoring
// ---------------------------------------------------------------------------
const BLOCK_ELEMENTS = [
  'div', 'section', 'article', 'main', 'aside',
  'blockquote', 'details', 'figure', 'figcaption',
  'ul', 'ol', 'dl', 'table',
]

import { NAVIGATION_INDICATORS } from './boilerplate-text.js'

// ---------------------------------------------------------------------------
// Non-content class/id patterns — signal navigation/chrome, not article body
// ---------------------------------------------------------------------------
const NON_CONTENT_PATTERNS = [
  'nav', 'menu', 'sidebar', 'footer', 'header',
  'breadcrumb', 'pagination', 'pager',
  'share', 'social', 'tweet', 'facebook',
  'comment', 'disqus', 'respond',
  'related', 'recommend', 'popular', 'trending',
  'newsletter', 'subscribe', 'signup',
  'widget', 'ad-', 'advert', 'sponsor',
  'banner', 'promo', 'cta',
  'meta', 'byline', 'author-bio',
  'tag-list', 'category', 'taxonomy',
]

// ---------------------------------------------------------------------------
// Content indicator patterns — signal this IS article content
// ---------------------------------------------------------------------------
const CONTENT_INDICATORS = [
  'article', 'content', 'post', 'entry', 'story',
  'text', 'body', 'main', 'primary',
  'image', 'figure', 'photo', 'gallery',
]

// ---------------------------------------------------------------------------
// Thresholds (character-based, calibrated for CJK + English)
// ---------------------------------------------------------------------------

/** Thresholds for isLikelyContent — protects blocks from being scored/removed */
const CONTENT_THRESHOLDS = {
  /** 140 chars + 2+ paragraphs → definitely content */
  minTextWithParagraphs: 140,
  /** 400 chars alone → definitely content */
  minTextAlone: 400,
  /** 80 chars + 1 paragraph → likely content */
  minTextWithOneParagraph: 80,
}

/** Min text length to bother scoring (below this, skip — too short to judge) */
const MIN_TEXT_FOR_SCORING = 20

/** Link text ratio above which a block gets a heavy penalty */
const HIGH_LINK_DENSITY = 0.5

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  blockElements?: string[]
  navigationIndicators?: string[]
  nonContentPatterns?: string[]
  contentIndicators?: string[]
  thresholdOffset?: number
}

export interface ContentBlock {
  el: Element
  score: number
  pRatio: number
}

/**
 * Return the character count of text after collapsing whitespace.
 * Language-independent measurement.
 */
export function measureTextLength(text: string): number {
  return text.replace(/\s+/g, ' ').trim().length
}

/**
 * Calculate link density as ratio of link-text chars to total chars.
 * Language-independent — works equally well for CJK and Latin.
 */
export function calculateLinkDensity(element: Element): number {
  const totalLen = measureTextLength(element.textContent || '')
  if (totalLen === 0) return 0

  let linkTextLen = 0
  element.querySelectorAll('a').forEach(a => {
    linkTextLen += measureTextLength(a.textContent || '')
  })

  return linkTextLen / totalLen
}

/**
 * Determine if an element is likely real article content and should be protected.
 * Based on defuddle's ContentScorer.isLikelyContent, adapted for character counts.
 */
export function isLikelyContent(element: Element, indicators?: string[]): boolean {
  const ci = indicators ?? CONTENT_INDICATORS

  // Check role attribute
  const role = (element.getAttribute('role') || '').toLowerCase()
  if (role === 'article' || role === 'main' || role === 'contentinfo') return true

  // Check class/id for content indicators
  const className = (typeof element.className === 'string' ? element.className : '').toLowerCase()
  const id = (element.id || '').toLowerCase()
  for (const pattern of ci) {
    if (className.includes(pattern) || id.includes(pattern)) return true
  }

  // Check text volume + paragraph count
  const textLen = measureTextLength(element.textContent || '')
  const paragraphs = element.querySelectorAll('p').length

  if (textLen >= CONTENT_THRESHOLDS.minTextWithParagraphs && paragraphs >= 2) return true
  if (textLen >= CONTENT_THRESHOLDS.minTextAlone) return true
  if (textLen >= CONTENT_THRESHOLDS.minTextWithOneParagraph && paragraphs >= 1) return true

  return false
}

/**
 * Score a non-content block. Negative score = likely non-content.
 * Based on defuddle's ContentScorer.scoreNonContentBlock, adapted for character counts.
 */
export function scoreNonContentBlock(
  element: Element,
  navIndicators?: string[],
  ncPatterns?: string[],
): number {
  let score = 0
  const text = (element.textContent || '').toLowerCase()
  const textLen = measureTextLength(text)

  if (textLen < MIN_TEXT_FOR_SCORING) return 0 // Too short to judge

  // Navigation indicator text matches: heavy penalty
  const indicators = navIndicators ?? NAVIGATION_INDICATORS
  for (const indicator of indicators) {
    if (text.includes(indicator.toLowerCase())) {
      score -= 10
    }
  }

  // High link density: penalty
  const linkDensity = calculateLinkDensity(element)
  if (linkDensity > HIGH_LINK_DENSITY) {
    score -= 15
  }

  // Class/ID pattern matches: penalty
  const className = (typeof element.className === 'string' ? element.className : '').toLowerCase()
  const id = (element.id || '').toLowerCase()
  const patterns = ncPatterns ?? NON_CONTENT_PATTERNS
  for (const pattern of patterns) {
    if (className.includes(pattern) || id.includes(pattern)) {
      score -= 8
    }
  }

  return score
}

/**
 * Score and remove non-content block elements from a document.
 * Ported from defuddle's ContentScorer.scoreAndRemove().
 * Used in post-clean phase on Readability-extracted content.
 */
export function scoreAndRemoveNonContent(doc: Document, config?: ScoringConfig): void {
  const blockTags = config?.blockElements ?? BLOCK_ELEMENTS
  const thresholdOffset = config?.thresholdOffset ?? 0
  // Positive offset → harder to remove (score must be more negative)
  const threshold = 0 - thresholdOffset // e.g. offset=20 → only remove if score < -20

  const selector = blockTags.join(',')
  const elements = Array.from(doc.querySelectorAll(selector))
  const elementsToRemove = new Set<Element>()

  for (const element of elements) {
    // Skip if already marked for removal (ancestor was removed)
    if (elementsToRemove.has(element)) continue

    // Skip if ancestor is already queued for removal
    let ancestorQueued = false
    for (const queued of elementsToRemove) {
      if (queued.contains(element)) {
        ancestorQueued = true
        break
      }
    }
    if (ancestorQueued) continue

    // Protect content-rich elements
    if (isLikelyContent(element, config?.contentIndicators)) continue

    const score = scoreNonContentBlock(
      element,
      config?.navigationIndicators,
      config?.nonContentPatterns,
    )

    if (score < threshold) {
      elementsToRemove.add(element)
    }
  }

  elementsToRemove.forEach(el => {
    try {
      el.remove()
    } catch {
      // Already removed as descendant
    }
  })
}

/**
 * Enhanced version of findDensestContentBlock.
 * Uses measureTextLength for language-independent measurement,
 * adds class/id content indicator bonuses and nav indicator penalties.
 * Used to validate/supplement Readability results.
 */
export function findBestContentBlock(doc: Document, config?: ScoringConfig): ContentBlock | null {
  const elements = doc.querySelectorAll('div, section, article, main, td')
  let best: ContentBlock | null = null

  for (const el of elements) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'body' || tag === 'html') continue

    // Sum text inside <p> descendants
    const paragraphs = el.querySelectorAll('p')
    let pTextLen = 0
    paragraphs.forEach(p => { pTextLen += measureTextLength(p.textContent || '') })
    if (pTextLen < 1000) continue

    const totalLen = measureTextLength(el.textContent || '')
    if (totalLen === 0) continue

    // Paragraph density
    const pRatio = pTextLen / totalLen

    // Link density (continuous penalty, not binary cutoff)
    const linkDensity = calculateLinkDensity(el)
    if (linkDensity > 0.4) continue // Skip high-link elements entirely

    // Base score
    let score = pTextLen * pRatio * (1 - linkDensity)

    // Class/ID content indicator bonus
    const className = (typeof el.className === 'string' ? el.className : '').toLowerCase()
    const id = (el.id || '').toLowerCase()
    const ci = config?.contentIndicators ?? CONTENT_INDICATORS
    for (const pattern of ci) {
      if (className.includes(pattern) || id.includes(pattern)) {
        score *= 1.2 // 20% bonus per content indicator match
      }
    }

    // Navigation indicator penalty (check text content)
    const text = (el.textContent || '').toLowerCase()
    const navIndicators = config?.navigationIndicators ?? NAVIGATION_INDICATORS
    let navCount = 0
    for (const indicator of navIndicators) {
      if (text.includes(indicator.toLowerCase())) navCount++
    }
    if (navCount > 2) {
      score *= 0.5 // Heavy penalty for nav-heavy text
    }

    if (!best || score > best.score) {
      best = { el, score, pRatio }
    }
  }

  return best
}
