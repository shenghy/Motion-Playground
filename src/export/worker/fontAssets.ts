import syneUrl from '@fontsource-variable/syne/files/syne-latin-wght-normal.woff2?url'
import mono400Url from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url'
import notoUnicodeRanges from '@fontsource-variable/noto-sans-sc/unicode.json'

const notoModules = import.meta.glob<string>(
  '/node_modules/@fontsource-variable/noto-sans-sc/files/*.woff2',
  { eager: true, query: '?url', import: 'default' },
)

export const notoWorkerFontAssets = Object.entries(notoModules).map(
  ([path, source]) => {
    const subset = path.match(/noto-sans-sc-(.+)-wght-normal\.woff2$/)?.[1]
    const rangeKey = subset && /^\d+$/.test(subset) ? `[${subset}]` : subset
    if (!rangeKey || !(rangeKey in notoUnicodeRanges)) {
      throw new Error(`Missing Noto Sans SC unicode range for ${path}`)
    }
    return {
      source,
      unicodeRange: notoUnicodeRanges[rangeKey as keyof typeof notoUnicodeRanges],
    }
  },
)

export const workerFontAssets = {
  display: syneUrl,
  mono: mono400Url,
} as const
