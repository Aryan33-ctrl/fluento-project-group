import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { profileApi, errorMessage } from '../api/client.js';
import { Field, Spinner } from '../components/ui.jsx';
import { passwordRule } from './AuthPages.jsx';
import { fmtDate } from '../utils/format.js';
import './profile-settings.css'; // UI-only: glassmorphism styles scoped to .gx-page

/* Decorative icons (purely visual, hidden from assistive tech) */
const ICONS = {
  user: (<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  sliders: (<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>),
  bell: (<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  trash: (<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
};

const Section = ({ title, desc, icon, tone, children }) => (
  <section className={`gx-card p-5 sm:p-6${tone === 'danger' ? ' gx-danger' : ''}`}>
    <div className="gx-head">
      {icon && (
        <span className="gx-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {desc && <p className="text-sm text-muted">{desc}</p>}
      </div>
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

const Toggle = ({ label, desc, checked, onChange }) => (
  <label className="gx-toggle">
    <span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-muted">{desc}</span></span>
    <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="gx-switch" />
  </label>
);

export function ProfilePage() {
  const { user, setUser } = useAuth(); const toast = useToast();
  const nameForm = useForm({ resolver: zodResolver(z.object({ name: z.string().trim().min(2, 'Enter your name').max(80), goal: z.string(), nativeLanguage: z.string().max(60) })),
    defaultValues: { name: user.name, goal: user.profile?.goal || '', nativeLanguage: user.profile?.nativeLanguage || '' } });
  const pwSchema = z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: passwordRule, confirm: z.string() }).refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });
  const pwForm = useForm({ resolver: zodResolver(pwSchema) });

  const saveProfile = async (d) => { try { setUser(await profileApi.update({ name: d.name, profile: { goal: d.goal, nativeLanguage: d.nativeLanguage } })); toast.success('Profile updated'); } catch (e) { toast.error(errorMessage(e)); } };
  const savePw = async (d) => { try { await profileApi.password({ currentPassword: d.currentPassword, newPassword: d.newPassword }); toast.success('Password changed'); pwForm.reset(); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="gx-page mx-auto max-w-2xl space-y-6">
      <header className="gx-heading">
        <h1 className="gx-title text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="gx-sub">Manage your personal details and keep your account secure.</p>
      </header>
      <Section icon="user" title="Personal details" desc={`Member since ${fmtDate(user.createdAt)}`}>
        <form onSubmit={nameForm.handleSubmit(saveProfile)} className="space-y-4" noValidate>
          <Field label="Full name" error={nameForm.formState.errors.name?.message} {...nameForm.register('name')} />
          <Field label="Email" value={user.email} readOnly disabled hint="Email can’t be changed." onChange={() => {}} />
          <div><label htmlFor="goal" className="mb-1.5 block text-sm font-semibold">Main goal</label>
            <select id="goal" className="input" {...nameForm.register('goal')}><option value="">Not set</option><option value="interview">Job interviews</option><option value="work">Work communication</option><option value="academic">Academic</option><option value="daily">Daily conversation</option></select></div>
          <Field label="Native language" {...nameForm.register('nativeLanguage')} />
          <button className="btn-primary gx-submit" disabled={nameForm.formState.isSubmitting}>{nameForm.formState.isSubmitting && <Spinner className="h-4 w-4" />}Save changes</button>
        </form>
      </Section>
      <Section icon="lock" title="Change password">
        <form onSubmit={pwForm.handleSubmit(savePw)} className="space-y-4" noValidate>
          <Field label="Current password" type="password" autoComplete="current-password" error={pwForm.formState.errors.currentPassword?.message} {...pwForm.register('currentPassword')} />
          <Field label="New password" type="password" autoComplete="new-password" error={pwForm.formState.errors.newPassword?.message} {...pwForm.register('newPassword')} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" error={pwForm.formState.errors.confirm?.message} {...pwForm.register('confirm')} />
          <button className="btn-primary gx-submit" disabled={pwForm.formState.isSubmitting}>Update password</button>
        </form>
      </Section>
    </div>
  );
}

export function SettingsPage() {
  const { user, setUser, logout } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const p = user.preferences || {}; const [confirming, setConfirming] = useState(false); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false);
  const save = async (patch) => { try { setUser(await profileApi.update({ preferences: patch })); toast.success('Preferences saved'); } catch (e) { toast.error(errorMessage(e)); } };
  async function remove() {
    setBusy(true);
    try { await profileApi.remove({ password: pw }); setUser(null); toast.success('Your account was deleted'); nav('/', { replace: true }); }
    catch (e) { toast.error(errorMessage(e)); setBusy(false); }
  }
  return (
    <div className="gx-page mx-auto max-w-2xl space-y-6">
      <header className="gx-heading">
        <h1 className="gx-title text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="gx-sub">Tune your practice, choose your reminders, and manage your account.</p>
      </header>
      <Section icon="sliders" title="Practice preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="dg" className="mb-1.5 block text-sm font-semibold">Daily goal (minutes)</label>
            <input id="dg" type="number" min={1} max={240} className="input" defaultValue={p.dailyGoalMinutes ?? 10} onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 240 && v !== p.dailyGoalMinutes) save({ dailyGoalMinutes: v }); }} /></div>
          <div><label htmlFor="dd" className="mb-1.5 block text-sm font-semibold">Default difficulty</label>
            <select id="dd" className="input" value={p.defaultDifficulty || 'intermediate'} onChange={(e) => save({ defaultDifficulty: e.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
        </div>
      </Section>
      <Section icon="bell" title="Notifications">
        <Toggle label="Practice reminders" desc="Email reminders to practice." checked={!!p.emailReminders} onChange={(v) => save({ emailReminders: v })} />
        <Toggle label="Weekly summary" desc="A weekly email with your progress." checked={p.weeklySummary !== false} onChange={(v) => save({ weeklySummary: v })} />
      </Section>
      <Section icon="logout" title="Session" desc="Sign out of your account on this device."><button className="btn-secondary" onClick={async () => { await logout(); nav('/'); }}>Log out</button></Section>
      <Section icon="trash" tone="danger" title="Delete account" desc="Permanently deletes your account, recordings, transcripts and progress. This can’t be undone.">
        {confirming ? (
          <div className="gx-confirm space-y-3"><Field label="Confirm with your password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row"><button className="btn-secondary" onClick={() => { setConfirming(false); setPw(''); }}>Cancel</button><button className="btn-danger" disabled={!pw || busy} onClick={remove}>{busy && <Spinner className="h-4 w-4" />}Delete my account</button></div></div>
        ) : <button className="btn-danger" onClick={() => setConfirming(true)}>Delete account…</button>}
      </Section>
    </div>
  );
}