import type { LevelFact } from '@/lib/level-panel-info';

/**
 * The top of a level's panel on a field's own page: a line about the level
 * and a few facts about it, before its specializations and courses. Draws
 * nothing when there is neither.
 */
export function LevelInfo({ about, facts }: { about?: string | null; facts: readonly LevelFact[] }) {
  if (!about && !facts.length) return null;
  return (
    <div className="levelinfo">
      {about ? <p className="levelinfo__about">{about}</p> : null}
      {facts.length ? (
        <dl className="levelinfo__facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
