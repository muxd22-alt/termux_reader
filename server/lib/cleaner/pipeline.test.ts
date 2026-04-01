import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { preClean, postClean } from './index.js'

const FIXTURES_DIR = join(__dirname, 'fixtures')

interface FixtureMetadata {
  name: string
  url: string
  lang: string
  keySentences: string[]
  knownNoise: string[]
}

interface Fixture {
  name: string
  inputHtml: string
  metadata: FixtureMetadata
}

function loadAllFixtures(): Fixture[] {
  const dirs = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  return dirs
    .filter(name => {
      const dir = join(FIXTURES_DIR, name)
      return existsSync(join(dir, 'input.html')) && existsSync(join(dir, 'metadata.json'))
    })
    .map(name => {
      const dir = join(FIXTURES_DIR, name)
      return {
        name,
        inputHtml: readFileSync(join(dir, 'input.html'), 'utf-8'),
        metadata: JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf-8')),
      }
    })
}

/**
 * Run the full pipeline: preClean → Readability → postClean
 * Returns the cleaned body innerHTML.
 */
function runPipeline(html: string, url: string): { innerHTML: string; textContent: string } {
  // Phase 1: pre-clean
  const domForCleaning = new JSDOM(html, { url })
  preClean(domForCleaning.window.document)

  // Phase 2: Readability
  const domForReadability = new JSDOM(domForCleaning.serialize(), { url })
  const article = new Readability(domForReadability.window.document).parse()

  if (!article?.content) {
    return { innerHTML: '', textContent: '' }
  }

  // Phase 3: post-clean
  const contentDom = new JSDOM(article.content, { url })
  postClean(contentDom.window.document)

  const innerHTML = contentDom.window.document.body.innerHTML
  const textContent = contentDom.window.document.body.textContent || ''

  return { innerHTML, textContent }
}

describe('cleaning pipeline — snapshot tests', () => {
  const fixtures = loadAllFixtures()

  for (const fixture of fixtures) {
    it(`snapshot: ${fixture.name} (${fixture.metadata.lang})`, () => {
      const { innerHTML } = runPipeline(fixture.inputHtml, fixture.metadata.url)
      expect(innerHTML).toMatchSnapshot()
    })
  }
})

describe('cleaning pipeline — content quality', () => {
  const fixtures = loadAllFixtures()

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      it('preserves key sentences', () => {
        const { textContent } = runPipeline(fixture.inputHtml, fixture.metadata.url)

        // Must not be empty — Readability should extract something
        expect(textContent.trim().length).toBeGreaterThan(0)

        for (const sentence of fixture.metadata.keySentences) {
          expect(textContent).toContain(sentence)
        }
      })

      it('removes known noise', () => {
        if (fixture.metadata.knownNoise.length === 0) return

        const { textContent } = runPipeline(fixture.inputHtml, fixture.metadata.url)

        for (const noise of fixture.metadata.knownNoise) {
          expect(textContent).not.toContain(noise)
        }
      })
    })
  }
})

describe('cleaning pipeline — structural integrity', () => {
  const fixtures = loadAllFixtures()

  for (const fixture of fixtures) {
    it(`preserves block structure: ${fixture.name}`, () => {
      const { innerHTML } = runPipeline(fixture.inputHtml, fixture.metadata.url)

      if (!innerHTML) return // Skip if Readability didn't extract

      const dom = new JSDOM(innerHTML)
      const doc = dom.window.document

      // Should have at least one paragraph
      const paragraphs = doc.querySelectorAll('p')
      expect(paragraphs.length).toBeGreaterThan(0)
    })
  }
})
