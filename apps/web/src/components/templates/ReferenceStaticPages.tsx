import Link from 'next/link';
import { ContactForm } from '@/components/phase1/ContactForm';
import { PageSectionRenderer } from '@/components/phase1/PageSectionRenderer';
import { PhaseOneFooter, PhaseOneHeader } from '@/components/phase1/PhaseOneChrome';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';

function Crumbs({ current }: { current: string }) {
  return <nav className="reference-static-crumbs reference-static-wrap" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><strong>{current}</strong></nav>;
}

function FinalCta() {
  return <section className="reference-static-final"><div className="reference-static-wrap"><h2>Start your global education journey with Universta</h2><p>Explore published universities, courses and scholarships, then take a clear next step when you are ready.</p><div><Link href="/universities">Explore universities</Link><Link href="/counselling">Book free counselling</Link></div></div></section>;
}

const features = [
  ['Global university discovery', 'Explore the currently published destinations, universities and available offerings.'],
  ['Smart course search', 'Use the public catalogue filters to narrow your study direction.'],
  ['Scholarship finder', 'Review published scholarship information and its stated eligibility.'],
  ['Compare before you apply', 'Compare published country, university, course and consultant records.'],
  ['Trusted consultant network', 'Review listed services, locations, languages and direct contact options.'],
  ['End-to-end support', 'Use catalogue information as a starting point for a counselling conversation.'],
];

export function ReferenceAboutPage({ page }: { page?: AnyRecord | null }) {
  const title = 'Helping Students Build Their Future Through Global Education';
  const description = page?.shortDescription ?? 'Universta helps students discover published destinations, universities, courses and scholarships, then take their next step with confidence.';
  const sections = page?.sections ?? [];
  return <main className="reference-static-page reference-about-page"><PhaseOneHeader /><Crumbs current="About" />
    <section className="reference-static-hero"><div className="reference-static-wrap reference-static-hero-grid"><div><span>Our story · A global education ecosystem</span><h1>{title}</h1><p>{description}</p><div className="reference-static-actions"><Link href="/universities">Explore universities</Link><Link href="/counselling">Create free account</Link></div></div><div className="reference-about-orbit" aria-hidden="true"><div>⌂</div><i>✦</i><b>●</b><em>◆</em></div></div></section>
    <section className="reference-static-section"><div className="reference-static-wrap reference-static-center"><span>What drives us</span><h2>Our Mission &amp; Vision</h2><div className="reference-mission-grid"><article><b>◎</b><h3>Our Mission</h3><p>Make international education information easier to explore through structured, published catalogue records.</p></article><article><b>◉</b><h3>Our Vision</h3><p>Help students make informed decisions with transparent pathways and clear next steps.</p></article></div></div></section>
    <section className="reference-static-section reference-static-soft"><div className="reference-static-wrap reference-static-center"><span>Why Universta</span><h2>What makes Universta different</h2><p className="reference-static-intro">One platform for the study abroad journey — built around useful, current published information.</p><div className="reference-static-feature-grid">{features.map(([heading, body]) => <article key={heading}><b>✦</b><h3>{heading}</h3><p>{body}</p></article>)}</div></div></section>
    <section className="reference-static-section"><div className="reference-static-wrap reference-static-center"><span>The journey</span><h2>How Universta helps students</h2><div className="reference-journey-grid">{['Discover', 'Compare', 'Choose', 'Apply', 'Study abroad'].map((item, index) => <article key={item}><b>{index + 1}</b><h3>{item}</h3><p>Use the published catalogue to take the next clear step.</p></article>)}</div></div></section>
    {sections.length ? <section className="reference-static-section reference-static-cms"><div className="reference-static-wrap">{sections.map((section: AnyRecord) => <PageSectionRenderer section={section} key={section.id} />)}</div></section> : null}
    <FinalCta /><PhaseOneFooter /></main>;
}

export function ReferenceContactPage() {
  return <main className="reference-static-page reference-contact-page"><PhaseOneHeader /><Crumbs current="Contact" />
    <section className="reference-static-hero"><div className="reference-static-wrap reference-static-hero-grid"><div><span>We usually reply within one business day</span><h1>We&apos;re Here to Help</h1><p>Whether you&apos;re planning to study abroad, looking to partner with us, or considering a listed consultant, the Universta team is ready to assist.</p><div className="reference-static-actions"><a href="#contact-form">Send us a message</a><Link href="/counselling">Book free consultation</Link></div></div><div className="reference-contact-illustration" aria-hidden="true"><b>▰</b><i>▭</i><em>●</em></div></div></section>
    <section className="reference-static-wrap reference-contact-cards"><article><b>✉</b><h3>Email</h3><p>General support</p><strong>Use the form below</strong></article><article><b>⌕</b><h3>Phone</h3><p>Contact details are shown where published.</p><strong>General enquiry</strong></article><article><b>⌖</b><h3>Office</h3><p>Universta HQ</p><strong>Online support</strong></article><article><b>▢</b><h3>Live Chat</h3><p>Contact the team during business hours.</p><strong>Start with an enquiry</strong></article></section>
    <section id="contact-form" className="reference-static-section reference-static-soft"><div className="reference-static-wrap"><div className="reference-static-center"><span>Get in touch</span><h2>Send us a message</h2><p className="reference-static-intro">Fill in the form and the right team will get back to you.</p></div><div className="reference-contact-form-wrap"><ContactForm /><aside><h3>Choosing the right team</h3><p>Students &amp; parents — admissions guidance</p><p>Universities — partnerships &amp; listings</p><p>Consultants — join the network</p><div><b>Prefer to talk it through?</b><p>Book a free counselling conversation with Universta.</p><Link href="/counselling">Book free counselling</Link></div></aside></div></div></section>
    <FinalCta /><PhaseOneFooter /></main>;
}
