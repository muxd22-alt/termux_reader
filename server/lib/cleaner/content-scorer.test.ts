import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  measureTextLength,
  calculateLinkDensity,
  isLikelyContent,
  scoreNonContentBlock,
  scoreAndRemoveNonContent,
  findBestContentBlock,
} from './content-scorer.js'

function el(html: string): Element {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return dom.window.document.body.firstElementChild!
}

function doc(html: string): Document {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`).window.document
}

// ---------------------------------------------------------------------------
// measureTextLength
// ---------------------------------------------------------------------------
describe('measureTextLength', () => {
  it('returns character count for English text', () => {
    expect(measureTextLength('Hello world')).toBe(11)
  })

  it('returns character count for Japanese text', () => {
    expect(measureTextLength('こんにちは世界')).toBe(7)
  })

  it('returns character count for mixed text', () => {
    // "Hello " + "こんにちは" = 5 + 1 + 5 = 11
    expect(measureTextLength('Hello こんにちは')).toBe(11)
  })

  it('collapses whitespace before counting', () => {
    expect(measureTextLength('  Hello   world  ')).toBe(11)
  })

  it('handles newlines and tabs', () => {
    expect(measureTextLength('Hello\n\t  world')).toBe(11)
  })

  it('returns 0 for empty string', () => {
    expect(measureTextLength('')).toBe(0)
  })

  it('returns 0 for whitespace-only', () => {
    expect(measureTextLength('   \n\t  ')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calculateLinkDensity
// ---------------------------------------------------------------------------
describe('calculateLinkDensity', () => {
  it('returns 0 for element with no links', () => {
    const e = el('<div><p>No links here at all, just plain text content.</p></div>')
    expect(calculateLinkDensity(e)).toBe(0)
  })

  it('returns ~1 for element with only links', () => {
    const e = el('<div><a href="#">All link text</a></div>')
    expect(calculateLinkDensity(e)).toBeCloseTo(1, 1)
  })

  it('returns correct ratio for mixed content', () => {
    const e = el('<div>Normal text <a href="#">link</a> more text</div>')
    const density = calculateLinkDensity(e)
    expect(density).toBeGreaterThan(0)
    expect(density).toBeLessThan(1)
  })

  it('returns 0 for empty element', () => {
    const e = el('<div></div>')
    expect(calculateLinkDensity(e)).toBe(0)
  })

  it('works with CJK text', () => {
    const e = el('<div>本文テキスト <a href="#">リンク</a> さらにテキスト</div>')
    const density = calculateLinkDensity(e)
    expect(density).toBeGreaterThan(0)
    expect(density).toBeLessThan(0.5)
  })
})

// ---------------------------------------------------------------------------
// isLikelyContent
// ---------------------------------------------------------------------------
describe('isLikelyContent', () => {
  it('protects elements with role="article"', () => {
    const e = el('<div role="article"><p>Short</p></div>')
    expect(isLikelyContent(e)).toBe(true)
  })

  it('protects elements with role="main"', () => {
    const e = el('<div role="main"><p>Short</p></div>')
    expect(isLikelyContent(e)).toBe(true)
  })

  it('protects elements with content class', () => {
    const e = el('<div class="article-content"><p>Short</p></div>')
    expect(isLikelyContent(e)).toBe(true)
  })

  it('protects elements with content id', () => {
    const e = el('<div id="post-body"><p>Short</p></div>')
    expect(isLikelyContent(e)).toBe(true)
  })

  it('protects text-rich elements with paragraphs (English)', () => {
    const longText = 'A'.repeat(150)
    const e = el(`<div><p>${longText}</p><p>Another paragraph.</p></div>`)
    expect(isLikelyContent(e)).toBe(true)
  })

  it('protects text-rich elements with paragraphs (Japanese)', () => {
    const longText = 'あ'.repeat(150)
    const e = el(`<div><p>${longText}</p><p>もう一つの段落。</p></div>`)
    expect(isLikelyContent(e)).toBe(true)
  })

  it('protects very long text even without paragraphs', () => {
    const longText = 'A'.repeat(400)
    const e = el(`<div>${longText}</div>`)
    expect(isLikelyContent(e)).toBe(true)
  })

  it('does not protect short text without indicators', () => {
    const e = el('<div><p>Short text</p></div>')
    expect(isLikelyContent(e)).toBe(false)
  })

  it('does not protect navigation-like elements', () => {
    const e = el('<div class="nav-menu"><a href="/">Home</a><a href="/about">About</a></div>')
    expect(isLikelyContent(e)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// scoreNonContentBlock
// ---------------------------------------------------------------------------
describe('scoreNonContentBlock', () => {
  it('returns 0 for very short text', () => {
    const e = el('<div>Hi</div>')
    expect(scoreNonContentBlock(e)).toBe(0)
  })

  it('penalizes navigation indicator text', () => {
    const e = el('<div>Click here to read more about our privacy policy and terms of service.</div>')
    const score = scoreNonContentBlock(e)
    expect(score).toBeLessThan(0)
  })

  it('penalizes high link density', () => {
    const e = el(
      '<div>' +
      '<a href="/1">Link one text</a> ' +
      '<a href="/2">Link two text</a> ' +
      '<a href="/3">Link three text</a> ' +
      '<a href="/4">Link four text</a> ' +
      'tiny bit of normal text' +
      '</div>',
    )
    const score = scoreNonContentBlock(e)
    expect(score).toBeLessThan(0)
  })

  it('penalizes non-content class patterns', () => {
    const e = el('<div class="sidebar-widget">Some sidebar content here for the reader.</div>')
    const score = scoreNonContentBlock(e)
    expect(score).toBeLessThan(0)
  })

  it('penalizes non-content id patterns', () => {
    const e = el('<div id="footer-nav">Footer navigation links and items go here.</div>')
    const score = scoreNonContentBlock(e)
    expect(score).toBeLessThan(0)
  })

  it('returns 0 for clean content text', () => {
    const longText = 'This is a paragraph of normal article content that does not contain any navigation indicators or suspicious patterns. It is just regular text.'
    const e = el(`<div>${longText}</div>`)
    const score = scoreNonContentBlock(e)
    expect(score).toBe(0) // No penalties
  })

  it('handles Japanese navigation text', () => {
    const e = el('<div>トップに戻る 続きを読む プライバシーポリシー 利用規約について</div>')
    const score = scoreNonContentBlock(e)
    expect(score).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// scoreAndRemoveNonContent
// ---------------------------------------------------------------------------
describe('scoreAndRemoveNonContent', () => {
  it('removes high link-density nav blocks', () => {
    const d = doc(
      '<p>Main content paragraph with enough text to be substantial.</p>' +
      '<div><a href="/1">Link 1</a> <a href="/2">Link 2</a> <a href="/3">Link 3</a> <a href="/4">Link 4</a> tiny</div>',
    )
    scoreAndRemoveNonContent(d)
    const text = d.body.textContent || ''
    expect(text).toContain('Main content paragraph')
  })

  it('preserves content-rich blocks', () => {
    const longContent = 'This is a very long article paragraph. '.repeat(20)
    const d = doc(
      `<div class="article-body"><p>${longContent}</p><p>Second paragraph.</p></div>`,
    )
    scoreAndRemoveNonContent(d)
    const text = d.body.textContent || ''
    expect(text).toContain('This is a very long article paragraph')
  })

  it('preserves content-rich Japanese blocks', () => {
    const jaContent = 'これは非常に長い日本語の記事段落です。技術的な内容を含む重要なテキストが続きます。'
    const d = doc(
      `<div><p>${jaContent.repeat(5)}</p><p>もう一つの段落。</p></div>`,
    )
    scoreAndRemoveNonContent(d)
    const text = d.body.textContent || ''
    expect(text).toContain('これは非常に長い日本語の記事段落です')
  })

  it('removes blocks with navigation indicators', () => {
    const d = doc(
      '<p>Article content here.</p>' +
      '<div class="footer-nav">Read more articles. Subscribe to our newsletter. Follow us on social media. Share this article.</div>',
    )
    scoreAndRemoveNonContent(d)
    const text = d.body.textContent || ''
    expect(text).toContain('Article content')
    expect(text).not.toContain('Subscribe to our newsletter')
  })

  it('respects thresholdOffset (positive = more lenient)', () => {
    const d = doc(
      '<p>Content.</p>' +
      '<div class="sidebar-widget">Some sidebar text content that has a bit of length to it.</div>',
    )
    // With a large positive offset, nothing should be removed
    scoreAndRemoveNonContent(d, { thresholdOffset: 100 })
    const text = d.body.textContent || ''
    expect(text).toContain('sidebar text content')
  })

  it('does not throw on empty document', () => {
    const d = doc('')
    expect(() => scoreAndRemoveNonContent(d)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// findBestContentBlock
// ---------------------------------------------------------------------------
describe('findBestContentBlock', () => {
  it('returns null for empty document', () => {
    const d = doc('')
    expect(findBestContentBlock(d)).toBeNull()
  })

  it('returns null for document with insufficient text', () => {
    const d = doc('<div><p>Short text</p></div>')
    expect(findBestContentBlock(d)).toBeNull()
  })

  it('finds the content-dense block', () => {
    const longContent = '<p>' + 'This is article text. '.repeat(100) + '</p>'
    const navContent = '<a href="/1">Link</a> '.repeat(50)
    const d = doc(
      `<div id="content">${longContent}</div>` +
      `<div id="nav">${navContent}</div>`,
    )
    const best = findBestContentBlock(d)
    expect(best).not.toBeNull()
    expect(best!.el.id).toBe('content')
  })

  it('gives bonus to elements with content-indicating classes', () => {
    const p = '<p>' + 'Text content here. '.repeat(80) + '</p>'
    const d = doc(
      `<div class="article-body">${p}</div>` +
      `<div class="some-div">${p}</div>`,
    )
    const best = findBestContentBlock(d)
    expect(best).not.toBeNull()
    expect(best!.el.getAttribute('class')).toBe('article-body')
  })

  it('works with Japanese content', () => {
    const jaP = '<p>' + '日本語の記事テキストです。'.repeat(100) + '</p>'
    const d = doc(`<div id="main">${jaP}</div>`)
    const best = findBestContentBlock(d)
    expect(best).not.toBeNull()
    expect(best!.pRatio).toBeGreaterThan(0)
  })

  it('skips high-link-density blocks', () => {
    const linkBlock = '<p>' + '<a href="#">Link text here</a> '.repeat(100) + '</p>'
    const textBlock = '<p>' + 'Normal text content. '.repeat(100) + '</p>'
    const d = doc(
      `<div id="links">${linkBlock}</div>` +
      `<div id="article">${textBlock}</div>`,
    )
    const best = findBestContentBlock(d)
    expect(best).not.toBeNull()
    expect(best!.el.id).toBe('article')
  })
})
