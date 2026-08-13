'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStudentSession } from './StudentSession';
import type {
  AcademicRecord,
  Completion,
  EnglishTest,
  NamedRecord,
  StudentProfile,
} from './student-types';

/**
 * "Let's build your study profile."
 *
 * Six short steps instead of one long form. Each step saves on its own, so
 * leaving halfway loses nothing, and every step except the first can be
 * skipped — we ask for optional things, we do not demand them.
 */

const STEPS = [
  { key: 'personal', label: 'Personal details', optional: false },
  { key: 'preferences', label: 'Study preferences', optional: false },
  { key: 'education', label: 'Education', optional: false },
  { key: 'english', label: 'English test', optional: true },
  { key: 'work', label: 'Work experience', optional: true },
  { key: 'passport', label: 'Passport', optional: true },
] as const;

interface Options {
  countries: NamedRecord[];
  subjects: NamedRecord[];
  courseLevels: NamedRecord[];
}

async function loadOptions(): Promise<Options> {
  const response = await fetch('/api/student-lookups', { cache: 'no-store' });
  if (!response.ok) return { countries: [], subjects: [], courseLevels: [] };
  const body: unknown = await response.json();
  return (
    (body as { data?: Options })?.data ?? {
      countries: [],
      subjects: [],
      courseLevels: [],
    }
  );
}

export function StudentOnboarding() {
  const { api } = useStudentSession();
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<Options>({
    countries: [],
    subjects: [],
    courseLevels: [],
  });
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [opts, prof, comp] = await Promise.all([
        loadOptions(),
        api<StudentProfile>('/profile').catch(() => null),
        api<Completion>('/profile/completion').catch(() => null),
      ]);
      if (cancelled) return;
      setOptions(opts);
      if (prof) setProfile(prof);
      if (comp) setCompletion(comp);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, version]);

  const run = async (work: () => Promise<void>, message: string) => {
    setError(null);
    setSaving(true);
    try {
      await work();
      setVersion((value) => value + 1);
      setSaved(message);
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const current = STEPS[step];

  return (
    <>
      <h1>Let’s build your study profile</h1>
      <p className="lede">
        Six short steps. Everything saves as you go, so you can stop and come
        back whenever you like.
      </p>

      <ol className="stu-steps" aria-label="Progress">
        {STEPS.map((item, index) => (
          <li
            key={item.key}
            className={index === step ? 'on' : index < step ? 'done' : ''}
          >
            <span className="sr-only">{item.label}</span>
          </li>
        ))}
      </ol>

      <section className="stu-card" aria-labelledby="step-heading">
        <p className="stu-step-label">
          Step {step + 1} of {STEPS.length}
          {current.optional ? ' · optional' : ''}
        </p>
        <h2 id="step-heading">{current.label}</h2>

        {error ? (
          <p className="stu-alert error" role="alert">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className="stu-alert ok" role="status">
            {saved}
          </p>
        ) : null}

        {current.key === 'personal' ? (
          <PersonalStep
            key={profile ? 'personal-ready' : 'personal-loading'}
            profile={profile}
            countries={options.countries}
            saving={saving}
            onSave={(payload) =>
              run(async () => {
                setProfile(
                  await api<StudentProfile>('/profile', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(payload),
                  }),
                );
              }, 'Personal details saved.')
            }
          />
        ) : null}

        {current.key === 'preferences' ? (
          <PreferencesStep
            key={profile ? 'prefs-ready' : 'prefs-loading'}
            profile={profile}
            options={options}
            saving={saving}
            onSave={(payload) =>
              run(async () => {
                setProfile(
                  await api<StudentProfile>('/profile', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(payload),
                  }),
                );
              }, 'Study preferences saved.')
            }
          />
        ) : null}

        {current.key === 'education' ? (
          <EducationStep
            saving={saving}
            onSave={(payload) =>
              run(async () => {
                await api<AcademicRecord>('/academics', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(payload),
                });
              }, 'Qualification added.')
            }
          />
        ) : null}

        {current.key === 'english' ? (
          <EnglishStep
            saving={saving}
            onSave={(payload) =>
              run(async () => {
                await api<EnglishTest>('/english-tests', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(payload),
                });
              }, 'English test saved.')
            }
          />
        ) : null}

        {current.key === 'work' ? (
          <WorkStep
            saving={saving}
            onSave={(payload) =>
              run(async () => {
                await api('/work-experience', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(payload),
                });
              }, 'Work experience saved.')
            }
          />
        ) : null}

        {current.key === 'passport' ? (
          <PassportStep
            countries={options.countries}
            saving={saving}
            onSave={(payload) =>
              run(async () => {
                await api('/passport', {
                  method: 'PUT',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(payload),
                });
              }, 'Passport saved.')
            }
          />
        ) : null}

        <div className="stu-actions">
          {step > 0 ? (
            <button
              type="button"
              className="stu-btn ghost"
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="stu-btn ghost"
              onClick={() => {
                setSaved(null);
                setError(null);
                setStep((value) => value + 1);
              }}
            >
              {current.optional ? 'Skip this step' : 'Do this later'}
            </button>
          ) : null}
          <Link className="stu-btn ghost" href="/student">
            Continue later
          </Link>
        </div>
      </section>

      {completion ? (
        <p className="stu-empty" role="status">
          Profile {completion.percentage}% complete
          {completion.nextSectionLabel
            ? ` · next: ${completion.nextSectionLabel}`
            : ''}
        </p>
      ) : null}
    </>
  );
}

