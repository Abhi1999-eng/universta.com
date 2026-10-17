/** Puts a record's own address in the address bar the moment it is created,
 * in the middle of the save that created it.
 *
 * An editor's save writes the record first and then its countries, content,
 * SEO and status, and any of those can still fail. The form adopts the new
 * record at once so a retry updates it rather than creating it again; this
 * makes a reload open it too, instead of an empty "Create" form beside a
 * half-saved draft in the list.
 *
 * It is not a navigation. `/subjects/new` and `/subjects/[id]` are separate
 * routes, so `router.replace` here would unmount the form while its own save
 * is still running; the native history call is synced into Next's router
 * without rendering anything. The editors still `router.replace` once the
 * whole save is through.
 *
 * The entry keeps the Create route's tree under the record's address, so a
 * publish that leaves for the list replaces it rather than pushing past it:
 * pushed, Back would return to a blank Create form at the record's address. */
export function showCreatedAddress(path: string) {
  if (typeof window === 'undefined' || window.location.pathname === path) return;
  window.history.replaceState(null, '', path);
}
