import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GENERIC_LINK_TEXT,
  isCssSelectorBridgeUrl,
  stripCustomBridgeParams,
  parseCssSelectorBridgeParams,
  extractTitleFromCard,
  assignCssBridgePseudoDates,
} from './css-bridge.js'
import { JSDOM } from 'jsdom'

beforeEach(() => {
  vi.clearAllMocks()
})

// --- GENERIC_LINK_TEXT ---

describe('GENERIC_LINK_TEXT', () => {
  it.each([
    'read more', 'Read More', 'READ MORE',
    'learn more', 'see more', 'view', 'details',
    '続きを読む', '詳細', 'もっと見る',
  ])('matches generic text: %s', (text) => {
    expect(GENERIC_LINK_TEXT.test(text)).toBe(true)
  })

  it.each([
    'How to Build a REST API',
    'Breaking News: Markets Rally',
    'read more about this',
    '',
  ])('does not match real titles: %s', (text) => {
    expect(GENERIC_LINK_TEXT.test(text)).toBe(false)
  })
})

// --- isCssSelectorBridgeUrl ---

describe('isCssSelectorBridgeUrl', () => {
  it('returns true for CssSelectorBridge URL', () => {
    expect(isCssSelectorBridgeUrl('https://bridge.example.com/?bridge=CssSelectorBridge&home_page=https://blog.com')).toBe(true)
  })

  it('returns false for non-bridge URL', () => {
    expect(isCssSelectorBridgeUrl('https://example.com/feed.xml')).toBe(false)
  })
})

// --- stripCustomBridgeParams ---

describe('stripCustomBridgeParams', () => {
  it('removes title_selector and content_selector from URL', () => {
    const url = 'https://bridge.example.com/?action=display&bridge=CssSelectorBridge&home_page=https://blog.com&url_selector=a.post&format=Atom&title_selector=h2&content_selector=p.desc'
    const result = stripCustomBridgeParams(url)
    expect(result).toContain('url_selector=a.post')
    expect(result).toContain('home_page=')
    expect(result).not.toContain('title_selector')
    expect(result).not.toContain('content_selector')
  })

  it('preserves URL when no custom params exist', () => {
    const url = 'https://bridge.example.com/?action=display&bridge=CssSelectorBridge&home_page=https%3A%2F%2Fblog.com&url_selector=a.post&format=Atom'
    const result = stripCustomBridgeParams(url)
    expect(result).toBe(url)
  })

  it('returns original string for invalid URL', () => {
    expect(stripCustomBridgeParams('not a url')).toBe('not a url')
  })
})

// --- parseCssSelectorBridgeParams ---

describe('parseCssSelectorBridgeParams', () => {
  it('extracts home_page and url_selector', () => {
    const url = 'https://bridge.example.com/?bridge=CssSelectorBridge&home_page=https://blog.com&url_selector=a.post-link'
    const result = parseCssSelectorBridgeParams(url)
    expect(result).toEqual({
      homePage: 'https://blog.com',
      urlSelector: 'a.post-link',
    })
  })

  it('returns null when home_page is missing', () => {
    const url = 'https://bridge.example.com/?bridge=CssSelectorBridge&url_selector=a'
    expect(parseCssSelectorBridgeParams(url)).toBeNull()
  })

  it('returns null when url_selector is missing', () => {
    const url = 'https://bridge.example.com/?bridge=CssSelectorBridge&home_page=https://blog.com'
    expect(parseCssSelectorBridgeParams(url)).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(parseCssSelectorBridgeParams('not a url')).toBeNull()
  })
})

// --- extractTitleFromCard ---

