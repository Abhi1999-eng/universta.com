import Link from 'next/link';

/**
 * The hand-off to the consultants directory, as the subject and
 * specialization guides close their funding sections.
 *
 * The reference puts consultants on every subject and specialization page.
 * A consultant's record carries the destinations and services they cover,
 * not subjects, so no list here could honestly be "the consultants for
 * Software Engineering": the block names the field and sends the reader to
 * the directory, where those facts are, rather than showing four people
 * picked for no reason -- and its heading does not claim a coverage the
 * records do not hold.
 */
export function ConsultantsCta({ field }: { field: string }) {
  return (
    <div className="consultcta">
      <div className="consultcta__copy">
        <p className="eyebrow eyebrow--plain">Consultants</p>
        <h3 className="consultcta__t">Talk to a consultant about {field}</h3>
        <p className="consultcta__d">
          Compare the destinations they work with, the services they offer and
          how they are verified.
        </p>
      </div>
      <div className="consultcta__actions">
        <Link className="btn" href="/study-abroad-consultants">
          Find consultants{' '}
          <span className="btn__arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
