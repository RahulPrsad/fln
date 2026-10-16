import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, HelpCircle, LogIn, LogOut, ArrowLeft } from 'lucide-react';
import { User } from './types';
import { VolunteerWorkspace } from './components/VolunteerWorkspace';
import './portal.css';

export default function App() {
  const [page, setPage] = useState<'home' | 'login' | 'about' | 'help'>('home');
  const [token, setToken] = useState(localStorage.getItem('fln_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.fontSize = '100%';
    if (!token) { setChecking(false); return; }
    let cancelled = false;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (data.user?.role !== 'volunteer') throw new Error(); if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) { localStorage.removeItem('fln_token'); setToken(''); setUser(null); } })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token]);
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/volunteer-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
      localStorage.setItem('fln_token', data.token); setToken(data.token); setUser(data.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <div className="portal">
    <header className="portal-header"><a href="/" className="portal-brand" aria-label="SmartFLN home"><span className="brand-symbol"><BookOpen size={23} /></span><span>smart<span className="brand-fln">fln.</span><small>FOUNDATIONS FOR EVERY CHILD</small></span></a><div className="portal-header-right"><span className="portal-pill">Volunteer portal</span>{user && <button className="text-button" onClick={() => { localStorage.removeItem('fln_token'); setToken(''); setUser(null); setPage('home'); }}><LogOut size={16} /> Log out</button>}</div></header>
    {checking ? <main className="portal-loading" role="status">Opening your workspace…</main> : user && token ? <VolunteerWorkspace user={user} token={token} /> : <main className="welcome-main">
      {page === 'home' ? <>
        <div className="welcome-eyebrow"><span /> SMALL STEPS. STRONG FOUNDATIONS.</div>
        <h1>Every child’s next chapter<br />starts with <em>you.</em></h1>
        <p className="welcome-description">A simpler space to support learning. Add students, prepare papers,<br className="desktop-break" /> and turn every assessment into a step forward.</p>
        <div className="home-options">
          <button className="home-option primary-option" onClick={() => setPage('login')}><span className="option-icon"><LogIn /></span><span className="option-number">01</span><h2>Volunteer login</h2><p>Your students. Your workspace.<br />Everything you need in one place.</p><span className="option-link">Let’s get started <ArrowRight size={18} /></span></button>
          <button className="home-option" onClick={() => setPage('about')}><span className="option-icon"><BookOpen /></span><span className="option-number">02</span><h2>About SmartFLN</h2><p>Helping children build confidence<br />in literacy and numeracy.</p><span className="option-link">Meet the mission <ArrowRight size={18} /></span></button>
          <button className="home-option" onClick={() => setPage('help')}><span className="option-icon"><HelpCircle /></span><span className="option-number">03</span><h2>A little help</h2><p>From the first student to the<br />first scan, we’ve got you.</p><span className="option-link">Find your way <ArrowRight size={18} /></span></button>
        </div><p className="welcome-footnote"><span>✳</span> One student. One assessment. A little more possibility.</p>
      </> : <section className="info-card"><button className="text-button" onClick={() => { setPage('home'); setError(''); }}><ArrowLeft size={16} /> Back to home</button>
        {page === 'login' ? <><span className="section-kicker">WELCOME BACK</span><h1>Good to see you.</h1><p>Sign in to your volunteer workspace.</p><form className="portal-form" onSubmit={login}><label>Email address<input autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@fln.org" /></label><label>Password<input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /></label>{error && <div className="portal-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Open my workspace'}<ArrowRight size={17} /></button></form></> : page === 'about' ? <><span className="section-kicker">OUR PURPOSE</span><h1>Learning begins<br />with the basics.</h1><p>SmartFLN supports foundational literacy and numeracy through student-specific paper assessments and thoughtful volunteer review.</p><p>Every new student starts at Level 1. Generate a paper at their current level, scan their answers, review the evaluation, and keep their results together.</p></> : <><span className="section-kicker">A SIMPLE WAY FORWARD</span><h1>Your first four steps.</h1><ol className="help-steps"><li><strong>Add a student.</strong> Choose their school and class. They’ll start at Level 1.</li><li><strong>Find your students.</strong> Search the list and open a student’s saved evaluations.</li><li><strong>Generate a paper.</strong> Choose a student and download their QR-enabled assessment.</li><li><strong>Scan & evaluate.</strong> Upload a clear photo with all four corner markers visible. Review flagged answers and select Save evaluation.</li></ol><p>Saved results are available in the student’s record, including after you sign out. For account access, contact your school coordinator.</p></>}
      </section>}
    </main>}
    <footer className="portal-footer"><span>SmartFLN</span><span>Made for learning. Built around people.</span><span>Foundational Literacy & Numeracy</span></footer>
  </div>;
}
