import { describe, it, expect } from 'vitest'
import { resolveHighlightCss } from '../data/highlightThemes'

describe('resolveHighlightCss', () => {
  it('resolves github light', () => {
    expect(resolveHighlightCss('github', false)).toBe('github')
  })

  it('resolves github dark', () => {
    expect(resolveHighlightCss('github', true)).toBe('github-dark')
  })

  it('resolves atom-one light', () => {
    expect(resolveHighlightCss('atom-one', false)).toBe('atom-one-light')
  })

  it('resolves atom-one dark', () => {
    expect(resolveHighlightCss('atom-one', true)).toBe('atom-one-dark')
  })

  it('resolves nord (same for both modes)', () => {
    expect(resolveHighlightCss('nord', false)).toBe('nord')
    expect(resolveHighlightCss('nord', true)).toBe('nord')
  })

  it('falls back to github for unknown family (light)', () => {
    expect(resolveHighlightCss('unknown-theme', false)).toBe('github')
  })

  it('falls back to github-dark for unknown family (dark)', () => {
    expect(resolveHighlightCss('unknown-theme', true)).toBe('github-dark')
  })
})
