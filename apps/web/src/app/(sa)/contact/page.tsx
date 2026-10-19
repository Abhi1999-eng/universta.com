import type { Metadata } from 'next';
import { ContactPage } from '@/components/study-abroad/ContactPage';
import { prefilledSubject } from '@/lib/contact-payload';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'contact',
    'Contact Universta',
    'Send an enquiry to the Universta team.',
    '/contact',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

type Settings = {
  contact?: {
    email?: string;
    address?: string;
    counsellingPhone?: string;
    whatsappLink?: string;
  };
};

/** Contact details come from Settings, so an unset field simply drops its
 * card rather than showing the template's "+1 XXX XXX XXXX" placeholder. */
async function contactSettings(): Promise<Settings['contact']> {
  const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(`${baseUrl}/api/v1/phase1/settings`, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { data?: Settings };
    return body.data?.contact;
  } catch {
    return undefined;
  }
}

function present(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export default async function Contact({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [contact, params] = await Promise.all([contactSettings(), searchParams]);
  return (
    <ContactPage
      /* "Ask about this role" names the role in the Subject. */
      subject={prefilledSubject(params.subject)}
      email={present(contact?.email)}
      phone={present(contact?.counsellingPhone)}
      address={present(contact?.address)}
      whatsappLink={present(contact?.whatsappLink)}
    />
  );
}