/* -- steps ---------------------------------------------------------------- */

function Save({ saving }: { saving: boolean }) {
  return (
    <button className="stu-btn" type="submit" disabled={saving}>
      {saving ? 'Saving…' : 'Save & continue'}
    </button>
  );
}

function PersonalStep({
  profile,
  countries,
  saving,
  onSave,
}: {
  profile: StudentProfile | null;
  countries: NamedRecord[];
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  // Seeded once from what the profile already holds; the parent gives this
  // component a key so it re-mounts when the profile finishes loading.
  const [dateOfBirth, setDateOfBirth] = useState(
    profile?.personal.dateOfBirth ?? '',
  );
  const [nationality, setNationality] = useState(
    profile?.personal.nationalityCountry?.id ?? '',
  );
  const [currentCountry, setCurrentCountry] = useState(
    profile?.personal.currentCountry?.id ?? '',
  );
  const [city, setCity] = useState(profile?.personal.currentCityText ?? '');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          dateOfBirth: dateOfBirth || null,
          nationalityCountryId: nationality || null,
          currentCountryId: currentCountry || null,
          currentCityText: city || null,
        });
      }}
    >
      <div className="stu-field">
        <label htmlFor="ob-dob">Date of birth</label>
        <input
          id="ob-dob"
          type="date"
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
        />
      </div>
      <div className="stu-grid">
        <div className="stu-field">
          <label htmlFor="ob-nationality">Nationality</label>
          <select
            id="ob-nationality"
            value={nationality}
            onChange={(event) => setNationality(event.target.value)}
          >
            <option value="">Select a country</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stu-field">
          <label htmlFor="ob-current">Where you live now</label>
          <select
            id="ob-current"
            value={currentCountry}
            onChange={(event) => setCurrentCountry(event.target.value)}
          >
            <option value="">Select a country</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="stu-field">
        <label htmlFor="ob-city">City</label>
        <input
          id="ob-city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
      </div>
      <Save saving={saving} />
    </form>
  );
}

function PreferencesStep({
  profile,
  options,
  saving,
  onSave,
}: {
  profile: StudentProfile | null;
  options: Options;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [subject, setSubject] = useState(
    profile?.studyPreferences.subject?.id ?? '',
  );
  const [level, setLevel] = useState(
    profile?.studyPreferences.courseLevel?.id ?? '',
  );
  const [destinations, setDestinations] = useState<string[]>(
    profile?.studyPreferences.countries.map((country) => country.id) ?? [],
  );

  const toggle = (id: string) =>
    setDestinations((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          preferredSubjectId: subject || null,
          preferredCourseLevelId: level || null,
          preferredCountryIds: destinations,
        });
      }}
    >
      <div className="stu-grid">
        <div className="stu-field">
          <label htmlFor="ob-subject">What do you want to study?</label>
          <select
            id="ob-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="">Select a subject</option>
            {options.subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stu-field">
          <label htmlFor="ob-level">Which degree?</label>
          <select
            id="ob-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">Select a level</option>
            {options.courseLevels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset
        style={{ border: 0, padding: 0, margin: '0 0 16px' }}
      >
        <legend
          style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, padding: 0 }}
        >
          Where would you like to study?
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {options.countries.slice(0, 14).map((country) => (
            <label
              key={country.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 13px',
                border: '1px solid var(--stu-line)',
                borderRadius: 999,
                background: destinations.includes(country.id)
                  ? 'var(--stu-blue-50)'
                  : '#fff',
                fontSize: 14.5,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={destinations.includes(country.id)}
                onChange={() => toggle(country.id)}
                style={{ width: 16, height: 16 }}
              />
              {country.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Save saving={saving} />
    </form>
  );
}

function EducationStep({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [qualificationName, setQualification] = useState('');
  const [institutionName, setInstitution] = useState('');
  const [endDate, setEndDate] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          qualificationName,
          institutionName,
          endDate: endDate || null,
        });
      }}
    >
      <div className="stu-field">
        <label htmlFor="ob-qual">Highest qualification</label>
        <input
          id="ob-qual"
          required
          placeholder="Bachelor of Science"
          value={qualificationName}
          onChange={(event) => setQualification(event.target.value)}
        />
      </div>
      <div className="stu-field">
        <label htmlFor="ob-institution">School or university</label>
        <input
          id="ob-institution"
          required
          value={institutionName}
          onChange={(event) => setInstitution(event.target.value)}
        />
      </div>
      <div className="stu-field">
        <label htmlFor="ob-end">Finished (or expect to finish)</label>
        <input
          id="ob-end"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </div>
      <Save saving={saving} />
    </form>
  );
}

