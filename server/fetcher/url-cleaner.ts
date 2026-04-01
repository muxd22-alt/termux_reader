/**
 * URL tracking parameter removal — ported from Miniflux's urlcleaner.go
 * Removes 60+ tracking parameters to improve deduplication accuracy.
 */

// Exact-match parameters to remove
const TRACKING_PARAMS = new Set([
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'fb_ref',
  // Google
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'srsltid',
  // Google Analytics
  'campaign_id',
  'campaign_medium',
  'campaign_name',
  'campaign_source',
  'campaign_term',
  'campaign_content',
  // Twitter
  'twclid',
  // Microsoft
  'msclkid',
  // Mailchimp
  'mc_cid',
  'mc_eid',
  'mc_tc',
  // HubSpot
  'hsa_cam',
  'hsa_grp',
  'hsa_mt',
  'hsa_src',
  'hsa_ad',
  'hsa_acc',
  'hsa_net',
  'hsa_ver',
  'hsa_la',
  'hsa_ol',
  'hsa_kw',
  'hsa_tgt',
  '_hsenc',
  '_hsmi',
  '__hssc',
  '__hstc',
  '__hsfp',
  // Matomo (exact names — prefixes handled separately)
  // Beehiiv
  '_bhlid',
  // Marketo
  'mkt_tok',
  // Vero
  'vero_id',
  'vero_conv',
  // Yandex
  'yclid',
  'ysclid',
  // Sailthru
  'sc_cid',
  // Other common trackers
  'ref_src',
  'ref_url',
  '_openstat',
  'ns_source',
  'ns_campaign',
  'ns_mchannel',
  'ns_linkname',
  'ns_fee',
  'igshid',
  'si',
])

// Prefix-match parameters to remove
const TRACKING_PREFIXES = [
  'utm_',
  'mtm_',
]

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase()
  if (TRACKING_PARAMS.has(lower)) return true
  for (const prefix of TRACKING_PREFIXES) {
    if (lower.startsWith(prefix)) return true
  }
  return false
}

/**
 * Remove tracking parameters from a URL.
 * Returns the cleaned URL, or the original if parsing fails.
 */
export function cleanUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return rawUrl
  }

  const params = url.searchParams
  const keysToDelete: string[] = []
  for (const key of params.keys()) {
    if (isTrackingParam(key)) {
      keysToDelete.push(key)
    }
  }

  if (keysToDelete.length === 0) return rawUrl

  for (const key of keysToDelete) {
    params.delete(key)
  }

  // Remove trailing '?' if no params remain
  return url.toString()
}
