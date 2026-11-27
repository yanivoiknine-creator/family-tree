import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';
import { cloudStore, type RegisterForm } from '../data/cloudStore';
import { LANGS, isRtl, translate, type Lang } from '../lib/i18n';
import { LangContext, useLang } from '../lib/LangContext';
import { initialLang, prefs } from '../lib/prefs';

export interface CloudSession {
  profile: Profile;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  openRegister: () => void;
}

/**
 * Cloud mode entry: Google sign-in → (first time) "who are you?" → the app.
 */
export function AuthGate({ children }: { children: (cloud: CloudSession) => ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  // "continue as guest": view only, no account; remembered until the visitor chooses to sign in
  const [guest, setGuest] = useState(() => prefs.get('guest') === '1');
  const t = useMemo(() => (key: Parameters<typeof translate>[1], vars?: Record<string, string>) => translate(lang, key, vars), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
    document.title = translate(lang, 'appTitle');
    prefs.set('lang', lang);
  }, [lang]);

  useEffect(() => {
    const sb = supabase!;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // after Google sends the user back with ?code=…, tidy the address bar
  useEffect(() => {
    if (session && location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  }, [session]);

  const refreshProfile = async () => {
    // the profile row is created by a database trigger right after the first sign-in
    for (let i = 0; i < 5; i++) {
      try {
        const p = await cloudStore.myProfile();
        if (p) return setProfile(p);
      } catch (e) {
        setError(String(e));
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setProfile(null);
  };

  useEffect(() => {
    if (session) refreshProfile();
    else if (session === null) setProfile(undefined);
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase!.auth.signOut();
    setProfile(undefined);
    setRegistering(false);
  };

  const langSelect = (
    <select className="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );

  let content: ReactNode;
  if (session === undefined || (session && profile === undefined)) {
    content = <div className="loading">…</div>;
  } else if (!session && guest) {
    content = children({
      profile: GUEST_PROFILE,
      signOut: () => { prefs.set('guest', null); setGuest(false); },
      refreshProfile: async () => undefined,
      openRegister: () => undefined,
    });
  } else if (!session) {
    content = <SignIn langSelect={langSelect} onGuest={() => { prefs.set('guest', '1'); setGuest(true); }} />;
  } else if (!profile) {
    content = (
      <Screen langSelect={langSelect}>
        <p className="error">{error || t('loadFailed')}</p>
        <button className="btn" onClick={signOut}>{t('signOut')}</button>
      </Screen>
    );
  } else if (registering || (profile.role !== 'admin' && !profile.registered_at)) {
    content = (
      <Register
        langSelect={langSelect}
        profile={profile}
        onDone={async () => {
          await refreshProfile();
          setRegistering(false);
        }}
        onSignOut={signOut}
      />
    );
  } else {
    content = children({ profile, signOut, refreshProfile, openRegister: () => setRegistering(true) });
  }

  return <LangContext.Provider value={{ lang, t }}>{content}</LangContext.Provider>;
}

const GUEST_PROFILE: Profile = {
  user_id: 'guest', email: null, display_name: null, avatar_url: null, role: 'guest',
  person_id: null, claim: null, attempts: 0, registered_at: null, created_at: '',
};

function Screen({ langSelect, children }: { langSelect: ReactNode; children: ReactNode }) {
  const { t } = useLang();
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-lang">{langSelect}</div>
        <img className="auth-logo" src={`${import.meta.env.BASE_URL}logo-256.png`} alt="" />
        <h1>{t('appTitle')}</h1>
        {children}
      </div>
    </div>
  );
}

function SignIn({ langSelect, onGuest }: { langSelect: ReactNode; onGuest: () => void }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) {
      alert(error.message);
      setBusy(false);
    }
  };
  return (
    <Screen langSelect={langSelect}>
      <h2>{t('signInTitle')}</h2>
      <p className="muted">{t('signInText')}</p>
      <button className="btn google-btn" onClick={signIn} disabled={busy}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {t('signInGoogle')}
      </button>
      <div className="auth-or">{t('or')}</div>
      <button className="btn tonal guest-btn" onClick={onGuest}>{t('guestContinue')}</button>
      <p className="muted small-print">{t('guestHint')}</p>
    </Screen>
  );
}

function Register({ langSelect, profile, onDone, onSignOut }: {
  langSelect: ReactNode; profile: Profile; onDone: () => void; onSignOut: () => void;
}) {
  const { t } = useLang();
  const prev = profile.claim ?? {};
  const [f, setF] = useState<RegisterForm>({
    firstNameHe: prev.firstNameHe ?? '', lastNameHe: prev.lastNameHe ?? '',
    firstName: prev.firstName ?? (profile.display_name?.split(' ')[0] ?? ''),
    lastName: prev.lastName ?? (profile.display_name?.split(' ').slice(1).join(' ') ?? ''),
    father: prev.father ?? '', mother: prev.mother ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = 3 - (profile.attempts ?? 0);

  const field = (key: keyof RegisterForm, label: string, dir?: 'rtl' | 'ltr') => (
    <label className="field">
      <span>{label}</span>
      <input dir={dir} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );

  const submit = async () => {
    const hasName = (f.firstNameHe.trim() && f.lastNameHe.trim()) || (f.firstName.trim() && f.lastName.trim());
    if (!hasName || !f.father.trim() || !f.mother.trim()) return setError(t('registerNeedNames'));
    setBusy(true);
    setError('');
    try {
      await cloudStore.register(f);
      onDone();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <Screen langSelect={langSelect}>
      <h2>{t('registerTitle')}</h2>
      <p className="muted">{t('registerText')}</p>
      <form className="register-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid2">
          {field('firstNameHe', t('firstNameHe'), 'rtl')}
          {field('lastNameHe', t('lastNameHe'), 'rtl')}
          {field('firstName', t('firstName'), 'ltr')}
          {field('lastName', t('lastName'), 'ltr')}
          {field('father', t('fatherName'))}
          {field('mother', t('motherName'))}
        </div>
        {profile.attempts > 0 && <p className="hint">{t('attemptsLeft', { n: String(Math.max(left, 0)) })}</p>}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={busy || left <= 0}>{t('continue')}</button>
          {profile.registered_at
            ? <button type="button" className="btn ghost" onClick={onDone}>{t('cancel')}</button>
            : <button type="button" className="btn ghost" onClick={onSignOut}>{t('signOut')}</button>}
        </div>
      </form>
    </Screen>
  );
}
