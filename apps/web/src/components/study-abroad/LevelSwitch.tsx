'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { formatNumber } from '@/lib/format';

/**
 * The study-level bar over a field's level panels: pick a level and its
 * panel is the one shown.
 *
 * Every panel is drawn on the server and stays in the page, hidden rather
 * than left out, so its links are there for a reader without scripts and
 * for search engines. A link to a level's anchor (`#level-pg`) opens on that
 * level, as the stacked block's anchors did.
 */
export function LevelSwitch({
  levels,
  initial,
  panels,
}: {
  levels: Array<{ code: string; name: string; count: number; anchor: string }>;
  /** The level open first: the first with something listed. */
  initial: string;
  /** One per level, in the same order. */
  panels: ReactNode[];
}) {
  const [current, setCurrent] = useState(initial);

  useEffect(() => {
    const open = () => {
      const anchor = window.location.hash.slice(1);
      const hit = levels.find((level) => level.anchor === anchor);
      if (hit) setCurrent(hit.code);
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [levels]);

  return (
    <div className="courselevels studylevels">
      {levels.length > 1 ? (
        <div className="levelbar levelbar--wide" role="group" aria-label="Study level">
          <span className="filters__label">Study level</span>
          {levels.map((level) => (
            <button
              type="button"
              key={level.code}
              className={`chipbtn${level.count ? '' : ' chipbtn--none'}`}
              aria-pressed={current === level.code}
              aria-controls={level.anchor}
              onClick={() => setCurrent(level.code)}
            >
              {level.name}
              {/* A level with nothing here is the dashed chip; a 0 on it read
                  as the page counting wrong. */}
              {level.count ? (
                <>
                  {' '}
                  <span className="chipbtn__n datum">{formatNumber(level.count)}</span>
                </>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="coursegroups coursegroups--stack">
        {levels.map((level, index) => (
          <div key={level.code} hidden={current !== level.code}>
            {panels[index]}
          </div>
        ))}
      </div>
    </div>
  );
}
