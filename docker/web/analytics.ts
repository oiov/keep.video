import { cleanContext, EXAMPLE_URL, sourceCategory } from '../../shared/web-analytics'

export function browserContext(url?: string) {
  const params = new URLSearchParams(location.search)
  return cleanContext({
    utm: sourceCategory(params.get('utm_source') || ''),
    referrer: sourceCategory(document.referrer, location.hostname),
    language: document.documentElement.lang,
    input: url ? url === EXAMPLE_URL ? 'example' : 'user_input' : 'unknown',
    test: params.get('analytics_test') === '1',
  })
}
