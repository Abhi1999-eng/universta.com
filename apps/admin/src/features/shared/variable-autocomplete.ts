import {
  CONTENT_VARIABLE_CONTEXTS,
  variablesForContentContext,
  type ContentVariableContext,
} from '../../../../../packages/content-variables';

export type DynamicVariable = {
  key: string;
  label: string;
};

export type VariableTrigger = {
  start: number;
  end: number;
  query: string;
};

/** Country naming stays exported for existing Country/SEO callers. */
export const COUNTRY_EDITORIAL_VARIABLES = variablesForContentContext('country');

/** Contexts are centrally registered only when their public resolver exists. */
export const EDITOR_VARIABLE_CONTEXTS = CONTENT_VARIABLE_CONTEXTS;
export type EditorVariableContext = ContentVariableContext;

export function variablesForContext(context?: EditorVariableContext) {
  return variablesForContentContext(context);
}

export function findVariableTrigger(
  value: string,
  cursor: number,
): VariableTrigger | null {
  const prefix = value.slice(0, cursor);
  const match = prefix.match(/([{%])([^{}%\s]*)$/);
  if (!match || match.index === undefined) return null;
  return { start: match.index, end: cursor, query: match[2] };
}

export function insertVariableToken(
  value: string,
  trigger: VariableTrigger,
  variable: DynamicVariable,
) {
  const token = `{${variable.key}}`;
  return {
    value: `${value.slice(0, trigger.start)}${token}${value.slice(trigger.end)}`,
    cursor: trigger.start + token.length,
  };
}
