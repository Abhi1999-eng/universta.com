import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MediaUploader } from './MediaUploader';

const uploadMediaFile = vi.fn();
vi.mock('./media-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./media-upload')>()),
  uploadMediaFile: (...args: unknown[]) => uploadMediaFile(...args),
}));

/* EV-C6. The picker's uploader was a form inside the record editor's form:
   its submit reached the editor, so uploading an image saved the record and
   closed the editor. */
describe('the uploader inside an editor', () => {
  it('uploads without submitting the editor around it', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    uploadMediaFile.mockResolvedValue({ id: 'media-1', publicUrl: '/media/fair.jpg' });
    const editorSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onUploaded = vi.fn();
    render(
      <form aria-label="Edit events" onSubmit={editorSubmit}>
        <MediaUploader embedded onUploaded={onUploaded} />
      </form>,
    );
    const file = new File(['image'], 'fair-hall.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose an image file'), file);
    await userEvent.type(screen.getByLabelText('Alt text'), 'A fair hall{Enter}');
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'Upload and use image' }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2));
    expect(editorSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('media-uploader').tagName).toBe('DIV');
  });
});
