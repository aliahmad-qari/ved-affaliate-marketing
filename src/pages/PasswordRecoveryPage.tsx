import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { forgotPasswordRequest, resetPasswordRequest } from '../services/authApi.ts';

declare global { interface Window { __vedResetToken?: string; } }
export function PasswordRecoveryPage({ reset = false, onNavigate }: { reset?: boolean; onNavigate: (route: string) => void }) {
  const [token] = useState(() => window.__vedResetToken || new URLSearchParams(window.location.hash.slice(1)).get('token') || new URLSearchParams(window.location.search).get('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loginPath, setLoginPath] = useState(new URLSearchParams(window.location.search).get('account') === 'admin' ? 'admin/login' : 'login');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (reset && (!/^[a-f0-9]{64}$/.test(token))) { setError('Invalid reset link. Request a new password reset email.'); return; }
    if (reset && (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || new TextEncoder().encode(password).length > 72)) { setError('Use at least 8 characters with letters and numbers (maximum 72 UTF-8 bytes).'); return; }
    if (reset && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (reset) {
        const result = await resetPasswordRequest(token, password, confirmPassword);
        setMessage(result.message); setLoginPath(result.loginPath); setPassword(''); setConfirmPassword('');
        delete window.__vedResetToken;
      } else setMessage(await forgotPasswordRequest(email.trim(), loginPath === 'admin/login' ? 'admin' : 'partner'));
    } catch (err: any) { setError(err.message || 'Unable to complete the request. Please try again.'); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-md px-4 py-12 sm:py-20"><div className="rounded-2xl border border-[#263650] bg-[#0B1325] p-6 sm:p-8">
    <VedLogo variant="badge" size="sm" /><KeyRound aria-hidden="true" className="my-4 h-7 w-7 text-[#D4AF37]" />
    <h1 className="text-2xl font-bold text-white">{reset ? 'Reset Password' : 'Forgot Password?'}</h1>
    <p className="my-4 text-sm leading-relaxed text-[#AAB3C2]">{reset ? 'Choose a new password. Reset links expire after 15 minutes and work once.' : 'Enter your registered email address. We will send recovery instructions if your account is eligible.'}</p>
    {reset && !/^[a-f0-9]{64}$/.test(token) && <p role="alert" className="mb-4 text-sm text-rose-200">This reset link is invalid or missing. Please request a new link.</p>}
    {error && <p role="alert" className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
    {message ? <p role="status" className="my-4 rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-200">{message}</p> : <form onSubmit={submit} className="space-y-4">
      {reset ? <>{[['New password', password, setPassword], ['Confirm password', confirmPassword, setConfirmPassword]].map(([label, value, setter]: any) => <label key={label} className="block text-sm text-[#AAB3C2]">{label}<input required type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} value={value} onChange={event => setter(event.target.value)} className="mt-2 w-full rounded-lg border border-[#263650] bg-[#070B14] p-3 text-base text-white focus:border-[#D4AF37]" /></label>)}<button type="button" aria-pressed={showPasswords} onClick={() => setShowPasswords(value => !value)} className="flex items-center gap-2 text-sm text-[#D4AF37]">{showPasswords ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}{showPasswords ? 'Hide passwords' : 'Show passwords'}</button></> : <label className="block text-sm text-[#AAB3C2]">Registered email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-[#263650] bg-[#070B14] p-3 text-base text-white focus:border-[#D4AF37]" /></label>}
      <Button type="submit" variant="primary" fullWidth disabled={busy || (reset && !/^[a-f0-9]{64}$/.test(token))}>{busy ? 'Processing…' : reset ? 'Update Password' : 'Send Reset Link'}</Button>
    </form>}
    {reset && !message && <button type="button" className="mt-5 block text-sm text-[#D4AF37]" onClick={() => onNavigate('forgot-password')}>Request a new reset link</button>}
    <button type="button" className="mt-5 text-sm text-[#D4AF37] hover:underline" onClick={() => { delete window.__vedResetToken; if (reset && message) window.location.assign(`/${loginPath}`); else onNavigate(loginPath); }}>Back to sign in</button>
  </div></main>;
}
