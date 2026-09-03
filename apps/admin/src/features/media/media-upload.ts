import { authFetch } from '@/features/auth/auth-client';
import type { EditorialMedia } from '@/features/catalog/catalog.types';

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
  width?: number | null;
  height?: number | null;
  originalFileName: string;
};

type MediaLibraryAsset = UploadedMediaAsset & {
  mimeType?: string;
  status?: string;
  deletedAt?: string | null;
};

type Envelope<T> = {
  data: T | null;
  error: { message?: string } | null;
};

export function validateMediaFile(file: File): string | null {
  if (
    !ACCEPTED_MEDIA_MIME_TYPES.includes(
      file.type as (typeof ACCEPTED_MEDIA_MIME_TYPES)[number],
    )
  ) {
    return 'Unsupported file type. Use JPEG, PNG, WEBP or GIF.';
  }
  if (file.size > MAX_MEDIA_BYTES) return 'File must be 5MB or smaller.';
  return null;
}

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
  const validationError = validateMediaFile(file);
  if (validationError) throw new Error(validationError);

  const form = new FormData();
  form.append('file', file);
  if (meta.title) form.append('title', meta.title);
  if (meta.altText) form.append('altText', meta.altText);
  if (meta.folder) form.append('folder', meta.folder);

  const response = await authFetch('/api/v1/admin/media', {
    method: 'POST',
    body: form,
  });
  const body = (await response.json()) as Envelope<UploadedMediaAsset>;
  if (!response.ok || body.error || !body.data) {
    throw new Error(body.error?.message ?? 'Upload failed');
  }
  return body.data;
}

export function toEditorialMedia(asset: UploadedMediaAsset): EditorialMedia {
  return {
    id: asset.id,
    url: asset.publicUrl.replace('/media/', '/api/v1/media/'),
    title: asset.title,
    alt: asset.altText,
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

/**
 * Single source of truth for every admin media picker: this reads the same
 * active-media endpoint as Media Library itself, so the two surfaces cannot
 * disagree about which uploaded images are available.
 */
export async function listActiveMediaLibrary(
  query = '',
  limit = 50,
  /** Image slots pass 'image'; the Media Library itself passes nothing and
   * still sees every asset. */
  kind?: 'image',
): Promise<EditorialMedia[]> {
  const params = new URLSearchParams({
    limit: String(Math.min(50, Math.max(1, limit))),
  });
  if (query.trim()) params.set('q', query.trim());
  if (kind) params.set('kind', kind);

  const response = await authFetch(
    `/api/v1/admin/media?${params.toString()}`,
  );
  const body = (await response.json()) as Envelope<MediaLibraryAsset[]>;
  if (!response.ok || body.error || !body.data) {
    throw new Error(body.error?.message ?? 'Unable to load media library');
  }

  return body.data
    .filter(
      (asset) =>
        !asset.deletedAt && (!asset.status || asset.status === 'ACTIVE'),
    )
    .map(toEditorialMedia);
}