function EnglishStep({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [testType, setTestType] = useState('IELTS');
  const [overallScore, setOverall] = useState('');
  const [testDate, setTestDate] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          testType,
          overallScore: Number(overallScore),
          testDate: testDate || null,
        });
      }}
    >
      <div className="stu-grid">
        <div className="stu-field">
          <label htmlFor="ob-test">Which test did you take?</label>
          <select
            id="ob-test"
            value={testType}
            onChange={(event) => setTestType(event.target.value)}
          >
            <option value="IELTS">IELTS</option>
            <option value="PTE">PTE</option>
            <option value="TOEFL">TOEFL</option>
            <option value="DUOLINGO">Duolingo</option>
            <option value="OTHER">Another test</option>
          </select>
        </div>
        <div className="stu-field">
          <label htmlFor="ob-score">Overall score</label>
          <input
            id="ob-score"
            type="number"
            step="0.5"
            min="0"
            required
            value={overallScore}
            onChange={(event) => setOverall(event.target.value)}
          />
        </div>
      </div>
      <div className="stu-field">
        <label htmlFor="ob-test-date">Test date</label>
        <input
          id="ob-test-date"
          type="date"
          value={testDate}
          onChange={(event) => setTestDate(event.target.value)}
        />
      </div>
      <Save saving={saving} />
    </form>
  );
}

function WorkStep({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [companyName, setCompany] = useState('');
  const [jobTitle, setTitle] = useState('');
  const [startDate, setStart] = useState('');
  const [currentlyWorking, setCurrent] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ companyName, jobTitle, startDate, currentlyWorking });
      }}
    >
      <div className="stu-grid">
        <div className="stu-field">
          <label htmlFor="ob-company">Employer</label>
          <input
            id="ob-company"
            required
            value={companyName}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>
        <div className="stu-field">
          <label htmlFor="ob-title">Job title</label>
          <input
            id="ob-title"
            required
            value={jobTitle}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      <div className="stu-field">
        <label htmlFor="ob-start">Started</label>
        <input
          id="ob-start"
          type="date"
          required
          value={startDate}
          onChange={(event) => setStart(event.target.value)}
        />
      </div>
      <div className="stu-field">
        <label
          htmlFor="ob-current-role"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <input
            id="ob-current-role"
            type="checkbox"
            checked={currentlyWorking}
            onChange={(event) => setCurrent(event.target.checked)}
            style={{ width: 17, height: 17, minHeight: 0 }}
          />
          I still work here
        </label>
      </div>
      <Save saving={saving} />
    </form>
  );
}

function PassportStep({
  countries,
  saving,
  onSave,
}: {
  countries: NamedRecord[];
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [passportNumber, setNumber] = useState('');
  const [issuingCountryId, setCountry] = useState('');
  const [expiryDate, setExpiry] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          passportNumber,
          issuingCountryId: issuingCountryId || null,
          expiryDate: expiryDate || null,
        });
      }}
    >
      <p className="stu-alert info">
        Only you can see this. We ask because universities and visa
        applications need it later.
      </p>
      <div className="stu-field">
        <label htmlFor="ob-passport">Passport number</label>
        <input
          id="ob-passport"
          required
          autoComplete="off"
          value={passportNumber}
          onChange={(event) => setNumber(event.target.value)}
        />
      </div>
      <div className="stu-grid">
        <div className="stu-field">
          <label htmlFor="ob-passport-country">Issued by</label>
          <select
            id="ob-passport-country"
            value={issuingCountryId}
            onChange={(event) => setCountry(event.target.value)}
          >
            <option value="">Select a country</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stu-field">
          <label htmlFor="ob-passport-expiry">Expires</label>
          <input
            id="ob-passport-expiry"
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </div>
      </div>
      <Save saving={saving} />
    </form>
  );
}
