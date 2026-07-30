import { Suspense } from "react";
import { LocationsManager } from "@/features/locations/LocationsManager";

export default function LocationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#667085]">Loading…</p>}>
      <LocationsManager />
    </Suspense>
  );
}
