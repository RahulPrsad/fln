import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBaseUrl = (import.meta.env.VITE_SMARTFLN_API_BASE_URL ?? 'http://127.0.0.1:8080').replace(
  /\/$/,
  ''
);

const accounts = {
  Teacher: { email: 'teacher@smartfln.local', password: 'SmartFLN@123' },
  Admin: { email: 'admin@smartfln.local', password: 'SmartFLN@123' }
};

const tabs = ['Dashboard', 'Roster', 'Assessments', 'Papers', 'Scanner', 'Review', 'Results', 'Analytics', 'Exports'];

async function api(path, { token, method = 'GET', body = null } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Request failed.');
  }
  return payload.data;
}

function canManage(user) {
  return user?.permissions?.some((permission) => ['school:manage', 'roster:manage', 'assessment:manage'].includes(permission));
}

function App() {
  const [credentials, setCredentials] = useState(accounts.Teacher);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await api('/api/v1/auth/login', {
        method: 'POST',
        body: { ...credentials, deviceId: 'web-full-workflow' }
      });
      setSession(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    return <Workspace session={session} onLogout={() => setSession(null)} />;
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">SmartFLN</p>
          <h1>Assessment Workspace</h1>
        </div>
        <div className="account-switch">
          {Object.entries(accounts).map(([label, account]) => (
            <button
              className={credentials.email === account.email ? 'active-switch' : ''}
              key={label}
              onClick={() => setCredentials(account)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <form className="stack" onSubmit={login}>
          <label>
            Email
            <input
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          <button disabled={loading} type="submit">
            {loading ? 'Signing In' : 'Sign In'}
          </button>
        </form>
        {message ? <p className="notice error">{message}</p> : null}
      </section>
    </main>
  );
}

function Workspace({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [state, setState] = useState({
    schools: [],
    years: [],
    classes: [],
    students: [],
    concepts: [],
    assessments: [],
    selectedAssessmentId: '',
    selectedClassId: 'cls_demo_1a',
    paperBatch: null,
    scanBatch: null,
    crops: [],
    reviewTasks: [],
    results: [],
    analytics: null,
    exportJob: null
  });
  const [notice, setNotice] = useState('');
  const token = session.accessToken;
  const selectedAssessment = state.assessments.find((assessment) => assessment.id === state.selectedAssessmentId);

  async function loadAll(preferredAssessmentId = state.selectedAssessmentId) {
    const [schools, years, classes, students, concepts, assessments, reviewTasks] = await Promise.all([
      api('/api/v1/schools', { token }),
      api('/api/v1/academic-years', { token }),
      api('/api/v1/class-sections', { token }),
      api('/api/v1/students', { token }),
      api('/api/v1/concepts', { token }),
      api('/api/v1/assessments', { token }),
      api('/api/v1/review-tasks?status=pending', { token }).catch(() => [])
    ]);
    const selectedAssessmentId = preferredAssessmentId || assessments[0]?.id || '';
    const selectedClassId = classes[0]?.id || 'cls_demo_1a';
    let results = [];
    let analytics = null;
    let crops = [];
    if (selectedAssessmentId) {
      results = await api(`/api/v1/assessments/${selectedAssessmentId}/results`, { token }).catch(() => []);
      analytics = await api(`/api/v1/analytics/assessments/${selectedAssessmentId}/summary`, { token }).catch(() => null);
      crops = await api(`/api/v1/answer-crops?assessmentId=${selectedAssessmentId}`, { token }).catch(() => []);
    }
    setState((current) => ({
      ...current,
      schools,
      years,
      classes,
      students,
      concepts,
      assessments,
      selectedAssessmentId,
      selectedClassId,
      reviewTasks,
      results,
      analytics,
      crops
    }));
  }

  useEffect(() => {
    loadAll().catch((error) => setNotice(error.message));
  }, []);

  async function runAction(action, success) {
    setNotice('');
    try {
      const result = await action();
      await loadAll(result?.assessmentId ?? state.selectedAssessmentId);
      setNotice(success);
      return result;
    } catch (error) {
      setNotice(error.message);
      return null;
    }
  }

  async function createAssessmentFlow() {
    return runAction(async () => {
      const assessment = await api('/api/v1/assessments', {
        method: 'POST',
        token,
        body: {
          schoolId: state.schools[0]?.id ?? 'sch_demo',
          academicYearId: state.years[0]?.id ?? 'ay_demo_2026_2027',
          classSectionId: state.selectedClassId,
          title: `FLN Check ${new Date().toLocaleDateString()}`,
          subject: 'Mathematics',
          gradeLevel: 1
        }
      });
      const questionSet = [
        {
          type: 'mcq',
          prompt: 'Circle the number that comes after 4.',
          options: ['3', '4', '5', '6'],
          answerKey: '5',
          maxMarks: 1,
          conceptIds: ['con_counting']
        },
        { type: 'numeric', prompt: 'Solve 2 + 3.', answerKey: '5', maxMarks: 1, conceptIds: ['con_addition'] },
        {
          type: 'short_text',
          prompt: 'Write the word circle.',
          answerKey: 'circle',
          maxMarks: 1,
          conceptIds: ['con_shapes', 'con_vocabulary']
        },
        {
          type: 'matching',
          prompt: 'Match 1 to one and 2 to two.',
          answerKey: { '1': 'one', '2': 'two' },
          maxMarks: 2,
          conceptIds: ['con_counting', 'con_vocabulary'],
          autoScoreEligible: false
        }
      ];
      for (const question of questionSet) {
        await api(`/api/v1/assessments/${assessment.id}/questions`, { method: 'POST', token, body: question });
      }
      await api(`/api/v1/assessments/${assessment.id}/publish`, { method: 'POST', token, body: {} });
      setState((current) => ({ ...current, selectedAssessmentId: assessment.id }));
      return { assessmentId: assessment.id };
    }, 'Assessment published.');
  }

  async function generatePapers() {
    return runAction(async () => {
      const paperBatch = await api('/api/v1/paper-batches', {
        method: 'POST',
        token,
        body: {
          assessmentId: state.selectedAssessmentId,
          classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId,
          paperMode: 'student_specific'
        }
      });
      setState((current) => ({ ...current, paperBatch }));
      return { assessmentId: state.selectedAssessmentId };
    }, 'Papers generated.');
  }

  async function processScan() {
    return runAction(async () => {
      let paperBatch = state.paperBatch;
      if (!paperBatch) {
        paperBatch = await api('/api/v1/paper-batches', {
          method: 'POST',
          token,
          body: {
            assessmentId: state.selectedAssessmentId,
            classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId
          }
        });
      }
      const scanBatch = await api('/api/v1/scan-batches', {
        method: 'POST',
        token,
        body: {
          assessmentId: state.selectedAssessmentId,
          classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId
        }
      });
      const page = paperBatch.paperInstances[0]?.pages[0];
      const assessmentDetail = await api(`/api/v1/assessments/${state.selectedAssessmentId}`, { token });
      const answers = Object.fromEntries(
        assessmentDetail.questions.map((question) => [
          question.id,
          question.type === 'matching' ? question.answerKey : question.answerKey
        ])
      );
      await api(`/api/v1/scan-batches/${scanBatch.id}/pages`, {
        method: 'POST',
        token,
        body: { qrPayload: page.qrPayload, answers, imageQuality: 0.78 }
      });
      setState((current) => ({ ...current, paperBatch, scanBatch }));
      return { assessmentId: state.selectedAssessmentId };
    }, 'Scan processed.');
  }

  async function resolveReview(task) {
    return runAction(async () => {
      await api(`/api/v1/review-tasks/${task.id}/decision`, {
        method: 'POST',
        token,
        body: {
          decision: 'accepted',
          awardedMarks: task.question.maxMarks,
          finalAnswer: task.crop.recognizedAnswer
        }
      });
      return { assessmentId: task.assessmentId };
    }, 'Review saved.');
  }

  async function finalizeResults() {
    return runAction(async () => {
      await api(`/api/v1/assessments/${state.selectedAssessmentId}/finalize`, { method: 'POST', token, body: {} });
      return { assessmentId: state.selectedAssessmentId };
    }, 'Results finalized.');
  }

  async function createExport() {
    return runAction(async () => {
      const exportJob = await api('/api/v1/exports', {
        method: 'POST',
        token,
        body: {
          assessmentId: state.selectedAssessmentId,
          classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId,
          exportType: 'class_result_csv'
        }
      });
      setState((current) => ({ ...current, exportJob }));
      return { assessmentId: state.selectedAssessmentId };
    }, 'Export ready.');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SmartFLN</p>
          <h1>{canManage(session.user) ? 'School Assessment Operations' : 'Teacher Assessment Desk'}</h1>
        </div>
        <div className="user-block">
          <span>{session.user.displayName}</span>
          <button className="secondary" onClick={onLogout} type="button">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Workspace">
        {tabs.map((tab) => (
          <button className={activeTab === tab ? 'tab-active' : ''} key={tab} onClick={() => setActiveTab(tab)} type="button">
            {tab}
          </button>
        ))}
      </nav>

      {notice ? <p className={notice.includes('required') || notice.includes('permission') ? 'notice error' : 'notice'}>{notice}</p> : null}

      {activeTab === 'Dashboard' ? (
        <Dashboard state={state} onAssess={createAssessmentFlow} onPapers={generatePapers} onScan={processScan} onReview={resolveReview} onFinalize={finalizeResults} onExport={createExport} user={session.user} />
      ) : null}
      {activeTab === 'Roster' ? <Roster state={state} /> : null}
      {activeTab === 'Assessments' ? <Assessments state={state} setState={setState} onAssess={createAssessmentFlow} /> : null}
      {activeTab === 'Papers' ? <Papers state={state} onPapers={generatePapers} /> : null}
      {activeTab === 'Scanner' ? <Scanner state={state} onScan={processScan} /> : null}
      {activeTab === 'Review' ? <Review state={state} onResolve={resolveReview} /> : null}
      {activeTab === 'Results' ? <Results state={state} onFinalize={finalizeResults} /> : null}
      {activeTab === 'Analytics' ? <Analytics analytics={state.analytics} /> : null}
      {activeTab === 'Exports' ? <Exports state={state} onExport={createExport} /> : null}
    </main>
  );
}

function Dashboard({ state, user, onAssess, onPapers, onScan, onReview, onFinalize, onExport }) {
  const firstTask = state.reviewTasks[0];
  return (
    <section className="dashboard-grid">
      <Metric label="Assessments" value={state.assessments.length} />
      <Metric label="Students" value={state.students.length} />
      <Metric label="Review Queue" value={state.reviewTasks.length} />
      <Metric label="Class Average" value={`${state.analytics?.summary.classAverage ?? 0}%`} />
      <Panel title="Workflow">
        <div className="action-row">
          {canManage(user) ? <button onClick={onAssess}>Create Assessment</button> : null}
          {canManage(user) ? <button onClick={onPapers}>Generate Papers</button> : null}
          <button onClick={onScan}>Process Scan</button>
          {firstTask ? <button onClick={() => onReview(firstTask)}>Resolve Review</button> : null}
          <button className="secondary" onClick={onFinalize}>Finalize</button>
          <button className="secondary" onClick={onExport}>Export</button>
        </div>
      </Panel>
      <Panel title="Pipeline">
        <Pipeline state={state} />
      </Panel>
    </section>
  );
}

function Roster({ state }) {
  return (
    <section className="content-grid">
      <Panel title="Schools">
        <List items={state.schools.map((school) => `${school.name} · ${school.code}`)} />
      </Panel>
      <Panel title="Classes">
        <List items={state.classes.map((section) => `Class ${section.gradeLevel}-${section.sectionName} · ${section.medium}`)} />
      </Panel>
      <Panel title="Students">
        <Table columns={['Name', 'External ID', 'Status']} rows={state.students.map((student) => [student.displayName, student.externalStudentId || '-', student.status])} />
      </Panel>
    </section>
  );
}

function Assessments({ state, setState, onAssess }) {
  return (
    <section className="content-grid">
      <Panel title="Assessments">
        <div className="stack">
          <select value={state.selectedAssessmentId} onChange={(event) => setState((current) => ({ ...current, selectedAssessmentId: event.target.value }))}>
            {state.assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title}
              </option>
            ))}
          </select>
          <button onClick={onAssess}>Create Published FLN Assessment</button>
        </div>
        <Table columns={['Title', 'Subject', 'Status', 'Questions']} rows={state.assessments.map((assessment) => [assessment.title, assessment.subject, assessment.status, assessment.questionCount])} />
      </Panel>
      <Panel title="Concepts">
        <List items={state.concepts.map((concept) => `${concept.name} · Grade ${concept.gradeLevel}`)} />
      </Panel>
    </section>
  );
}

function Papers({ state, onPapers }) {
  const firstPage = state.paperBatch?.paperInstances?.[0]?.pages?.[0];
  return (
    <section className="content-grid">
      <Panel title="Paper Batch">
        <button onClick={onPapers}>Generate Student Papers</button>
        <Metric label="Papers" value={state.paperBatch?.paperInstances?.length ?? 0} />
      </Panel>
      <Panel title="QR Identity">
        {firstPage ? (
          <div className="qr-card">
            <div className="qr-grid" aria-hidden="true">
              {Array.from({ length: 64 }).map((_, index) => (
                <span className={(firstPage.qrPayload.checksum.charCodeAt(index % firstPage.qrPayload.checksum.length) + index) % 3 === 0 ? 'qr-dark' : ''} key={index} />
              ))}
            </div>
            <code>{firstPage.qrPayload.paperPageId}</code>
          </div>
        ) : (
          <p className="muted">No generated paper selected.</p>
        )}
      </Panel>
    </section>
  );
}

function Scanner({ state, onScan }) {
  return (
    <section className="content-grid">
      <Panel title="Scan Processing">
        <button onClick={onScan}>Run Web Scan Pipeline</button>
        <Pipeline state={state} />
      </Panel>
      <Panel title="Answer Crops">
        <Table columns={['Question', 'Answer', 'Marks', 'Status']} rows={state.crops.map((crop) => [crop.questionId, String(crop.recognizedAnswer), `${crop.awardedMarks}/${crop.maxMarks}`, crop.status])} />
      </Panel>
    </section>
  );
}

function Review({ state, onResolve }) {
  return (
    <section className="panel-list">
      {state.reviewTasks.length === 0 ? <Panel title="Review Queue"><p className="muted">No pending reviews.</p></Panel> : null}
      {state.reviewTasks.map((task) => (
        <Panel key={task.id} title={task.question.prompt}>
          <div className="review-row">
            <div>
              <p><strong>Answer:</strong> {String(task.crop.recognizedAnswer)}</p>
              <p><strong>Reason:</strong> {task.reason}</p>
              <p><strong>Confidence:</strong> {task.crop.evaluationConfidence}</p>
            </div>
            <button onClick={() => onResolve(task)}>Accept Marks</button>
          </div>
        </Panel>
      ))}
    </section>
  );
}

function Results({ state, onFinalize }) {
  return (
    <section className="content-grid">
      <Panel title="Student Results">
        <Table columns={['Student', 'Marks', 'Percent', 'Status']} rows={state.results.map((result) => [result.studentId, `${result.awardedMarks}/${result.totalMarks}`, `${result.percentage}%`, result.status])} />
        <button className="secondary" onClick={onFinalize}>Finalize Ready Results</button>
      </Panel>
    </section>
  );
}

function Analytics({ analytics }) {
  return (
    <section className="content-grid">
      <Panel title="Summary">
        <Metric label="Processed" value={analytics?.summary.studentsProcessed ?? 0} />
        <Metric label="Average" value={`${analytics?.summary.classAverage ?? 0}%`} />
        <Metric label="Pending Review" value={analytics?.summary.reviewPending ?? 0} />
      </Panel>
      <Panel title="Concepts">
        <div className="bars">
          {(analytics?.concepts ?? []).map((concept) => (
            <div className="bar-row" key={concept.id}>
              <span>{concept.name}</span>
              <div><i style={{ width: `${concept.score}%` }} /></div>
              <strong>{concept.score}%</strong>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function Exports({ state, onExport }) {
  return (
    <section className="content-grid">
      <Panel title="Export Center">
        <button onClick={onExport}>Generate CSV Export</button>
        {state.exportJob ? (
          <div className="export-box">
            <strong>{state.exportJob.fileName}</strong>
            <span>{state.exportJob.status}</span>
            <pre>{state.exportJob.content}</pre>
          </div>
        ) : (
          <p className="muted">No export generated.</p>
        )}
      </Panel>
    </section>
  );
}

function Pipeline({ state }) {
  const steps = [
    ['Assessment', state.selectedAssessmentId],
    ['Papers', state.paperBatch],
    ['QR', state.paperBatch?.paperInstances?.[0]?.pages?.[0]?.qrPayload],
    ['Scan', state.scanBatch],
    ['OCR/HTR', state.crops.length > 0],
    ['Evaluation', state.results.length > 0],
    ['Review', state.reviewTasks.length === 0 && state.crops.length > 0],
    ['Analytics', state.analytics],
    ['Export', state.exportJob]
  ];
  return (
    <div className="pipeline">
      {steps.map(([label, done]) => (
        <span className={done ? 'done' : ''} key={label}>
          {label}
        </span>
      ))}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function List({ items }) {
  return (
    <ul className="list">
      {items.slice(0, 8).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Table({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join(':')}-${rowIndex}`}>
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
