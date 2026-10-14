'use client';

import { useState } from 'react';
import Link from 'next/link';
import { contactPayload } from '@/lib/contact-payload';
import { Crumbs } from './Crumbs';
import { useStudyAbroadShell } from './StudyAbroadShell';

/**
 * The Contact page as the approved design draws it: a compact hero, three ways
 * to reach the team, then the support form.
 *
 * Kept from the page it replaces, because the design has nowhere for them:
 * the contact details an editor sets in Settings (each card drops out when its
 * field is empty, so nothing prints a placeholder), the phone and subject
 * fields, the spam trap and the consent box the API requires. The design's
 * "Request Evaluation" opens the same profile assessment the guides open; its
 * "For Institutions" page does not exist here, so that card points at the form.
 */

export type ContactDetails = {
  email: string | null;
  phone: string | null;
  address: string | null;
  whatsappLink: string | null;
};

export function ContactPage(props: ContactDetails) {
  const { openAssessment } = useStudyAbroadShell();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch('/api/contact-inquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(contactPayload(new FormData(form))),
      });
      if (!response.ok) throw new Error('failed');
      form.reset();
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const details = [
    props.email && { t: 'Email', d: 'General support', v: <a href={`mailto:${props.email}`}>{props.email}</a> },
    props.phone && { t: 'Phone', d: 'During business hours', v: <a href={`tel:${props.phone.replace(/\s+/g, '')}`}>{props.phone}</a> },
    props.address && { t: 'Office', d: null, v: props.address },
    props.whatsappLink && {
      t: 'WhatsApp',
      d: 'Message us directly',
      v: (
        <a href={props.whatsappLink} target="_blank" rel="noreferrer noopener">
          Open WhatsApp
        </a>
      ),
    },
  ].filter(Boolean) as Array<{ t: string; d: string | null; v: React.ReactNode }>;

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />
          <p className="hero__eyebrow">Contact</p>
          <h1 className="hero__h1">Contact Universta</h1>
          <p className="hero__sub">Send us a message and the right team will pick it up.</p>
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Ways to reach us</p>
            <h2 className="sec-title">How can we help?</h2>
          </div>
          <div className="h-grid">
            <div className="h-card">
              <strong className="h-card__t">Talk to an advisor</strong>
              <span className="h-card__d">Questions about countries, courses or applications.</span>
              <Link className="btn btn--sm" href="/counselling">
                Talk to a Universta Advisor
              </Link>
            </div>
            <div className="h-card">
              <strong className="h-card__t">Profile evaluation</strong>
              <span className="h-card__d">Ask an advisor to review your profile against your target courses.</span>
              <button className="btn btn--sm" type="button" onClick={() => openAssessment({ intent: 'contact-evaluation' })}>
                Request Evaluation
              </button>
            </div>
            <div className="h-card">
              <strong className="h-card__t">Institutions</strong>
              <span className="h-card__d">List or manage a university, provider, institute or consultancy.</span>
              <a className="linkcta" href="#support">
                Write to the team <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
          {details.length ? (
            <div className="h-grid h-grid--4" style={{ marginTop: 12 }}>
              {details.map((item) => (
                <div className="h-card h-card--plain" key={item.t}>
                  <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
                    {item.t}
                  </span>
                  <strong className="h-card__t">{item.v}</strong>
                  {item.d ? <span className="h-card__d">{item.d}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="sec sec--paper sec--tight h-sec" id="support">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Support</p>
            <h2 className="sec-title">Send a message to Universta support</h2>
          </div>
          <div className="h-formwrap">
            {sent ? (
              <div className="done">
                <p className="done__t" role="status">
                  Message sent — thank you. The right team will get back to you.
                </p>
                <div className="btn-row done__actions">
                  <button className="btn btn--ghost" type="button" onClick={() => setSent(false)}>
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="leadform"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(event.currentTarget);
                }}
              >
                {failed ? (
                  <p className="formerr" role="alert">
                    That did not send. Please try again{props.email ? ', or email us directly' : ''}.
                  </p>
                ) : null}
                <div className="leadform__grid">
                  <div className="field">
                    <label htmlFor="fullName">Full name</label>
                    <input id="fullName" name="fullName" type="text" required autoComplete="name" />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email address</label>
                    <input id="email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="phoneNumber">Phone number (optional)</label>
                    <input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" />
                  </div>
                  <div className="field">
                    <label htmlFor="subject">Subject (optional)</label>
                    <input id="subject" name="subject" type="text" />
                  </div>
                  <div className="field leadform__full">
                    <label htmlFor="message">Message</label>
                    <textarea id="message" name="message" required rows={5} />
                  </div>
                </div>
                <label className="sr-only" aria-hidden="true">
                  Company website
                  <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
                </label>
                <label className="leadform__consent" htmlFor="privacyConsent">
                  <input id="privacyConsent" name="privacyConsent" type="checkbox" value="true" required />
                  I agree that Universta may use this enquiry to respond.
                </label>
                <button className="btn btn--accent btn--lg" disabled={busy} type="submit">
                  {busy ? 'Sending…' : 'Send message'}
                </button>
                <p className="formnote">Never send passwords, card numbers or document files in a message.</p>
              </form>
            )}
          </div>
          <p className="h-more">
            <Link className="linkcta" href="/faq">
              Read the FAQ <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link className="linkcta" href="/counselling">
              Book free counselling <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
