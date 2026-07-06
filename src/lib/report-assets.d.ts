export const MAX_MAP_IMAGE_BYTES: number
export const MAX_BRAND_IMAGE_BYTES: number

export type ReportAssetInput = {
  asset?: {
    mimeType: string
    dataUrl: string
  }
  allowedMimeTypes: string[]
  maxBytes: number
  label: string
}

export type DecodedReportAsset = {
  data: Buffer | null
  mimeType: string | null
  error: string | null
}

export function decodeReportAsset(input: ReportAssetInput): DecodedReportAsset
