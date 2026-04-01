import { describe, it, expect, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { removeBySelectors } from './selector-remover.js'

// Suppress jsdom "Could not parse CSS stylesheet" warnings
vi.spyOn(console, 'error').mockImplementation(() => {})

function doc(html: string): Document {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`).window.document
}

describe('removeBySelectors', () => {
  describe('exact selectors', () => {
    it('removes script elements', () => {
      const d = doc('<p>keep</p><script>evil()</script>')
      removeBySelectors(d, { exactSelectors: ['script'] })
      expect(d.querySelectorAll('script')).toHaveLength(0)
      expect(d.body.textContent).toContain('keep')
    })

    it('removes style elements', () => {
      const d = doc('<style>.x{}</style><p>content</p>')
      removeBySelectors(d, { exactSelectors: ['style'] })
      expect(d.querySelectorAll('style')).toHaveLength(0)
      expect(d.body.textContent).toContain('content')
    })

    it('removes hidden elements', () => {
      const d = doc('<div hidden>secret</div><p>visible</p>')
      removeBySelectors(d, { exactSelectors: ['[hidden]'] })
      expect(d.body.textContent).not.toContain('secret')
      expect(d.body.textContent).toContain('visible')
    })

    it('removes elements by class', () => {
      const d = doc('<div class="ad-banner">ad</div><p>article</p>')
      removeBySelectors(d, { exactSelectors: ['[class^="ad-" i]'] })
      expect(d.body.textContent).not.toContain('ad')
      expect(d.body.textContent).toContain('article')
    })

    it('removes elements by id', () => {
      const d = doc('<div id="ad-top">ad</div><p>content</p>')
      removeBySelectors(d, { exactSelectors: ['[id^="ad-" i]'] })
      expect(d.body.textContent).not.toContain('ad')
    })

    it('does not remove when no selectors match', () => {
      const d = doc('<p>safe</p><div class="content">also safe</div>')
      removeBySelectors(d, { exactSelectors: ['script', 'style', '[hidden]'] })
      expect(d.body.textContent).toContain('safe')
      expect(d.body.textContent).toContain('also safe')
    })

    it('removes multiple element types in one call', () => {
      const d = doc('<script>x</script><style>y</style><noscript>z</noscript><p>keep</p>')
      removeBySelectors(d, { exactSelectors: ['script', 'style', 'noscript'] })
      expect(d.querySelectorAll('script, style, noscript')).toHaveLength(0)
      expect(d.body.textContent?.trim()).toBe('keep')
    })

    it('handles display:none style', () => {
      const d = doc('<div style="display:none">hidden</div><p>visible</p>')
      removeBySelectors(d, {
        exactSelectors: ['[style*="display:none"]'],
      })
      expect(d.body.textContent).not.toContain('hidden')
      expect(d.body.textContent).toContain('visible')
    })

    it('preserves math script types', () => {
      const d = doc('<script type="math/tex">x^2</script><script>evil()</script>')
      removeBySelectors(d, { exactSelectors: ['script:not([type^="math/"])'] })
      expect(d.querySelectorAll('script')).toHaveLength(1)
      expect(d.querySelector('script')?.textContent).toBe('x^2')
    })

    it('preserves video iframes', () => {
      const d = doc(
        '<iframe src="https://youtube.com/embed/123"></iframe>' +
        '<iframe src="https://ads.example.com/banner"></iframe>' +
        '<p>content</p>',
      )
      removeBySelectors(d, {
        exactSelectors: [
          'iframe:not([src*="youtube"]):not([src*="youtu.be"]):not([src*="vimeo"]):not([src*="twitter"]):not([src*="x.com"]):not([src*="datawrapper"])',
        ],
      })
      expect(d.querySelectorAll('iframe')).toHaveLength(1)
      expect(d.querySelector('iframe')?.getAttribute('src')).toContain('youtube')
    })
  })

  describe('partial selectors', () => {
    it('matches class substring', () => {
      const d = doc('<div class="newsletter-signup">Subscribe!</div><p>content</p>')
      removeBySelectors(d, {
        exactSelectors: [],
        partialSelectors: ['newsletter'],
        testAttributes: ['class', 'id'],
      })
      expect(d.body.textContent).not.toContain('Subscribe!')
      expect(d.body.textContent).toContain('content')
    })

    it('matches id substring', () => {
      const d = doc('<div id="sidebar-widget">links</div><p>article</p>')
      removeBySelectors(d, {
        exactSelectors: [],
        partialSelectors: ['sidebar'],
        testAttributes: ['class', 'id'],
      })
      expect(d.body.textContent).not.toContain('links')
    })

    it('is case-insensitive', () => {
      const d = doc('<div class="NewsletterSignup">form</div><p>content</p>')
      removeBySelectors(d, {
        exactSelectors: [],
        partialSelectors: ['newsletter'],
        testAttributes: ['class', 'id'],
      })
      expect(d.body.textContent).not.toContain('form')
    })

    it('matches data-component attribute', () => {
      const d = doc('<div data-component="share-icons">share</div><p>article</p>')
      removeBySelectors(d, {
        exactSelectors: [],
        partialSelectors: ['share-icons'],
        testAttributes: ['class', 'id', 'data-component'],
      })
      expect(d.body.textContent).not.toContain('share')
    })

    it('does not match when pattern is absent', () => {
      const d = doc('<div class="content-body">text</div>')
      removeBySelectors(d, {
        exactSelectors: [],
        partialSelectors: ['sidebar', 'newsletter'],
        testAttributes: ['class', 'id'],
      })
      expect(d.body.textContent).toContain('text')
    })

    it('skips elements already matched by exact selectors', () => {
      const d = doc('<div class="ad-banner newsletter-cta">noise</div><p>content</p>')
      removeBySelectors(d, {
        exactSelectors: ['[class^="ad-" i]'],
        partialSelectors: ['newsletter'],
        testAttributes: ['class', 'id'],
      })
      // Should still be removed (by exact match) and not cause errors
      expect(d.body.textContent).not.toContain('noise')
    })
  })

  describe('combined exact + partial', () => {
    it('removes elements matched by either method', () => {
      const d = doc(
        '<script>tracking()</script>' +
        '<div class="sidebar-related">related posts</div>' +
        '<p>main content here</p>',
      )
      removeBySelectors(d, {
        exactSelectors: ['script'],
        partialSelectors: ['sidebar'],
        testAttributes: ['class', 'id'],
      })
      expect(d.body.textContent).not.toContain('tracking()')
      expect(d.body.textContent).not.toContain('related posts')
      expect(d.body.textContent).toContain('main content here')
    })
  })

  describe('edge cases', () => {
    it('handles empty document', () => {
      const d = doc('')
      removeBySelectors(d, { exactSelectors: ['script', 'style'] })
      expect(d.body.innerHTML).toBe('')
    })

    it('handles empty selector list', () => {
      const d = doc('<p>safe</p>')
      removeBySelectors(d, { exactSelectors: [] })
      expect(d.body.textContent).toContain('safe')
    })

    it('handles nested elements — parent removal removes children too', () => {
      const d = doc('<div hidden><p>nested</p><span>also nested</span></div><p>visible</p>')
      removeBySelectors(d, { exactSelectors: ['[hidden]'] })
      expect(d.body.textContent).not.toContain('nested')
      expect(d.body.textContent).toContain('visible')
    })
  })
})
