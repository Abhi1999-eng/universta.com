import { authFetch } from '@/features/auth/auth-client';
import type { EditorialMedia } from '@/features/catalog/catalog.types';

/** Mirrors apps/api/src/media/media.service.ts ALLOWED_MIME_TYPES /
 * MAX_FILE_SIZE_BYTES so the UI can reject an obviously-invalid file before
 * a round trip -- the backend remains the source of truth and re-checks
 * both on every upload. */
export const ACCEPTED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const ACCEPTED_MEDIA_ACCEPT = ACCEPTED_MEDIA_MIME_TYPES.join(',');
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export type UploadedMediaAsset = {
  id: string;
  publicUrl: string;
  title: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  originalFileName: string;
};

export function validateMediaFile(file: File): string | null {
  if (!ACCEPTED_MEDIA_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MEDIA_MIME_TYPES)[number])) {
    return 'Unsupported file type. Use JPEG, PNG, WEBP or GIF.';
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return 'File must be 5MB or smaller.';
  }
  return null;
}

/** Turns `my-campus_photo.jpg` into `My campus photo` for a first-pass
 * title/alt text -- refinable later through the existing media-edit
 * workflow, per the bulk-upload spec ("do not create an unnecessarily
 * complex metadata table"). */
export function titleFromFilename(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, '');
  const spaced = withoutExtension.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return fileName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function uploadMediaFile(
  file: File,
  meta: { title?: string; altText?: string; folder?: string } = {},
): Promise<UploadedMediaAsset> {
  const form = new FormData();
  form.append('file', file);
  if (meta.title) form.append('title', meta.title);
  if (meta.altText) form.append('altText', meta.altText);
  if (meta.folder) form.append('folder', meta.folder);
  const response = await authFetch('/api/v1/admin/media', { method: 'POST', body: form });
  const body = (await response.json()) as {
    data: UploadedMediaAsset | null;
    error: { message?: string } | null;
  };
  if (!response.ok || body.error || !body.data) {
    throw new Error(body.error?.message ?? 'Upload failed');
  }
  return body.data;
}

/** The raw upload response uses the MediaAsset column names (`publicUrl`,
 * `altText`); every consumer of the shared picker expects the narrower
 * `EditorialMedia` shape (`url`, `alt`) already used by media-options. Also
 * applies the same `/media/` -> `/api/v1/media/` rewrite MediaLibrary.tsx
 * already needs to render an uploaded asset's own image. */
export function toEditorialMedia(asset: UploadedMediaAsset): EditorialMedia {
  return {
    id: asset.id,
    url: asset.publicUrl.replace('/media/', '/api/v1/media/'),
    title: asset.title,
    alt: asset.altText,
    width: asset.width,
    height: asset.height,
  };
}
