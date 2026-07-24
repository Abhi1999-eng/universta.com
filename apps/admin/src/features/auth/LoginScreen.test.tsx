import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

const mockUseAuth = vi.fn();

vi.mock('./AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
  isAuthClientError: (error: unknown) => error instanceof Error,
}));

function renderLogin() {
  return render(<LoginScreen returnTo="/dashboard" />);
}

describe('LoginScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      status: 'unauthenticated',
      login: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders accessible labels and secure content', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByText('Super Admin')).toBeVisible();
  });

  it('validates required and invalid email fields', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(screen.getByText('Enter your email address.')).toBeVisible();
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
  });

  it('validates the required password field', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(screen.getByText('Enter your password.')).toBeVisible();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('normalizes email and submits without trimming the password', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ status: 'unauthenticated', login });
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), ' ADMIN@EXAMPLE.COM ');
    await user.type(screen.getByLabelText('Password'), ' secret ');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(login).toHaveBeenCalledWith('ADMIN@EXAMPLE.COM', ' secret ', '/dashboard');
  });

  it('shows a disabled loading state during submission', async () => {
    const user = userEvent.setup();
    let resolve: (() => void) | undefined;
    const login = vi.fn().mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    mockUseAuth.mockReturnValue({ status: 'unauthenticated', login });
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    resolve?.();
  });

  it('shows a generic invalid-credentials error', async () => {
    const user = userEvent.setup();
    const error = new Error('Invalid email or password');
    error.name = 'AuthClientError';
    mockUseAuth.mockReturnValue({ status: 'unauthenticated', login: vi.fn().mockRejectedValue(error) });
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('maps an unavailable API to a safe error', async () => {
    const user = userEvent.setup();
    const error = new Error('Authentication is temporarily unavailable. Try again shortly.');
    error.name = 'AuthClientError';
    mockUseAuth.mockReturnValue({ status: 'unauthenticated', login: vi.fn().mockRejectedValue(error) });
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Authentication is temporarily unavailable');
    expect(screen.queryByText(/stack|fetch|127\.0\.0\.1/i)).not.toBeInTheDocument();
  });

  it('does not show a form while auth is initializing', () => {
    mockUseAuth.mockReturnValue({ status: 'initializing', login: vi.fn() });
    renderLogin();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your admin session');
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });
});
