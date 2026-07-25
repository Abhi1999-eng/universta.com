import Link from 'next/link';

export function SiteHeader({ detail = false }: { detail?: boolean }) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/countries">universta<span>.</span></Link>
        <nav aria-label="Primary navigation">
          <Link href="/subjects">Subjects</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/countries">Countries</Link>
          <Link href={detail ? '#consultation' : '#country-results'}>{detail ? 'Get counselling' : 'Explore'}</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div><Link className="brand" href="/countries">universta<span>.</span></Link><p>Structured, source-aware study destination guidance for your next step.</p></div>
        <div><p className="footer-note">Information is editorial and may vary by institution, programme, applicant, and policy. Verify important decisions with official sources.</p></div>
      </div>
    </footer>
  );
}
