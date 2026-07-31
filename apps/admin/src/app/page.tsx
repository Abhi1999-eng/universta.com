import { redirect } from 'next/navigation';

/** The Admin console has no landing page of its own; `/` exists only to send
 * people to the dashboard.
 *
 * Rendered on demand rather than prerendered. There is nothing to prerender --
 * the component returns no markup -- and statically generating it makes the
 * build render the client-side AuthProvider around a redirect that never
 * produces a tree, which fails the export. */
export const dynamic = 'force-dynamic';

export default function Home() {
  redirect('/dashboard');
}
