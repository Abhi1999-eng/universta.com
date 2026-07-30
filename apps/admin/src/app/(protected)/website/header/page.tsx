import { SettingsManager } from "@/features/settings/SettingsManager";

/** Focused Global Header editor. Reads and writes the same `header` settings
 * row as the full Settings screen, so there is one source of truth. */
export default function GlobalHeaderRoute() {
  return (
    <SettingsManager
      only={["header"]}
      eyebrow="Website Builder"
      title="Global Header"
      intro="Controls the header on every public page. Menu items and their order are managed in Website Builder → Navigation menus."
    />
  );
}
