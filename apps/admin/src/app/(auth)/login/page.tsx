import { LoginScreen } from '@/features/auth/LoginScreen';
import { safeReturnTo } from '@/features/auth/return-to';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = params.returnTo;
  const returnTo = Array.isArray(value) ? value[0] : value;
  return <LoginScreen returnTo={safeReturnTo(returnTo)} />;
}
