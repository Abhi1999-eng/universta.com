'use client';

import { useState } from 'react';

export function UniversityClaimForm({ universitySlug }: { universitySlug: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage('');
    try {
      const data = new FormData(form);
      const payload = {
        universitySlug,
        claimantName: String(data.get('claimantName') ?? ''),
        workEmail: String(data.get('workEmail') ?? ''),
        jobTitle: String(data.get('jobTitle') ?? '') || undefined,
        organization: String(data.get('organization') ?? '') || undefined,
        phoneNumber: String(data.get('phoneNumber') ?? '') || undefined,
        officialWebsite: String(data.get('officialWebsite') ?? '') || undefined,
        message: String(data.get('message') ?? ''),
        consent: data.get('consent') === 'true',
        companyWebsite: String(data.get('companyWebsite') ?? ''),
      };
      const response = await fetch('/api/university-claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Unable to submit claim');
      form.reset();
      setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit claim');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="phase1-notice" role="status">
        <p>
          <strong>Thanks — your claim request has been received.</strong> Our team
          will review it and follow up by email. Submitting this request does not
          grant any admin access to this listing.
        </p>
      </div>
    );
  }

  return (
    <form
      className="phase1-contact-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <label>
        Your full name
        <input name="claimantName" required autoComplete="name" />
      </label>
      <label>
        Work email
        <input name="workEmail" type="email" required autoComplete="email" />
      </label>
      <label>
        Job title (optional)
        <input name="jobTitle" />
      </label>
      <label>
        Organization (optional)
        <input name="organization" />
      </label>
      <label>
        Phone (optional)
        <input name="phoneNumber" type="tel" autoComplete="tel" />
      </label>
      <label>
        Official university website (optional)
        <input name="officialWebsite" type="url" placeholder="https://" />
      </label>
      <label className="phase1-wide">
        Why should this listing be assigned to you?
        <textarea name="message" required rows={5} />
      </label>
      <label className="phase1-honeypot" aria-hidden="true">
        Company website
        <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="phase1-consent">
        <input name="consent" type="checkbox" value="true" required />I confirm I am
        authorized to represent this institution and request this listing be
        assigned to me for review.
      </label>
      <button className="button" disabled={busy} type="submit">
        {busy ? 'Submitting…' : 'Submit claim request'}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
