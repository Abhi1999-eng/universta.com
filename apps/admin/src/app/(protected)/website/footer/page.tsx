import { SettingsManager } from "@/features/settings/SettingsManager";

/** Focused Global Footer editor. Reads and writes the same `footer` and
 * `contact`/`social` settings rows the public footer consumes. */
export default function GlobalFooterRoute() {
  return (
    <SettingsManager
      only={["footer", "contact", "social"]}
      eyebrow="Website Builder"
      title="Global Footer"
      intro="Controls the footer on every public page. Footer link columns are managed in Website Builder → Navigation menus."
    />
  );
}
