'use client';

import { useEffect, useRef } from 'react';

export function CatalogDialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#0D1524]/45 p-4" role="presentation">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-dialog-title"
        aria-describedby="catalog-dialog-description"
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl sm:p-8 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="catalog-dialog-title" className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
            <p id="catalog-dialog-description" className="mt-2 text-sm leading-6 text-[#667085]">{description}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg p-2 text-xl text-[#667085] hover:bg-[#F0F4FA] focus:outline-none focus:ring-2 focus:ring-[#1657CF]" aria-label="Close dialog">×</button>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

export function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-[#F2C5C5] bg-[#FFF7F7] p-6 text-sm text-[#9D2B2B]">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-[#E8A7A7] px-4 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-[#1657CF]">Retry</button>
    </div>
  );
}

export function CatalogLoading({ label = 'Loading catalog records…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="rounded-2xl border border-[#E8ECF3] bg-white p-10 text-center text-sm text-[#667085]">{label}</div>;
}
