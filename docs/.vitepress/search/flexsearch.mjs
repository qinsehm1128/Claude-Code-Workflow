export const FLEXSEARCH_INDEX_VERSION = 1

export function flexsearchEncode(text) {
  const normalized = String(text ?? '')
    .toLowerCase()
    .normalize('NFKC')

  const tokens = normalized.match(
    /[a-z0-9]+|[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g
  )

  return tokens ?? []
}

export const FLEXSEARCH_OPTIONS = {
  tokenize: 'forward',
  resolution: 9,
  cache: 100,
  encode: flexsearchEncode
}

export function createFlexSearchIndex(FlexSearch) {
  return new FlexSearch.Index(FLEXSEARCH_OPTIONS)
}