describe('extractTitleFromCard', () => {
  function makeDoc(html: string) {
    return new JSDOM(html).window.document
  }

  it('strategy 1: returns link text when it is a real title', () => {
    const doc = makeDoc('<a href="/post">Great Article Title</a>')
    const anchor = doc.querySelector('a')!
    expect(extractTitleFromCard(anchor)).toBe('Great Article Title')
  })

  it('strategy 1: skips generic link text', () => {
    const doc = makeDoc(`
      <div>
        <h2>Actual Heading</h2>
        <a href="/post">Read more</a>
      </div>
    `)
    const anchor = doc.querySelector('a')!
    // Should use strategy 3 (heading) since link text is generic
    expect(extractTitleFromCard(anchor)).toBe('Actual Heading')
  })

  it('strategy 2: finds sibling anchor with same href but different text', () => {
    const doc = makeDoc(`
      <div>
        <a href="/post">Real Title Here</a>
        <a href="/post">Read more</a>
      </div>
    `)
    const anchor = doc.querySelectorAll('a')[1] // the "Read more" one
    expect(extractTitleFromCard(anchor)).toBe('Real Title Here')
  })

  it('strategy 3: finds heading element in parent', () => {
    const doc = makeDoc(`
      <div>
        <h3>Heading Title</h3>
        <a href="/post">続きを読む</a>
      </div>
    `)
    const anchor = doc.querySelector('a')!
    expect(extractTitleFromCard(anchor)).toBe('Heading Title')
  })

  it('strategy 4: finds element with title-like class', () => {
    const doc = makeDoc(`
      <div>
        <span class="post-title">Class-Based Title</span>
        <a href="/post">詳細</a>
      </div>
    `)
    const anchor = doc.querySelector('a')!
    expect(extractTitleFromCard(anchor)).toBe('Class-Based Title')
  })

  it('strategy 5: falls back to original link text when nothing else found', () => {
    const doc = makeDoc('<a href="/post">view</a>')
    const anchor = doc.querySelector('a')!
    expect(extractTitleFromCard(anchor)).toBe('view')
  })

  it('handles empty link text', () => {
    const doc = makeDoc('<a href="/post"></a>')
    const anchor = doc.querySelector('a')!
    expect(extractTitleFromCard(anchor)).toBe('')
  })

  it('walks up to 8 parent levels', () => {
    // Nest deeply — heading at level 6 should be found
    const doc = makeDoc(`
      <div>
        <h2>Deep Heading</h2>
        <div><div><div><div><div>
          <a href="/post">Read more</a>
        </div></div></div></div></div>
      </div>
    `)
    const anchor = doc.querySelector('a')!
    expect(extractTitleFromCard(anchor)).toBe('Deep Heading')
  })
})

// --- assignCssBridgePseudoDates ---

describe('assignCssBridgePseudoDates', () => {
  it('assigns dates spaced 1 second apart', () => {
    const items = [
      { title: 'A', url: 'https://example.com/a', published_at: null },
      { title: 'B', url: 'https://example.com/b', published_at: null },
      { title: 'C', url: 'https://example.com/c', published_at: null },
    ]

    const result = assignCssBridgePseudoDates(items)

    expect(result).toHaveLength(3)
    for (const item of result) {
      expect(item.published_at).not.toBeNull()
    }

    // Items should be spaced 1 second apart
    const t0 = new Date(result[0].published_at!).getTime()
    const t1 = new Date(result[1].published_at!).getTime()
    const t2 = new Date(result[2].published_at!).getTime()
    expect(t0 - t1).toBe(1_000)
    expect(t1 - t2).toBe(1_000)
  })

  it('preserves existing published_at', () => {
    const items = [
      { title: 'A', url: 'https://example.com/a', published_at: '2025-01-01T00:00:00Z' },
      { title: 'B', url: 'https://example.com/b', published_at: null },
    ]

    const result = assignCssBridgePseudoDates(items)

    expect(result[0].published_at).toBe('2025-01-01T00:00:00Z')
    expect(result[1].published_at).not.toBeNull()
  })

  it('filters out home page self-references when bridgeUrl is provided', () => {
    const bridgeUrl = 'https://bridge.example.com/?bridge=CssSelectorBridge&home_page=https://blog.com/posts&url_selector=a'
    const items = [
      { title: 'A', url: 'https://blog.com/posts', published_at: null }, // self-reference
      { title: 'B', url: 'https://blog.com/posts/article-1', published_at: null },
    ]

    const result = assignCssBridgePseudoDates(items, bridgeUrl)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('B')
  })

  it('handles trailing slash difference in home page', () => {
    const bridgeUrl = 'https://bridge.example.com/?bridge=CssSelectorBridge&home_page=https://blog.com/posts/&url_selector=a'
    const items = [
      { title: 'Self', url: 'https://blog.com/posts', published_at: null },
      { title: 'Real', url: 'https://blog.com/posts/article', published_at: null },
    ]

    const result = assignCssBridgePseudoDates(items, bridgeUrl)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Real')
  })

  it('returns all items when no bridgeUrl provided', () => {
    const items = [
      { title: 'A', url: 'https://example.com/a', published_at: null },
    ]

    const result = assignCssBridgePseudoDates(items)
    expect(result).toHaveLength(1)
  })
})
