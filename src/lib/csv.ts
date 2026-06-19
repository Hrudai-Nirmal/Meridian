/**
 * Small CSV serialization and response helpers for secret-safe exports.
 */

export type CsvResponseMetadata = {
  rowLimit: number
  rowCount: number
  truncated: boolean
}

/**
 * Escapes a value for safe CSV output.
 */
export function csvEscape(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

/**
 * Serializes rows to CSV text.
 */
export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")
}

/**
 * Returns a no-store CSV download response with optional export metadata.
 */
export function csvResponse(filename: string, csv: string, metadata?: CsvResponseMetadata) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      ...(metadata
        ? {
            "X-Meridian-Row-Limit": String(metadata.rowLimit),
            "X-Meridian-Row-Count": String(metadata.rowCount),
            "X-Meridian-Truncated": String(metadata.truncated),
            "X-ArgusGrid-Row-Limit": String(metadata.rowLimit),
            "X-ArgusGrid-Row-Count": String(metadata.rowCount),
            "X-ArgusGrid-Truncated": String(metadata.truncated),
          }
        : {}),
    },
  })
}
