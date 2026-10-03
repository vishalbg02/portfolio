/**
 * Renders a JSON-LD block. `<` is escaped so data can never close the script tag.
 * Data blocks (type="application/ld+json") are not executed, so the CSP's script-src doesn't apply.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
