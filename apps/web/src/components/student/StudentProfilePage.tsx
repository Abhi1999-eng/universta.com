'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStudentSession } from './StudentSession';
import type {
  AcademicRecord,
  Completion,
  EnglishTest,
  Passport,
  StudentProfile,
  WorkExperience,
} from './student-types';

/**
 * One Profile page with sections, rather than one nav entry per table.
 *
 * Labels are what a student would say — "Highest qualification", "Preferred
 * study destination" — never the column or model name behind them.
 */
export function StudentProfilePage() {
  const { api } = useStudentSession();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [academics, setAcademics] = useState<AcademicRecord[]>([]);
  const [work, setWork] = useState<WorkExperience[]>([]);
  const [tests, setTests] = useState<EnglishTest[]>([]);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, a, w, t, pass, c] = await Promise.all([
          api<StudentProfile>('/profile'),
          api<AcademicRecord[]>('/academics'),
          api<WorkExperience[]>('/work-experience'),
          api<EnglishTest[]>('/english-tests'),
          api<Passport | null>('/passport'),
          api<Completion>('/profile/completion'),
        ]);
        if (cancelled) return;
        setProfile(p);
        setAcademics(a);
        setWork(w);
        setTests(t);
        setPassport(pass);
        setCompletion(c);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, version]);

  const remove = async (path: string) => {
    await api(path, { method: 'DELETE' }).catch(() => undefined);
    reload();
  };

  const value = (input: string | null | undefined) =>
    input && input.length ? input : 'Not added yet';

  return (
    <>
      <h1>Your profile</h1>
      <p className="lede">
        This is what universities will see when you apply. Add what you can —
        nothing here is urgent.
      </p>

      {error ? (
        <p className="stu-alert error" role="alert">
          {error}
        </p>
      ) : null}

      {completion ? (
        <section className="stu-card">
          <div className="stu-card-head">
            <h2>{completion.percentage}% complete</h2>
            <Link className="stu-btn" href="/student/onboarding">
              {completion.nextSectionLabel
                ? `Add ${completion.nextSectionLabel.toLowerCase()}`
                : 'Review profile'}
            </Link>
          </div>
          <div
            className="stu-progress"
            role="progressbar"
            aria-valuenow={completion.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <i style={{ width: `${completion.percentage}%` }} />
          </div>
        </section>
      ) : null}

      <section className="stu-card" aria-labelledby="personal-heading">
        <h2 id="personal-heading">Personal details</h2>
        <div className="stu-row">
          <div>
            <h3>Date of birth</h3>
            <p className="meta">{value(profile?.personal.dateOfBirth)}</p>
          </div>
        </div>
        <div className="stu-row">
          <div>
            <h3>Nationality</h3>
            <p className="meta">
              {value(profile?.personal.nationalityCountry?.name)}
            </p>
          </div>
        </div>
        <div className="stu-row">
          <div>
            <h3>Where you live</h3>
            <p className="meta">
              {[
                profile?.personal.currentCityText,
                profile?.personal.currentCountry?.name,
              ]
                .filter(Boolean)
                .join(', ') || 'Not added yet'}
            </p>
          </div>
        </div>
      </section>

      <section className="stu-card" aria-labelledby="prefs-heading">
        <h2 id="prefs-heading">Study preferences</h2>
        <div className="stu-row">
          <div>
            <h3>Subject</h3>
            <p className="meta">
              {value(profile?.studyPreferences.subject?.name)}
            </p>
          </div>
        </div>
        <div className="stu-row">
          <div>
            <h3>Preferred degree</h3>
            <p className="meta">
              {value(profile?.studyPreferences.courseLevel?.name)}
            </p>
          </div>
        </div>
        <div className="stu-row">
          <div>
            <h3>Preferred study destinations</h3>
            <p className="meta">
              {profile?.studyPreferences.countries.length
                ? profile.studyPreferences.countries
                    .map((country) => country.name)
                    .join(', ')
                : 'Not added yet'}
            </p>
          </div>
        </div>
      </section>

      <section className="stu-card" aria-labelledby="education-heading">
        <div className="stu-card-head">
          <h2 id="education-heading">Education</h2>
          <Link className="stu-btn ghost" href="/student/onboarding">
            Add
          </Link>
        </div>
        {academics.length ? (
          academics.map((record) => (
            <div className="stu-row" key={record.id}>
              <div>
                <h3>{record.qualificationName}</h3>
                <p className="meta">
                  {record.institutionName}
                  {record.endDate ? ` · finished ${record.endDate}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="stu-btn link"
                onClick={() => void remove(`/academics/${record.id}`)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="stu-empty">No qualifications added yet.</p>
        )}
      </section>

      <section className="stu-card" aria-labelledby="english-heading">
        <div className="stu-card-head">
          <h2 id="english-heading">English test</h2>
          <Link className="stu-btn ghost" href="/student/onboarding">
            Add
          </Link>
        </div>
        {tests.length ? (
          tests.map((test) => (
            <div className="stu-row" key={test.id}>
              <div>
                <h3>
                  {test.testType} · {test.overallScore}
                </h3>
                <p className="meta">
                  {test.testDate ? `Taken ${test.testDate}` : 'Date not added'}
                </p>
              </div>
              <button
                type="button"
                className="stu-btn link"
                onClick={() => void remove(`/english-tests/${test.id}`)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="stu-empty">No English test added yet.</p>
        )}
      </section>

      <section className="stu-card" aria-labelledby="work-heading">
        <div className="stu-card-head">
          <h2 id="work-heading">Work experience</h2>
          <Link className="stu-btn ghost" href="/student/onboarding">
            Add
          </Link>
        </div>
        {work.length ? (
          work.map((role) => (
            <div className="stu-row" key={role.id}>
              <div>
                <h3>{role.jobTitle}</h3>
                <p className="meta">
                  {role.companyName}
                  {role.currentlyWorking ? ' · current role' : ''}
                </p>
              </div>
              <button
                type="button"
                className="stu-btn link"
                onClick={() => void remove(`/work-experience/${role.id}`)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="stu-empty">No work experience added yet.</p>
        )}
      </section>

      <section className="stu-card" aria-labelledby="passport-heading">
        <div className="stu-card-head">
          <h2 id="passport-heading">Passport</h2>
          <Link className="stu-btn ghost" href="/student/onboarding">
            {passport ? 'Update' : 'Add'}
          </Link>
        </div>
        <p className="stu-alert info">Only you can see these details.</p>
        {passport ? (
          <>
            <div className="stu-row">
              <div>
                <h3>Passport number</h3>
                <p className="meta">{passport.passportNumber}</p>
              </div>
            </div>
            <div className="stu-row">
              <div>
                <h3>Expires</h3>
                <p className="meta">{value(passport.expiryDate)}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="stu-empty">No passport added yet.</p>
        )}
      </section>
    </>
  );
}
