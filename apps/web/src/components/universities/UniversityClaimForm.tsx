'use client';

import { useState } from 'react';

/** The claim request form, in the design's form classes. What it sends and
 * where are as before: the honeypot, the consent box and the route the API
 * checks have not moved. */
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
      <div className="done">
        <p className="done__t" role="status">
          Thanks — your claim request has been received.
        </p>
        <p className="done__b">
          Our team will review it and follow up by email. Submitting this request does not grant
          any admin access to this listing.
        </p>
      </div>
    );
  }

  return (
    <form
      className="leadform"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      {message ? (
        <p className="formerr" role="alert">
          {message}
        </p>
      ) : null}
      <div className="leadform__grid">
        <div className="field">
          <label htmlFor="claimantName">Your full name</label>
          <input id="claimantName" name="claimantName" type="text" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="workEmail">Work email</label>
          <input id="workEmail" name="workEmail" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="jobTitle">Job title (optional)</label>
          <input id="jobTitle" name="jobTitle" type="text" autoComplete="organization-title" />
        </div>
        <div className="field">
          <label htmlFor="organization">Organization (optional)</label>
          <input id="organization" name="organization" type="text" autoComplete="organization" />
        </div>
        <div className="field">
          <label htmlFor="phoneNumber">Phone (optional)</label>
          <input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" />
        </div>
        <div className="field">
          <label htmlFor="officialWebsite">Official university website (optional)</label>
          <input id="officialWebsite" name="officialWebsite" type="url" placeholder="https://" />
        </div>
        <div className="field leadform__full">
          <label htmlFor="message">Why should this listing be assigned to you?</label>
          <textarea id="message" name="message" required rows={5} />
        </div>
      </div>
      <label className="sr-only" aria-hidden="true">
        Company website
        <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="leadform__consent" htmlFor="consent">
        <input id="consent" name="consent" type="checkbox" value="true" required />I confirm I am
        authorized to represent this institution and request this listing be assigned to me for
        review.
      </label>
      <button className="btn btn--accent btn--lg" disabled={busy} type="submit">
        {busy ? 'Submitting…' : 'Submit claim request'}
      </button>
      <p className="formnote">Every request is verified by the Universta team before anything changes.</p>
    </form>
  );
}
