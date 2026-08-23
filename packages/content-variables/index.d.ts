export type ContentVariable = { key: string; label: string };
export type ContentVariableContext =
  | 'country'
  | 'university'
  | 'offering'
  | 'course'
  | 'scholarship'
  | 'consultant'
  | 'job'
  | 'event'
  | 'successStory';

export const CONTENT_VARIABLE_CONTEXTS: Readonly<
  Record<ContentVariableContext, readonly ContentVariable[]>
>;
export function variablesForContentContext(
  context?: ContentVariableContext,
): readonly ContentVariable[];
export function resolveContentVariables(
  context: ContentVariableContext | string | undefined,
  value: string,
  source: Record<string, unknown>,
): string;
