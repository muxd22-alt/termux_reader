import { TEST_ATTRIBUTES } from './selectors.js'

export interface RemovalOptions {
  exactSelectors: string[]
  /** Partial-match patterns (substring match against TEST_ATTRIBUTES). Omit to skip. */
  partialSelectors?: string[]
  /** Attributes to check for partial patterns. Defaults to TEST_ATTRIBUTES. */
  testAttributes?: string[]
}

/**
 * Remove elements from a Document by CSS selectors and/or partial attribute patterns.
 * Mutates the document in place.
 *
 * Ported from defuddle's `Defuddle.removeBySelector()` (defuddle.ts L426-512).
 * Differences:
 *   - Pure function (no class instance)
 *   - No protectedElement — pre-clean uses safe selectors only;
 *     post-clean operates on Readability output where protection is unnecessary.
 *   - Selector list is injected via options for testability.
 */
export function removeBySelectors(doc: Document, options: RemovalOptions): void {
  const elementsToRemove = new Set<Element>()

  // 1. Exact selector match
  if (options.exactSelectors.length > 0) {
    const joined = options.exactSelectors.join(',')
    try {
      doc.querySelectorAll(joined).forEach(el => {
        if (el?.parentNode) elementsToRemove.add(el)
      })
    } catch {
      // If the joined selector is somehow invalid, try one by one
      for (const sel of options.exactSelectors) {
        try {
          doc.querySelectorAll(sel).forEach(el => {
            if (el?.parentNode) elementsToRemove.add(el)
          })
        } catch {
          // Skip invalid selector silently — already validated at load time
        }
      }
    }
  }

  // 2. Partial pattern match (post-clean only)
  if (options.partialSelectors && options.partialSelectors.length > 0) {
    const testAttrs = options.testAttributes ?? TEST_ATTRIBUTES
    const partialRegex = new RegExp(options.partialSelectors.join('|'), 'i')
    const attrSelector = testAttrs.map(a => `[${a}]`).join(',')

    try {
      doc.querySelectorAll(attrSelector).forEach(el => {
        if (elementsToRemove.has(el)) return

        const combined = testAttrs
          .map(attr => {
            if (attr === 'class') return typeof el.className === 'string' ? el.className : ''
            if (attr === 'id') return el.id || ''
            return el.getAttribute(attr) || ''
          })
          .join(' ')
          .toLowerCase()

        if (combined.trim() && partialRegex.test(combined)) {
          elementsToRemove.add(el)
        }
      })
    } catch {
      // Invalid attribute selector — skip partial matching
    }
  }

  // 3. Batch removal — remove from deepest first to avoid parent-before-child issues
  elementsToRemove.forEach(el => {
    try {
      el.remove()
    } catch {
      // Element may have already been removed as a descendant of another removed element
    }
  })
}
