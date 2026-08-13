'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudentSession } from './StudentSession';
import { DOCUMENT_CHECKLIST, type StudentDocument } from './student-types';

/**
 * Documents as a checklist, not a file manager.
 *
 * A student wants to know what is still missing, so each expected document is
 * a row that is either done or not. Extra files land underneath. Nothing here
 * shows a media id or a storage path.
 */
export function StudentDocumentsPage() {
  const { api } = useStudentSession();
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  /** Bumped by anything that changes the list; the effect below is the single
   * place that reads it back. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await api<StudentDocument[]>('/documents');
        if (!cancelled) setDocuments(rows);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, version]);

  const upload = async (documentType: string, file: File) => {
    setError(null);
    setBusyType(documentType);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('documentType', documentType);
      await api('/documents', { method: 'POST', body: form });
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not upload that file',
      );
    } finally {
      setBusyType(null);
    }
  };

  const remove = async (id: string) => {
    await api(`/documents/${id}`, { method: 'DELETE' }).catch(() => undefined);
    reload();
  };

  const found = (type: string) =>
    documents.find((document) => document.documentType === type);

  const extras = documents.filter(
    (document) =>
      !DOCUMENT_CHECKLIST.some((item) => item.type === document.documentType),
  );

  return (
    <>
      <h1>Your documents</h1>
      <p className="lede">
        Upload these when you have them. PDF, Word or a clear photo all work.
      </p>

      {error ? (
        <p className="stu-alert error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="stu-card" aria-labelledby="checklist-heading">
        <h2 id="checklist-heading">Checklist</h2>
        {DOCUMENT_CHECKLIST.map((item) => {
          const existing = found(item.type);
          return (
            <div className="stu-check" key={item.type}>
              <span
                className={`mark ${existing ? 'done' : 'todo'}`}
                aria-hidden="true"
              >
                {existing ? '✓' : '!'}
              </span>
              <div className="what">
                <h3>{item.label}</h3>
                <small>
                  {existing ? existing.fileName : 'Not uploaded yet'}
                </small>
              </div>
              <div className="do">
                <input
                  ref={(node) => {
                    inputs.current[item.type] = node;
                  }}
                  id={`upload-${item.type}`}
                  type="file"
                  accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(item.type, file);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="stu-btn ghost"
                  disabled={busyType === item.type}
                  onClick={() => inputs.current[item.type]?.click()}
                >
                  {busyType === item.type
                    ? 'Uploading…'
                    : existing
                      ? 'Replace'
                      : 'Upload'}
                </button>
                {existing ? (
                  <>
                    <a
                      className="stu-btn ghost"
                      href={existing.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      className="stu-btn link"
                      onClick={() => void remove(existing.id)}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      {extras.length ? (
        <section className="stu-card" aria-labelledby="extra-heading">
          <h2 id="extra-heading">Additional documents</h2>
          {extras.map((document) => (
            <div className="stu-check" key={document.id}>
              <span className="mark done" aria-hidden="true">
                ✓
              </span>
              <div className="what">
                <h3>{document.title}</h3>
                <small>{document.fileName}</small>
              </div>
              <div className="do">
                <a
                  className="stu-btn ghost"
                  href={document.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View
                </a>
                <button
                  type="button"
                  className="stu-btn link"
                  onClick={() => void remove(document.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
