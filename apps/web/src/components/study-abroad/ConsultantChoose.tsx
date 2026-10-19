/**
 * "How to choose a consultant": the design's numbered checks, the same on
 * the directory and on each destination's consultants page. They apply
 * wherever a student plans to study, so a destination's page shows the
 * same eight rather than a version of its own.
 */
export const CONSULTANT_CHOOSE = [
  ['Check destination expertise', 'Ask how many students they have supported for this destination recently and at which level.'],
  ['Check university relationships', 'Ask which universities they represent or work with, and ask for evidence. A recommendation is not a partnership.'],
  ['Understand service fees', 'Ask for all fees in writing, including whether any university pays them a commission.'],
  ['Ask what is included', 'Confirm exactly which services are covered, from shortlisting to visa documents.'],
  ['Check credentials where they apply', 'Immigration advice is regulated in many countries. Check any claimed authorization on the official register.'],
  ['Avoid guarantees', 'No consultant can guarantee admission, a visa, a scholarship, a job or permanent residence. Treat guarantees as a warning sign.'],
  ['Review written agreements', 'Read the agreement before paying, including refund terms and what happens if an application is unsuccessful.'],
  ['Verify through official sources', 'Confirm requirements, deadlines and fees with the university and the official government website.'],
] as const;

export function ConsultantChoose() {
  return (
    <ol className="choosegrid">
      {CONSULTANT_CHOOSE.map(([title, body], index) => (
        <li className="choosegrid__item" key={title}>
          <span className="choosegrid__n">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="choosegrid__t">{title}</h3>
          <p className="choosegrid__d">{body}</p>
        </li>
      ))}
    </ol>
  );
}
