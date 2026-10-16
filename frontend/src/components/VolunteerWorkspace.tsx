import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Plus, Search, ScanLine, Users, Download, ArrowLeft } from 'lucide-react';
import { EvaluationReport, School, Student, User } from '../types';
import { IcrScanner } from './IcrScanner';

type Tab = 'add' | 'students' | 'papers' | 'scan';
type Paper = { paperId: string; pdfUrl: string; level: number; createdAt: string; studentName: string };
export function VolunteerWorkspace({ user, token }: { user: User; token: string }) {
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [history, setHistory] = useState<EvaluationReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', classGroup: 'Class 1', section: 'A', schoolId: '', aadharNumber: '' });
  async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to complete the request.');
    return data;
  }
  async function load() {
    setError('');
    try {
      const [list, allSchools, generated] = await Promise.all([request('/api/students'), request('/api/schools'), request('/api/volunteer/papers')]);
      const assigned = allSchools.filter((school: School) => user.assignedSchools?.includes(school.id));
      setStudents(list); setSchools(assigned); setPapers(generated);
      setForm(prev => ({ ...prev, schoolId: prev.schoolId || assigned[0]?.id || '' }));
      setStudentId(prev => prev || list[0]?.id || '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load your students.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [token]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setHistory([]); setHistoryLoading(true); setHistoryError('');
    request(`/api/evaluation/${encodeURIComponent(selected.id)}/history`).then(data => { if (!cancelled) setHistory(data); })
      .catch(err => { if (!cancelled) setHistoryError(err.message); }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.id, token]);
  async function addStudent(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const student = await request('/api/students', { method: 'POST', body: JSON.stringify(form) });
      setStudents(prev => [...prev, student]); setStudentId(student.id); setSelected(student);
      setForm(prev => ({ ...prev, name: '', age: '', aadharNumber: '' }));
      setNotice(`${student.name} is registered and ready to begin at Level 1.`); setTab('students');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save student.'); }
    finally { setBusy(false); }
  }
  async function generatePaper() {
    setBusy(true); setError(''); setNotice('');
    try {
      const paper = await request('/api/volunteer/papers', { method: 'POST', body: JSON.stringify({ studentId }) });
      setPapers(prev => [paper, ...prev]); setNotice('Your paper is ready. Download it below and print it on A4 with all corner markers visible.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to generate paper.'); }
    finally { setBusy(false); }
  }
  const actions = [
    { id: 'add' as Tab, title: 'Add student', description: 'A new learning journey', icon: Plus },
    { id: 'students' as Tab, title: 'Existing students', description: 'Your roster & saved results', icon: Users },
    { id: 'papers' as Tab, title: 'Generate paper', description: 'Ready for their next step', icon: FileText },
    { id: 'scan' as Tab, title: 'Scan & evaluate', description: 'Read, review & save', icon: ScanLine }
  ];
  const filtered = students.filter(s => `${s.name} ${s.id} ${s.classGroup}`.toLowerCase().includes(search.toLowerCase()));
  const chosen = students.find(s => s.id === studentId);
  return <main className="workspace-main">
    <div className="workspace-heading"><div><span className="section-kicker">YOUR VOLUNTEER WORKSPACE</span><h1>Hello, {user.name.split(' ')[0]}. <span className="greeting-dot">✳</span></h1><p>A little care today. A stronger foundation tomorrow.</p></div><span className="roster-count"><Users size={16} /> {students.length} students in your care</span></div>
    <nav className="workspace-actions" aria-label="Volunteer actions">{actions.map(({ id, title, description, icon: Icon }, i) => <button key={id} className={`workspace-action ${tab === id ? 'selected' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setError(''); setNotice(''); }}><div className="action-top"><span className="action-icon"><Icon size={21} /></span><span className="action-index">0{i + 1}</span></div><strong>{title}</strong><span>{description}</span></button>)}</nav>
    {notice && <div className="portal-success" role="status"><CheckCircle2 size={18} />{notice}</div>}
    {error && <div className="portal-error" role="alert">{error}<button className="text-button" onClick={load}>Retry loading</button></div>}
    {loading ? <section className="workspace-panel" role="status">Loading your workspace…</section> : tab === 'add' ? <section className="workspace-panel"><div className="panel-heading"><div><span className="section-kicker">A FRESH START</span><h2>Let’s meet your student.</h2><p>Every new student begins at Level 1. You can follow their progress here.</p></div><span className="level-badge">Starts at Level 1</span></div>
      {schools.length === 0 ? <p className="empty-state">No schools are assigned to your account. Ask your coordinator to assign a school before adding students.</p> : <form className="portal-form student-form" onSubmit={addStudent}>
        <label className="span-two">Student’s full name<input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Aanya Sharma" /></label>
        <label>Age<input type="number" required min={3} max={18} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="Age in years" /></label>
        <label>School<select required value={form.schoolId} onChange={e => setForm({ ...form, schoolId: e.target.value })}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Class<select value={form.classGroup} onChange={e => setForm({ ...form, classGroup: e.target.value })}>{[1, 2, 3, 4, 5].map(n => <option key={n}>Class {n}</option>)}</select></label>
        <label>Section<input required maxLength={10} value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} /></label>
        <label className="span-two">Student identity number<input required inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12} value={form.aadharNumber} onChange={e => setForm({ ...form, aadharNumber: e.target.value.replace(/\D/g, '') })} placeholder="4–12 digit student ID or Aadhaar number" /><small>Use a unique number to avoid registering the same student twice.</small></label>
        <div className="span-two form-bottom"><span>Details and progress are saved to their record.</span><button className="primary-button" disabled={busy}>{busy ? 'Saving student…' : 'Add student'}<ArrowRight size={17} /></button></div>
      </form>}
    </section> : tab === 'students' ? <section className="workspace-panel">
      {selected ? <><button className="text-button" onClick={() => setSelected(null)}><ArrowLeft size={16} /> All students</button><div className="panel-heading student-detail-heading"><div><span className="section-kicker">STUDENT RECORD</span><h2>{selected.name}</h2><p>{selected.classGroup} · Section {selected.section} · {selected.id}</p></div><span className="level-badge">Level {selected.currentLevel}</span></div><div className="detail-actions"><button className="secondary-button" onClick={() => { setStudentId(selected.id); setTab('papers'); }}>Generate their paper <FileText size={16} /></button><button className="secondary-button" onClick={() => setTab('scan')}>Scan an answer sheet <ScanLine size={16} /></button></div><h3 className="history-title">Saved evaluations</h3>
        {historyLoading ? <p role="status">Loading saved evaluations…</p> : historyError ? <p className="portal-error" role="alert">{historyError}</p> : history.length === 0 ? <div className="empty-state"><CheckCircle2 size={28} /><h3>Their story is just beginning.</h3><p>Saved evaluations will appear here after you review and save a scanned paper.</p></div> : <div className="evaluation-list">{history.map(report => <article key={report.id} className="evaluation-item"><div className="evaluation-icon"><CheckCircle2 size={21} /></div><div><strong>Assessment saved</strong><time>{new Date(report.timestamp).toLocaleString('en-IN')}</time><p>{report.narrative}</p></div><span className="evaluation-score">{report.score}<small> / {report.totalMarks ?? report.totalQuestions}</small></span></article>)}</div>}
      </> : <><div className="panel-heading"><div><span className="section-kicker">ONE CHILD AT A TIME</span><h2>Your students.</h2><p>Find a student, prepare their next paper, or revisit a saved evaluation.</p></div><label className="student-search"><Search size={17} /><input aria-label="Search students" placeholder="Search name, ID or class" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        {filtered.length === 0 ? <div className="empty-state"><Users size={30} /><h3>{search ? 'No students found.' : 'Make room for a new beginning.'}</h3><p>{search ? 'Try a different name, ID or class.' : 'Add your first student to get started.'}</p>{!search && <button className="primary-button" onClick={() => setTab('add')}>Add student <Plus size={16} /></button>}</div> : <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Student</th><th>Class</th><th>School</th><th>Current level</th><th><span className="sr-only">Open record</span></th></tr></thead><tbody>{filtered.map(s => <tr key={s.id}><td><span className="student-name">{s.name}</span><small>{s.id}</small></td><td>{s.classGroup} · {s.section}</td><td>{schools.find(school => school.id === s.schoolId)?.name || s.schoolId}</td><td><span className="level-badge">Level {s.currentLevel}</span></td><td><button className="record-link" onClick={() => setSelected(s)} aria-label={`Open ${s.name}'s record`}>View record <ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>}
      </>}
    </section> : tab === 'papers' ? <section className="workspace-panel"><div className="panel-heading"><div><span className="section-kicker">FROM SCREEN TO SCHOOL DESK</span><h2>A paper made for them.</h2><p>Questions follow the student’s current level. Each paper includes a QR code for scanning.</p></div><span className="paper-symbol"><FileText size={30} /></span></div><div className="paper-builder"><label>Choose a student<select value={studentId} onChange={e => setStudentId(e.target.value)}><option value="" disabled>Select a student</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} · Level {s.currentLevel}</option>)}</select></label>{chosen && <span className="level-badge">Level {chosen.currentLevel}.{chosen.currentSubLevel || 0}</span>}<button className="primary-button" disabled={!chosen || busy} onClick={generatePaper}>{busy ? 'Preparing paper…' : 'Generate paper'}<FileText size={17} /></button></div>{students.length === 0 && <p className="empty-state">Add a student first, then generate their Level 1 paper.</p>}<h3 className="history-title">Generated papers <span>{papers.length}</span></h3>{papers.length === 0 ? <p className="empty-state">Your generated papers will be kept here so you can download them again.</p> : <div className="evaluation-list">{papers.map(paper => <article className="paper-item" key={paper.paperId}><span className="evaluation-icon"><FileText size={20} /></span><div><strong>{paper.studentName}</strong><small>Level {paper.level} · {new Date(paper.createdAt).toLocaleDateString('en-IN')}</small></div><a className="secondary-button" href={paper.pdfUrl} target="_blank" rel="noreferrer">Open PDF <Download size={16} /></a></article>)}</div>}</section> : <section className="workspace-panel scanner-panel"><IcrScanner user={user} token={token} onBack={() => { setSelected(null); setTab('students'); load(); }} onSaved={() => { setSelected(null); load(); }} /></section>}
    <div className="workspace-note"><span>✳</span> Progress is personal. Every small step counts.</div>
  </main>;
}
