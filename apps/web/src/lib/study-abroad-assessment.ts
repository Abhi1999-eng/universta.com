/**
 * The assessment from the approved design.
 *
 * Every one of the ten country pages ships an identical copy of this block, so
 * it is one constant rather than per-country data: a question set is not
 * something an editor tunes per destination, and storing ten copies would only
 * be ten things to keep in step. The destination step is the sole country-aware
 * part, and it reads the live directory rather than a hard-coded list.
 *
 * Scoring happens on the client for the progress the design shows, and again on
 * the server before anything is written -- a band posted by a browser is never
 * trusted.
 */

export type AssessmentOption = {
  value: string;
  label: string;
  note?: string;
  score?: number;
};

export type AssessmentStep = {
  id: string;
  question: string;
  help: string;
  type: 'choice' | 'country';
  options?: AssessmentOption[];
};

export type AssessmentBand = {
  id: string;
  label: string;
  min: number;
  note: string;
};

export type AssessmentConfig = {
  title: string;
  intro: string;
  steps: AssessmentStep[];
  result: {
    title: string;
    lead: string;
    capture: {
      title: string;
      note: string;
      cta: string;
      fields: Array<{ id: string; label: string; type: string; error: string }>;
    };
    success: { title: string; body: string };
  };
  scoring: { bands: AssessmentBand[] };
};

export const ASSESSMENT: AssessmentConfig = {
  "title": "Build your study plan",
  "intro": "Ten quick questions. Nothing is shared until you ask for your recommendations.",
  "steps": [
    {
      "id": "field",
      "question": "What do you want to study?",
      "help": "This sets the programmes and entry requirements we check against.",
      "type": "choice",
      "options": [
        {
          "value": "engineering",
          "label": "Engineering & Technology"
        },
        {
          "value": "computer-science",
          "label": "Computer Science & IT"
        },
        {
          "value": "business",
          "label": "Business & Management"
        },
        {
          "value": "health",
          "label": "Health & Life Sciences"
        },
        {
          "value": "social-sciences",
          "label": "Social Sciences & Law"
        },
        {
          "value": "arts",
          "label": "Arts, Design & Humanities"
        },
        {
          "value": "undecided",
          "label": "Still deciding",
          "score": -1
        }
      ]
    },
    {
      "id": "level",
      "question": "Which level are you applying for?",
      "help": "Entry rules differ sharply between levels.",
      "type": "choice",
      "options": [
        {
          "value": "bachelors",
          "label": "Bachelor's",
          "note": "3-4 years"
        },
        {
          "value": "masters",
          "label": "Master's",
          "note": "1-2 years"
        },
        {
          "value": "mba",
          "label": "MBA / Business",
          "note": "1-2 years"
        },
        {
          "value": "phd",
          "label": "PhD / Research",
          "note": "3-5 years"
        },
        {
          "value": "other",
          "label": "Diploma or other",
          "note": "Varies"
        }
      ]
    },
    {
      "id": "qualification",
      "question": "What have you studied so far?",
      "help": "We check whether your qualification is recognised for direct entry.",
      "type": "choice",
      "options": [
        {
          "value": "school",
          "label": "School / Class 12"
        },
        {
          "value": "diploma",
          "label": "Diploma"
        },
        {
          "value": "bachelors",
          "label": "Bachelor's degree"
        },
        {
          "value": "masters",
          "label": "Master's degree"
        }
      ]
    },
    {
      "id": "score",
      "question": "What is your academic score?",
      "help": "An approximate figure is fine. We convert it to the local grading scale.",
      "type": "choice",
      "options": [
        {
          "value": "high",
          "label": "Above 80% / 8.0 CGPA",
          "score": 2
        },
        {
          "value": "mid",
          "label": "65-80% / 6.5-8.0 CGPA",
          "score": 1
        },
        {
          "value": "low",
          "label": "50-65% / 5.0-6.5 CGPA"
        },
        {
          "value": "below",
          "label": "Below 50%"
        },
        {
          "value": "unknown",
          "label": "Not sure yet",
          "score": -1
        }
      ]
    },
    {
      "id": "language",
      "question": "Where are you with language tests?",
      "help": "Both English and local-language routes exist in most destinations.",
      "type": "choice",
      "options": [
        {
          "value": "have-english",
          "label": "I have an English score",
          "score": 2
        },
        {
          "value": "have-local",
          "label": "I have a local-language certificate",
          "score": 2
        },
        {
          "value": "booked",
          "label": "Test booked",
          "score": 1
        },
        {
          "value": "preparing",
          "label": "Preparing now"
        },
        {
          "value": "none",
          "label": "Not started"
        }
      ]
    },
    {
      "id": "experience",
      "question": "Do you have work experience?",
      "help": "Some programmes count it, and it strengthens a visa file.",
      "type": "choice",
      "options": [
        {
          "value": "none",
          "label": "None"
        },
        {
          "value": "under-2",
          "label": "Under 2 years"
        },
        {
          "value": "2-5",
          "label": "2-5 years",
          "score": 1
        },
        {
          "value": "over-5",
          "label": "More than 5 years",
          "score": 1
        }
      ]
    },
    {
      "id": "intake",
      "question": "Which intake are you targeting?",
      "help": "Application windows open far earlier than most students expect.",
      "type": "choice",
      "options": [
        {
          "value": "next",
          "label": "The next intake",
          "score": 2
        },
        {
          "value": "within-year",
          "label": "Within 12 months",
          "score": 1
        },
        {
          "value": "over-year",
          "label": "More than a year away"
        },
        {
          "value": "flexible",
          "label": "Flexible"
        }
      ]
    },
    {
      "id": "budget",
      "question": "What annual budget are you working with?",
      "help": "Tuition plus living costs, per year, in your own currency terms.",
      "type": "choice",
      "options": [
        {
          "value": "under-10k",
          "label": "Under 10,000 EUR equivalent",
          "score": 1
        },
        {
          "value": "10-20k",
          "label": "10,000 - 20,000",
          "score": 1
        },
        {
          "value": "20-35k",
          "label": "20,000 - 35,000",
          "score": 2
        },
        {
          "value": "over-35k",
          "label": "Above 35,000",
          "score": 2
        },
        {
          "value": "unsure",
          "label": "Not decided yet",
          "score": -1
        }
      ]
    },
    {
      "id": "destination",
      "question": "Which destination are you leaning towards?",
      "help": "You can change this later. It only shapes your first shortlist.",
      "type": "country"
    },
    {
      "id": "intent",
      "question": "Where are you in the process?",
      "help": "This tells us how much detail your plan should carry.",
      "type": "choice",
      "options": [
        {
          "value": "ready",
          "label": "Ready to apply",
          "score": 3
        },
        {
          "value": "shortlisting",
          "label": "Shortlisting universities",
          "score": 2
        },
        {
          "value": "researching",
          "label": "Researching options",
          "score": 1
        },
        {
          "value": "exploring",
          "label": "Just exploring"
        }
      ]
    }
  ],
  "result": {
    "title": "Your study profile is ready.",
    "lead": "Here is what we have so far. Add your contact details and we will match it against live programmes.",
    "capture": {
      "title": "Show my recommendations",
      "note": "We use these to send your shortlist. No spam, and we never sell your details.",
      "cta": "Show My Recommendations",
      "fields": [
        {
          "id": "name",
          "label": "Full name",
          "type": "text",
          "error": "Please enter your name."
        },
        {
          "id": "phone",
          "label": "WhatsApp number",
          "type": "tel",
          "error": "Please enter a valid phone number."
        },
        {
          "id": "email",
          "label": "Email",
          "type": "email",
          "error": "Please enter a valid email address."
        }
      ]
    },
    "success": {
      "title": "Your plan is on its way.",
      "body": "A counsellor will review your profile and send your matched options to the email and WhatsApp number you entered."
    }
  },
  "scoring": {
    "bands": [
      {
        "id": "high",
        "label": "High intent",
        "min": 9,
        "note": "Ready to apply, intake near, language in hand, budget defined."
      },
      {
        "id": "medium",
        "label": "Medium intent",
        "min": 4,
        "note": "Actively researching, some pieces still open."
      },
      {
        "id": "low",
        "label": "Early exploration",
        "min": -99,
        "note": "Early stage. Needs orientation before a shortlist."
      }
    ]
  }
} as const satisfies AssessmentConfig;

