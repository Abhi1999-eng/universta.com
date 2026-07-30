/**
 * Escapes `<` so a `</script>` sequence inside serialized JSON can never
 * terminate the surrounding <script type="application/ld+json"> tag early.
 */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
