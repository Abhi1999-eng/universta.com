const DEFAULT_RETURN_TO = '/dashboard';

export function safeReturnTo(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_RETURN_TO;
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return DEFAULT_RETURN_TO;
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.startsWith('/login') ||
    decoded.includes('\\') ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded)
  ) {
    return DEFAULT_RETURN_TO;
  }

  return decoded;
}

export function currentReturnTo(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_RETURN_TO;
  }
  return safeReturnTo(`${window.location.pathname}${window.location.search}`);
}
