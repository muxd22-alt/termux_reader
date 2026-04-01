import { describe, it, expect } from 'vitest'
import { cleanUrl } from './url-cleaner.js'

describe('cleanUrl', () => {
  it('removes utm_* parameters', () => {
    expect(cleanUrl('https://example.com/post?utm_source=twitter&utm_medium=social&utm_campaign=launch'))
      .toBe('https://example.com/post')
  })

  it('removes fbclid', () => {
    expect(cleanUrl('https://example.com/post?fbclid=abc123'))
      .toBe('https://example.com/post')
  })

  it('removes gclid', () => {
    expect(cleanUrl('https://example.com/post?gclid=xyz'))
      .toBe('https://example.com/post')
  })

  it('removes mtm_* (Matomo) parameters', () => {
    expect(cleanUrl('https://example.com/post?mtm_campaign=test&mtm_source=rss'))
      .toBe('https://example.com/post')
  })

  it('removes HubSpot parameters', () => {
    expect(cleanUrl('https://example.com/post?_hsenc=abc&__hssc=def&__hstc=ghi'))
      .toBe('https://example.com/post')
  })

  it('removes Mailchimp parameters', () => {
    expect(cleanUrl('https://example.com/post?mc_cid=abc&mc_eid=def'))
      .toBe('https://example.com/post')
  })

  it('preserves non-tracking parameters', () => {
    expect(cleanUrl('https://example.com/post?id=42&page=2'))
      .toBe('https://example.com/post?id=42&page=2')
  })

  it('removes only tracking params, preserves others', () => {
    const result = cleanUrl('https://example.com/post?id=42&utm_source=twitter&page=2')
    expect(result).toContain('id=42')
    expect(result).toContain('page=2')
    expect(result).not.toContain('utm_source')
  })

  it('handles URLs without query string', () => {
    expect(cleanUrl('https://example.com/post')).toBe('https://example.com/post')
  })

  it('handles URLs with hash fragment', () => {
    expect(cleanUrl('https://example.com/post?utm_source=rss#section'))
      .toBe('https://example.com/post#section')
  })

  it('returns original string for invalid URLs', () => {
    expect(cleanUrl('not-a-url')).toBe('not-a-url')
  })

  it('is case-insensitive for parameter names', () => {
    expect(cleanUrl('https://example.com/post?UTM_SOURCE=twitter&Fbclid=abc'))
      .toBe('https://example.com/post')
  })

  it('removes Microsoft tracking', () => {
    expect(cleanUrl('https://example.com/post?msclkid=abc'))
      .toBe('https://example.com/post')
  })

  it('removes Twitter tracking', () => {
    expect(cleanUrl('https://example.com/post?twclid=abc'))
      .toBe('https://example.com/post')
  })

  it('removes Yandex tracking', () => {
    expect(cleanUrl('https://example.com/post?yclid=abc&ysclid=def'))
      .toBe('https://example.com/post')
  })

  it('removes mixed trackers from multiple providers', () => {
    const url = 'https://example.com/post?fbclid=a&gclid=b&utm_source=c&mc_cid=d&id=42'
    const result = cleanUrl(url)
    expect(result).toBe('https://example.com/post?id=42')
  })
})
