import Link from "next/link";
import { Crumbs, PhaseOneFooter, PhaseOneHeader } from "./PhaseOneChrome";
import { RichText } from "./RichText";
import {
  countryPath,
  journeyExcerpt,
  programmePath,
  successStoryCount,
  successStoryPath,
  universityPath,
  type SuccessStoryRow,
} from "@/lib/success-story";

export { type SuccessStoryRow } from "@/lib/success-story";

function StoryMedia({ story }: { story: SuccessStoryRow }) {
  const media = story.featuredMedia;
  return media?.publicUrl ? (
    <img src={media.publicUrl} alt={media.altText ?? media.title ?? story.title} />
  ) : (
    <div className="catalog-card-placeholder" aria-hidden="true">
      {story.title.slice(0, 1)}
    </div>
  );
}

export function SuccessStoriesListing({
  stories,
  total,
}: {
  stories: SuccessStoryRow[];
  total: number;
}) {
  return (
    <main>
      <PhaseOneHeader />
      <section className="listing-hero">
        <div className="shell">
          <p className="eyebrow">Student journeys</p>
          <h1>Success Stories</h1>
          <p>Read long-form journeys from fictional demonstration profiles.</p>
        </div>
      </section>
      <section className="catalog-explorer shell" aria-labelledby="success-stories-heading">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Stories</p>
            <h2 id="success-stories-heading">{successStoryCount(total)}</h2>
          </div>
        </div>
        {stories.length ? (
          <div className="catalog-card-grid">
            {stories.map((story) => (
              <article className="catalog-card" key={story.id}>
                <StoryMedia story={story} />
                <div className="catalog-card-body">
                  <h2>
                    <Link href={successStoryPath(story.slug)}>{story.title}</Link>
                  </h2>
                  {story.attribution ? <p>{story.attribution}</p> : null}
                  {story.attributionNote ? <p className="source-note">{story.attributionNote}</p> : null}
                  <p>{journeyExcerpt(story.journey)}</p>
                  <Link className="card-link" href={successStoryPath(story.slug)}>
                    Read full story <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No success stories yet</h2>
            <p>Stories will appear here when they are ready to share.</p>
          </div>
        )}
      </section>
      <PhaseOneFooter />
    </main>
  );
}

function RelatedStoryFact({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | null;
  href: string | null;
}) {
  if (!value) return null;
  return (
    <section className="editorial-section">
      <p className="eyebrow">{label}</p>
      <h2>{label}</h2>
      {href ? <Link className="text-link" href={href}>{value}</Link> : <p>{value}</p>}
    </section>
  );
}

export function SuccessStoryDetail({ story }: { story: SuccessStoryRow }) {
  const programme = story.offering?.name ?? story.offering?.genericCourse?.name;
  const programmeHref = programmePath(story);
  return (
    <main>
      <PhaseOneHeader />
      <Crumbs items={[["Home", "/"], ["Success Stories", "/success-stories"], [story.title]]} />
      <section className="detail-hero">
        <div className="shell">
          <Link className="back-link" href="/success-stories">← Back to Success Stories</Link>
          <p className="eyebrow">Success story</p>
          <h1>{story.title}</h1>
          {story.attribution ? <p className="hero-copy">{story.attribution}</p> : null}
          {story.attributionNote ? <p className="source-note">{story.attributionNote}</p> : null}
        </div>
      </section>
      <section className="detail-content shell">
        <div className="detail-main">
          {story.featuredMedia?.publicUrl ? (
            <figure>
              <img className="section-media" src={story.featuredMedia.publicUrl} alt={story.featuredMedia.altText ?? story.featuredMedia.title ?? story.title} />
            </figure>
          ) : null}
          <section className="editorial-section">
            <p className="eyebrow">The journey</p>
            <h2>The Journey</h2>
            <RichText value={story.journey} />
          </section>
          <RelatedStoryFact
            label="Study destination"
            value={story.country?.name}
            href={story.country ? countryPath(story.country) : null}
          />
          <RelatedStoryFact
            label="University"
            value={story.university?.name}
            href={story.university ? universityPath(story.university) : null}
          />
          <RelatedStoryFact label="Programme" value={programme} href={programmeHref} />
        </div>
      </section>
      <section className="consultation-band">
        <div className="shell consultation-inner">
          <div>
            <p className="eyebrow">Planning a similar journey?</p>
            <h2>Explore your next step.</h2>
          </div>
          <div className="hero-actions">
            <Link className="button light" href="/courses">Explore Courses</Link>
            <Link className="button light" href="/counselling">Book Free Counselling</Link>
          </div>
        </div>
      </section>
      <PhaseOneFooter />
    </main>
  );
}
