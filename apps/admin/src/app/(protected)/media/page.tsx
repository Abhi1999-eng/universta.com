import { ArchivedMediaRecovery } from "@/features/media/ArchivedMediaRecovery";
import { MediaLibrary } from "@/features/media/MediaLibrary";

export default function MediaPage() {
  return (
    <>
      <MediaLibrary />
      <ArchivedMediaRecovery />
    </>
  );
}
