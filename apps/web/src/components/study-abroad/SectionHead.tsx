import type { ReactNode } from 'react';

/**
 * The approved design's section head: the numbered eyebrow and the title on
 * the left, the lead and any call to action on the right. Every section of a
 * guide opens with it, so the run reads as one document rather than a stack
 * of differently built blocks.
 */
export function SectionHead({
  n,
  eyebrow,
  title,
  lead,
  children,
}: {
  /** The section's place in the guide's numbered run, if it has one. */
  n?: string | null;
  eyebrow?: string | null;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="sec-head sec-head--split">
      <div className="sec-head__aside">
        {eyebrow || n ? (
          <p className="eyebrow">
            {n ? (
              <>
                <span className="eyebrow__n">{n}</span>{' '}
              </>
            ) : null}
            {eyebrow}
          </p>
        ) : null}
        <h2 className="sec-title">{title}</h2>
      </div>
      {lead || children ? (
        <div>
          {lead ? <p className="sec-lead">{lead}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
