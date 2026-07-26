export type CounsellingSource =
  | 'general'
  | 'country'
  | 'subject'
  | 'specialization'
  | 'course';

type CounsellingContext = {
  source: CounsellingSource;
  country?: string;
  subject?: string;
  specialization?: string;
  course?: string;
  from?: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_-]*$/;

export function counsellingHref(context: CounsellingContext): string {
  const params = new URLSearchParams({ source: context.source });
  for (const key of [
    'country',
    'subject',
    'specialization',
    'course',
  ] as const) {
    const value = context[key];
    if (value && SLUG.test(value)) params.set(key, value);
  }
  if (context.from && SAFE_PATH.test(context.from)) {
    params.set('from', context.from);
  }
  return `/counselling?${params.toString()}`;
}
