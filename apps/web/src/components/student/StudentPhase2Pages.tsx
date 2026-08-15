"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useStudentSession } from "./StudentSession";

type Mode =
  | "saved"
  | "applications"
  | "scholarships"
  | "messages"
  | "notifications"
  | "support"
  | "referrals"
  | "deadlines"
  | "recommendations";
type Item = Record<string, unknown>;

const STATUS_LABELS: Record<string, string> = {
  APPLICATION_STARTED: "Application started",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  OFFER_RECEIVED: "Offer received",
  ACCEPTED: "Offer accepted",
  REJECTED: "Not successful",
  WITHDRAWN: "Withdrawn",
  ENROLLED: "Enrolled",
  STARTED: "Application started",
  AWARDED: "Awarded",
  NOT_ELIGIBLE: "Not eligible yet",
  IN_PROGRESS: "In progress",
};

function statusLabel(value: unknown) {
  const valueAsString = String(value ?? "");
  return STATUS_LABELS[valueAsString] ?? valueAsString.toLowerCase().replaceAll("_", " ");
}

function titleFor(mode: Mode) {
  return (
    {
      saved: [
        "Saved items",
        "Keep universities, courses and scholarships together.",
      ],
      applications: [
        "My applications",
        "Follow each application from start to decision.",
      ],
      scholarships: [
        "Scholarship applications",
        "Track scholarship applications and deadlines.",
      ],
      messages: ["Messages", "Keep your adviser conversation in one place."],
      notifications: [
        "Notifications",
        "Important updates about your study journey.",
      ],
      support: [
        "Support",
        "Get help with applications, documents or your portal.",
      ],
      referrals: [
        "Refer a friend",
        "Share Universta and view your referral progress.",
      ],
      deadlines: [
        "Upcoming deadlines",
        "Deadlines linked to your active applications.",
      ],
      recommendations: [
        "Recommended for you",
        "Published offerings selected from your study preferences.",
      ],
    } as const
  )[mode];
}

export function StudentPhase2Page({ mode }: { mode: Mode }) {
  const { api } = useStudentSession();
  const [data, setData] = useState<Item | Item[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [ticketCategory, setTicketCategory] = useState("APPLICATION");
  const [heading, lede] = titleFor(mode);

  const path =
    mode === "saved"
      ? "/saved"
      : mode === "applications"
        ? "/applications"
        : mode === "scholarships"
          ? "/scholarship-applications"
          : mode === "messages"
            ? "/messages"
            : mode === "notifications"
              ? "/notifications"
              : mode === "support"
                ? "/support-tickets"
                : mode === "deadlines"
                  ? "/deadlines"
                  : mode === "recommendations"
                    ? "/recommendations"
                    : "/referrals";
  const load = useCallback(
    () =>
      api<Item | Item[]>(path)
        .then(setData)
        .catch((cause: Error) => setError(cause.message)),
    [api, path],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: message }),
      });
      setMessage("");
      load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const createTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticketSubject.trim() || !ticketBody.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/support-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: ticketCategory,
          subject: ticketSubject,
          body: ticketBody,
        }),
      });
      setTicketSubject("");
      setTicketBody("");
      load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>{heading}</h1>
      <p className="lede">{lede}</p>
      {error ? (
        <p className="stu-alert error" role="alert">
          {error}
        </p>
      ) : null}
      {mode === "saved" ? (
        <SavedItems data={data as Item | null} api={api} reload={load} />
      ) : null}
      {mode === "applications" ? (
        <ApplicationList data={data as Item[] | null} />
      ) : null}
      {mode === "scholarships" ? (
        <ScholarshipList data={data as Item[] | null} />
      ) : null}
      {mode === "messages" ? (
        <section className="stu-card">
          <Messages data={data as Item | null} />
          <form onSubmit={sendMessage} className="stu-field">
            <label htmlFor="student-message">New message</label>
            <textarea
              id="student-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={5000}
              required
            />
            <button className="stu-btn" disabled={busy}>
              {busy ? "Sending…" : "Send message"}
            </button>
          </form>
        </section>
      ) : null}
      {mode === "notifications" ? (
        <NotificationList
          data={data as Item[] | null}
          api={api}
          reload={load}
        />
      ) : null}
      {mode === "support" ? (
        <>
          <section className="stu-card">
            <h2>New support request</h2>
            <form onSubmit={createTicket}>
              <div className="stu-field">
                <label htmlFor="ticket-category">Category</label>
                <select id="ticket-category" value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value)}>
                  <option value="APPLICATION">Application</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="SCHOLARSHIP">Scholarship</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="stu-field">
                <label htmlFor="ticket-subject">Subject</label>
                <input
                  id="ticket-subject"
                  value={ticketSubject}
                  onChange={(event) => setTicketSubject(event.target.value)}
                  maxLength={255}
                  required
                />
              </div>
              <div className="stu-field">
                <label htmlFor="ticket-body">How can we help?</label>
                <textarea
                  id="ticket-body"
                  value={ticketBody}
                  onChange={(event) => setTicketBody(event.target.value)}
                  maxLength={5000}
                  required
                />
              </div>
              <button className="stu-btn" disabled={busy}>
                {busy ? "Sending…" : "Send request"}
              </button>
            </form>
          </section>
          <SupportList data={data as Item[] | null} />
        </>
      ) : null}
      {mode === "deadlines" ? (
        <DeadlineList data={data as Item | null} />
      ) : null}
      {mode === "recommendations" ? (
        <RecommendationList data={data as Item | null} />
      ) : null}
      {mode === "referrals" ? (
        <section className="stu-card">
          <Referral data={data as Item | null} />
        </section>
      ) : null}
    </>
  );
}