/** The band a total falls into. Bands are ordered high to low by `min`. */
export function bandFor(total: number): AssessmentBand {
  const ordered = [...ASSESSMENT.scoring.bands].sort((a, b) => b.min - a.min);
  return ordered.find((band) => total >= band.min) ?? ordered[ordered.length - 1];
}

/** The score a set of answers earns, from the options the design scores. */
export function scoreFor(answers: Record<string, string>): number {
  let total = 0;
  for (const step of ASSESSMENT.steps) {
    const chosen = answers[step.id];
    if (!chosen) continue;
    const option = step.options?.find((entry) => entry.value === chosen);
    if (option?.score) total += option.score;
  }
  return total;
}

export type ProfileRow = { id: string; question: string; answer: string };

/**
 * The answers as the result screen lists them: each question the student
 * answered, with the label they picked rather than the value stored for it.
 * The destination answer is a slug, so it is named from the guides on offer.
 */
export function profileFor(
  answers: Record<string, string>,
  destinations: ReadonlyArray<{ slug: string | null; name: string }>,
): ProfileRow[] {
  return ASSESSMENT.steps.flatMap((step) => {
    const value = answers[step.id];
    if (!value) return [];
    const answer =
      step.type === 'country'
        ? (destinations.find((entry) => entry.slug === value)?.name ?? value)
        : (step.options?.find((option) => option.value === value)?.label ?? value);
    return [{ id: step.id, question: step.question.replace(/\?$/, ''), answer }];
  });
}
