import { GlobalFooterWorkspace } from "@/features/website/GlobalFooterWorkspace";

/** Global Footer editor. The footer is composed from rows and blocks here and
 * saved as one document; the flat footer settings ride along with the same
 * save rather than needing a separate screen. */
export default function GlobalFooterRoute() {
  return <GlobalFooterWorkspace />;
}
