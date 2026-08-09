import { GlobalHeaderWorkspace } from "@/features/website/GlobalHeaderWorkspace";

/** Global Header editor. Branding, menu, buttons and the announcement bar in
 * one screen with a single save, rather than the raw settings form. */
export default function GlobalHeaderRoute() {
  return <GlobalHeaderWorkspace />;
}
