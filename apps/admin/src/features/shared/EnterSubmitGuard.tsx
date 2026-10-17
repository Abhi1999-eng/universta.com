/** Goes first inside an editor's `<form>`.
 *
 * Enter in a text field submits the form through its first submit button. In
 * every editor that is "Save draft" -- "Move to draft" on a published record
 * -- so a stray Enter in the slug or the SEO title took a live record off the
 * site. This button comes before them and is disabled, and a form whose first
 * submit button is disabled is not submitted by Enter at all. The action
 * buttons themselves still work as before. */
export function EnterSubmitGuard() {
  return <button type="submit" disabled hidden aria-hidden="true" tabIndex={-1} data-enter-guard="" />;
}
