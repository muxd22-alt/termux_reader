import { buildPipelineConfig, TEST_ATTRIBUTES, ALLOWED_EMPTY_ELEMENTS, type CleanerConfig } from './selectors.js'
import { removeBySelectors } from './selector-remover.js'
import { scoreAndRemoveNonContent } from './content-scorer.js'
import { normalizeHtml } from './html-normalizer.js'
import { logger } from '../../logger.js'

const log = logger.child('cleaner')

/**
 * Lightweight pre-clean before Readability.
 * Removes only elements that are never article content (script, style, hidden, etc.).
 * Fail-open: exceptions are caught and the original document is used as-is.
 */
export function preClean(doc: Document, config?: CleanerConfig): void {
  try {
    const { preCleanSelectors } = buildPipelineConfig(config)
    if (preCleanSelectors.length === 0) return

    removeBySelectors(doc, { exactSelectors: preCleanSelectors })
  } catch (err) {
    log.warn('preClean failed, continuing with original HTML:', err)
  }
}

/**
 * Post-clean after Readability extraction.
 * Removes remaining noise from extracted article content using:
 *   1. Exact CSS selector matching (ads, nav, comments, sidebar, etc.)
 *   2. Partial attribute pattern matching (~400 patterns against class/id/data-*)
 *
 * Fail-open: exceptions are caught and the Readability output is used as-is.
 */
export function postClean(doc: Document, config?: CleanerConfig): void {
  try {
    const pipeline = buildPipelineConfig(config)

    // Step 1: Selector-based removal (exact + partial patterns)
    const hasExact = pipeline.postCleanSelectors.length > 0
    const hasPartial = pipeline.partialSelectors.length > 0

    if (hasExact || hasPartial) {
      removeBySelectors(doc, {
        exactSelectors: pipeline.postCleanSelectors,
        partialSelectors: hasPartial ? pipeline.partialSelectors : undefined,
        testAttributes: TEST_ATTRIBUTES,
      })
    }

    // Step 2: Scoring-based removal (CJK-aware character-count thresholds)
    if (pipeline.scoringEnabled) {
      scoreAndRemoveNonContent(doc, {
        thresholdOffset: pipeline.scoringThresholdOffset,
      })
    }

    // Step 3: HTML normalization (attribute cleanup, empty element removal, div flattening)
    if (pipeline.normalizationEnabled) {
      const body = doc.body
      if (body) {
        normalizeHtml(doc, body, {
          allowedAttributes: pipeline.allowedAttributes,
          allowedEmptyElements: ALLOWED_EMPTY_ELEMENTS,
        })
      }
    }
  } catch (err) {
    log.warn('postClean failed, continuing with Readability output:', err)
  }
}
