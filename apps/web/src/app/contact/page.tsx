import { ReferenceContactPage } from '@/components/templates/ReferenceStaticPages';
import { staticPageMetadata } from '@/lib/static-page-seo'; export async function generateMetadata() {
  return staticPageMetadata('contact', 'Contact Universta', 'Send an enquiry to the Universta team.', '/contact');
} export default function ContactPage() { return <ReferenceContactPage />; }
