'use client';

import { useState } from 'react';
import { contactPayload } from '@/lib/contact-payload';

export function ContactForm() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement) {
    setBusy(true); setMessage('');
    try {
      const formData = new FormData(form);
      const response = await fetch('/api/contact-inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(contactPayload(formData)) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Unable to send enquiry');
      form.reset(); setMessage('Thanks — your enquiry has been received.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send enquiry'); } finally { setBusy(false); }
  }
  return <form className="phase1-contact-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><label>Full name<input name="fullName" required autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Phone (optional)<input name="phoneNumber" type="tel" autoComplete="tel" /></label><label>Subject (optional)<input name="subject" /></label><label className="phase1-wide">Message<textarea name="message" required rows={5} /></label><label className="phase1-honeypot" aria-hidden="true">Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label><label className="phase1-consent"><input name="privacyConsent" type="checkbox" value="true" required /> I agree that Universta may use this enquiry to respond.</label><button className="button" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send enquiry'}</button>{message ? <p role="status">{message}</p> : null}</form>;
}
