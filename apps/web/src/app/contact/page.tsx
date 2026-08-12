import { ContactReference } from '@/components/reference/ContactReference';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return staticPageMetadata(
    'contact',
    'Contact Universta',
    'Send an enquiry to the Universta team.',
    '/contact',
  );
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

export default async function ContactPage() {
  const contact = await contactSettings();
  return (
    <ContactReference
      email={present(contact?.email)}
      phone={present(contact?.counsellingPhone)}
      address={present(contact?.address)}
      whatsappLink={present(contact?.whatsappLink)}
    />
  );
}
