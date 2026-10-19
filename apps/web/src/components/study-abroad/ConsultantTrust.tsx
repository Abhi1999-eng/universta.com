/**
 * "How Universta works with consultants": the design's trust box, said the
 * same way on every page that lists consultants -- the profile, the
 * directory, a destination's consultants and a city's -- so no two pages
 * can describe the arrangement differently.
 */
export const CONSULTANT_TRUST = [
  'Universta is a discovery and guidance platform. Consultant services are provided by independent third-party consultants.',
  'Consultant information is verified where possible, and each listing shows what has and has not been checked.',
  'No consultant can guarantee admission, a visa, a scholarship or a job. Treat any guarantee as a warning sign.',
] as const;

export function ConsultantTrust({ className }: { className?: string }) {
  return (
    <aside className={className ? `trustbox ${className}` : 'trustbox'} aria-label="How Universta works with consultants">
      <p className="path__h">How Universta works with consultants</p>
      <ul className="ticklist ticklist--sm">
        {CONSULTANT_TRUST.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}