function SavedItems({
  data,
  api,
  reload,
}: {
  data: Item | null;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  reload: () => void;
}) {
  const router = useRouter();
  const [comparisonItems, setComparisonItems] = useState<Record<string, string[]>>({});
  if (!data) return <Loading />;
  const groups = [
    ["Universities", data.universities as Item[], "universities", "university"],
    ["Courses", data.offerings as Item[], "offerings", "offering"],
    [
      "Scholarships",
      data.scholarships as Item[],
      "scholarships",
      "scholarship",
    ],
  ] as const;
  return (
    <>
      {groups.map(([label, rows, path, relation]) => {
        const compareType = path === "universities" ? "universities" : path === "offerings" ? "courses" : null;
        const selected = comparisonItems[path] ?? [];
        return (
        <section className="stu-card" key={path} id={path === "universities" ? "universities" : path === "offerings" ? "courses" : "scholarships"}>
          <h2>{label}</h2>
          {rows?.length ? (
            rows.map((row) => {
              const entity = row[relation] as Item;
              const name = String(
                entity?.name ?? entity?.title ?? "Saved item",
              );
              const slug = String(entity?.slug ?? "");
              const universitySlug = String(
                (entity?.university as Item | undefined)?.slug ?? "",
              );
              return (
                <div
                  className="stu-row"
                  key={String(row.studentProfileId) + String(row.createdAt)}
                >
                  <div>
                    <h3>{name}</h3>
                    <p className="meta">
                      {entity?.status === "PUBLISHED"
                        ? "Available"
                        : "No longer publicly available"}
                    </p>
                  </div>
                  <div className="stu-actions">
                    {compareType ? <label><input type="checkbox" checked={selected.includes(slug)} onChange={() => setComparisonItems((current) => {
                      const prior = current[path] ?? [];
                      const next = prior.includes(slug) ? prior.filter((item) => item !== slug) : prior.length < 3 ? [...prior, slug] : prior;
                      return { ...current, [path]: next };
                    })} /> Compare</label> : null}
                    <Link
                      className="stu-btn ghost"
                      href={
                        relation === "offering"
                          ? `/universities/${universitySlug}/courses/${slug}`
                          : relation === "scholarship"
                            ? `/scholarships/${slug}`
                            : `/universities/${slug}`
                      }
                    >
                      View
                    </Link>
                    <button
                      className="stu-btn ghost"
                      onClick={() =>
                        void api(`/saved/${path}/${String(entity.id)}`, {
                          method: "DELETE",
                        }).then(reload)
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="stu-empty">No saved {label.toLowerCase()} yet.</p>
          )}
          {compareType && selected.length >= 2 ? <button className="stu-btn ghost" onClick={() => router.push(`/compare/${compareType}?items=${encodeURIComponent(selected.join(","))}`)}>Compare selected</button> : null}
        </section>
      );
      })}
    </>
  );
}

function ApplicationList({ data }: { data: Item[] | null }) {
  if (!data) return <Loading />;
  return (
    <section className="stu-card">
      {data.length ? (
        data.map((row) => (
          <div className="stu-row" key={String(row.id)}>
            <div>
              <h3>
                {String(
                  (row.offering as Item | null)?.name ??
                    row.offeringNameSnapshot,
                )}
              </h3>
              <p className="meta">
                {String(
                  (row.university as Item | null)?.name ??
                    row.universityNameSnapshot,
                )}{" "}
                · {statusLabel(row.status)}
              </p>
            </div>
            <Link className="stu-btn ghost" href={`/student/applications/${String(row.id)}`}>Continue</Link>
          </div>
        ))
      ) : (
        <Empty
          text="Start an application from a university course page."
          link="/universities"
        />
      )}
    </section>
  );
}
function ScholarshipList({ data }: { data: Item[] | null }) {
  if (!data) return <Loading />;
  return (
    <section className="stu-card">
      {data.length ? (
        data.map((row) => (
          <div className="stu-row" key={String(row.id)}>
            <div>
              <h3>
                {String(
                  (row.scholarship as Item | null)?.title ??
                    row.scholarshipTitleSnapshot,
                )}
              </h3>
              <p className="meta">{statusLabel(row.status)}</p>
            </div>
            <Link className="stu-btn ghost" href={`/student/scholarships/${String(row.id)}`}>
              Continue
            </Link>
          </div>
        ))
      ) : (
        <Empty
          text="Start a scholarship application from a scholarship page."
          link="/scholarships"
        />
      )}
    </section>
  );
}
function Messages({ data }: { data: Item | null }) {
  if (!data) return <Loading />;
  const rows = (data.messages as Item[]) ?? [];
  return (
    <>
      <h2>Your adviser conversation</h2>
      {rows.length ? (
        rows.map((row) => (
          <div className="stu-row" key={String(row.id)}>
            <div>
              <h3>
                {String(row.senderType) === "STUDENT"
                  ? "You"
                  : "Universta team"}
              </h3>
              <p>{String(row.body)}</p>
            </div>
          </div>
        ))
      ) : (
        <p className="stu-empty">
          No messages yet. Send a message to start the conversation.
        </p>
      )}
    </>
  );
}
function NotificationList({
  data,
  api,
  reload,
}: {
  data: Item[] | null;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  reload: () => void;
}) {
  if (!data) return <Loading />;
  return (
    <section className="stu-card">
      {data.some((row) => !row.readAt) ? <button className="stu-btn ghost" onClick={() => void api('/notifications/read-all', { method: 'PATCH' }).then(reload)}>Mark all read</button> : null}
      {data.length ? (
        data.map((row) => (
          <div className="stu-row" key={String(row.id)}>
            <div>
              <h3>{String(row.title)}</h3>
              <p className="meta">{String(row.body ?? "")}</p>
            </div>
            {!row.readAt ? (
              <button
                className="stu-btn ghost"
                onClick={() =>
                  void api(`/notifications/${String(row.id)}/read`, {
                    method: "PATCH",
                  }).then(reload)
                }
              >
                Mark read
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <p className="stu-empty">You’re all caught up.</p>
      )}
    </section>
  );
}
function SupportList({ data }: { data: Item[] | null }) {
  if (!data) return <Loading />;
  return (
    <section className="stu-card">
      <h2>Your requests</h2>
      {data.length ? (
        data.map((row) => (
          <div className="stu-row" key={String(row.id)}>
            <div>
              <h3>{String(row.subject)}</h3>
              <p className="meta">{statusLabel(row.status)}</p>
            </div>
          </div>
        ))
      ) : (
        <p className="stu-empty">No support requests yet.</p>
      )}
    </section>
  );
}
function Referral({ data }: { data: Item | null }) {
  if (!data) return <Loading />;
  const refs = (data.referrals as Item[]) ?? [];
  return (
    <>
      <h2>Your referral code</h2>
      <p className="stu-next">{String(data.code ?? "")}</p>
      <p className="meta">Share this registration link with a friend. Referral attribution is set once when they create their account.</p>
      <a className="stu-btn ghost" href={`/r/${encodeURIComponent(String(data.code ?? ""))}`}>Open referral link</a>
      <h2 style={{ marginTop: 24 }}>Referral progress</h2>
      {refs.length ? (
        refs.map((row) => (
          <p className="stu-row" key={String(row.id)}>
            {String(row.referredStudent ?? "Referred student")} · {statusLabel(row.stage)} · {statusLabel(row.rewardStatus)}
          </p>
        ))
      ) : (
        <p className="stu-empty">No referrals yet.</p>
      )}
    </>
  );
}
function DeadlineList({ data }: { data: Item | null }) {
  if (!data) return <Loading />;
  const courses = (data.courseIntakes as Item[]) ?? [];
  const scholarships = (data.scholarships as Item[]) ?? [];
  const rows = [
    ...courses.map((row) => ({
      label: String((row.offering as Item)?.name ?? "Course intake"),
      deadline: String(row.deadline ?? ""),
    })),
    ...scholarships.map((row) => ({
      label: String((row.scholarship as Item)?.title ?? "Scholarship"),
      deadline: String((row.scholarship as Item)?.deadline ?? ""),
    })),
  ].filter((row) => row.deadline);
  return (
    <section className="stu-card">
      {rows.length ? (
        rows.map((row) => (
          <div className="stu-row" key={`${row.label}-${row.deadline}`}>
            <div>
              <h3>{row.label}</h3>
              <p className="meta">
                Due{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                }).format(new Date(row.deadline))}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="stu-empty">No active deadlines yet.</p>
      )}
    </section>
  );
}
function RecommendationList({ data }: { data: Item | null }) {
  if (!data) return <Loading />;
  const countries = (data.countries as Item[] | undefined) ?? [];
  const universities = (data.universities as Item[] | undefined) ?? [];
  const offerings = (data.offerings as Item[] | undefined) ?? [];
  return (
    <>
      <section className="stu-card"><h2>Countries</h2>{countries.length ? countries.map((row) => <Link className="stu-row" key={String(row.id)} href={`/countries/${String(row.slug)}`}>{String(row.name)} <span>{String(row.reason)}</span></Link>) : <p className="stu-empty">Add preferred countries to see recommendations.</p>}</section>
      <section className="stu-card"><h2>Universities</h2>{universities.length ? universities.map((row) => <Link className="stu-row" key={String(row.id)} href={`/universities/${String(row.slug)}`}>{String(row.name)} <span>{String(row.reason)}</span></Link>) : <p className="stu-empty">Add preferences to see universities.</p>}</section>
      <section className="stu-card"><h2>Courses</h2>{offerings.length ? (
        offerings.map((row) => (
          <div className="stu-row" key={String(row.id)}>
            <div>
              <h3>{String(row.name)}</h3>
              <p className="meta">
                {String((row.university as Item)?.name ?? "")}
              </p>
            </div>
            <Link
              className="stu-btn ghost"
              href={`/universities/${String((row.university as Item)?.slug ?? "")}/courses/${String(row.slug)}`}
            >
              View course
            </Link>
          </div>
        ))
      ) : (
        <Empty
          text="Add your study preferences to receive recommendations."
          link="/student/profile"
        />
      )}</section>
    </>
  );
}
function Loading() {
  return (
    <section className="stu-card">
      <p className="stu-empty">Loading…</p>
    </section>
  );
}
function Empty({ text, link }: { text: string; link: string }) {
  return (
    <p className="stu-empty">
      {text} <Link href={link}>Explore now</Link>.
    </p>
  );
}
