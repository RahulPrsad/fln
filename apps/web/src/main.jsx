import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBaseUrl = (import.meta.env.VITE_SMARTFLN_API_BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const demoAccount = { email: 'teacher@smartfln.local', password: 'SmartFLN@123' };

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

async function downloadArtifact(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error('Download failed.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'smartfln-artifact';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function printArtifact(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error('Print file could not be loaded.');
  }
  const html = await response.text();
  if (window.SmartFLNAndroidPrint?.printHtml) {
    window.SmartFLNAndroidPrint.printHtml(html);
    return;
  }

  const frame = document.createElement('iframe');
  frame.title = 'SmartFLN Print';
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
  frame.srcdoc = html;
}

function formatAnswer(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([left, right]) => `${left} -> ${right}`)
      .join(', ');
  }
  return String(value ?? '');
}

function App() {
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await api('/api/v1/auth/login', {
        method: 'POST',
        body: { ...demoAccount, deviceId: 'web-demo-dashboard' }
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
          <h1>FLN Demo Dashboard</h1>
        </div>
        <form className="stack" onSubmit={login}>
          <button disabled={loading} type="submit">
            {loading ? 'Opening Demo' : 'Open Teacher Demo'}
          </button>
        </form>
        {message ? <p className="notice error">{message}</p> : null}
      </section>
    </main>
  );
}

function Workspace({ session, onLogout }) {
  const [notice, setNotice] = useState('');
  const [state, setState] = useState({
    classes: [],
    students: [],
    assessments: [],
    assessmentDetail: null,
    selectedAssessmentId: '',
    selectedClassId: 'cls_demo_1a',
    paperBatch: null,
    scanBatch: null,
    results: [],
    crops: [],
    exportJob: null
  });
  const token = session.accessToken;
  const selectedAssessment = state.assessments.find((assessment) => assessment.id === state.selectedAssessmentId);

  async function loadAll(preferredAssessmentId = state.selectedAssessmentId) {
    const [classes, students, assessments] = await Promise.all([
      api('/api/v1/class-sections', { token }),
      api('/api/v1/students', { token }),
      api('/api/v1/assessments', { token })
    ]);
    const selectedAssessmentId = preferredAssessmentId || assessments[0]?.id || '';
    const selectedClassId = classes[0]?.id || 'cls_demo_1a';
    let assessmentDetail = null;
    let results = [];
    let crops = [];
    if (selectedAssessmentId) {
      assessmentDetail = await api(`/api/v1/assessments/${selectedAssessmentId}`, { token }).catch(() => null);
      results = await api(`/api/v1/assessments/${selectedAssessmentId}/results`, { token }).catch(() => []);
      crops = await api(`/api/v1/answer-crops?assessmentId=${selectedAssessmentId}`, { token }).catch(() => []);
    }
    setState((current) => ({
      ...current,
      classes,
      students,
      assessments,
      assessmentDetail,
      selectedAssessmentId,
      selectedClassId,
      results,
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
      if (result?.statePatch) {
        setState((current) => ({ ...current, ...result.statePatch }));
      }
      setNotice(success);
      return result;
    } catch (error) {
      setNotice(error.message);
      return null;
    }
  }

  async function generatePapers() {
    return runAction(async () => {
      if (!state.selectedAssessmentId) {
        throw new Error('Assessment is still loading.');
      }
      const paperBatch = await api('/api/v1/paper-batches', {
        method: 'POST',
        token,
        body: {
          assessmentId: state.selectedAssessmentId,
          classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId,
          paperMode: 'student_specific'
        }
      });
      return { assessmentId: state.selectedAssessmentId, statePatch: { paperBatch, exportJob: null } };
    }, 'Question paper generated.');
  }

  function firstPaperPath() {
    const studentId = state.paperBatch?.paperInstances?.[0]?.studentId;
    if (!state.paperBatch?.id || !studentId) {
      throw new Error('Generate a question paper first.');
    }
    return `/api/v1/paper-batches/${state.paperBatch.id}/print?studentId=${studentId}`;
  }

  async function printFirstPaper() {
    setNotice('');
    try {
      await printArtifact(firstPaperPath(), token);
      setNotice('Print dialog opened.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function downloadFirstPaper() {
    setNotice('');
    try {
      await downloadArtifact(firstPaperPath(), token);
      setNotice('Question paper downloaded.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function generateReport() {
    return runAction(async () => {
      let paperBatch = state.paperBatch;
      if (!paperBatch) {
        paperBatch = await api('/api/v1/paper-batches', {
          method: 'POST',
          token,
          body: {
            assessmentId: state.selectedAssessmentId,
            classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId,
            paperMode: 'student_specific'
          }
        });
      }

      const assessmentDetail = await api(`/api/v1/assessments/${state.selectedAssessmentId}`, { token });
      const answers = Object.fromEntries(assessmentDetail.questions.map((question) => [question.id, question.answerKey]));
      const page = paperBatch.paperInstances?.[0]?.pages?.[0];
      if (!page?.qrText) {
        throw new Error('Paper QR was not generated.');
      }

      const scanBatch = await api('/api/v1/scan-batches', {
        method: 'POST',
        token,
        body: {
          assessmentId: state.selectedAssessmentId,
          classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId
        }
      });
      await api(`/api/v1/scan-batches/${scanBatch.id}/pages`, {
        method: 'POST',
        token,
        body: {
          qrText: page.qrText,
          answers,
          imageQuality: 0.96,
          scanMode: 'demo_answer_key'
        }
      });

      const hiddenReviewItems = await api('/api/v1/review-tasks?status=pending', { token }).catch(() => []);
      for (const item of hiddenReviewItems.filter((entry) => entry.assessmentId === state.selectedAssessmentId)) {
        await api(`/api/v1/review-tasks/${item.id}/decision`, {
          method: 'POST',
          token,
          body: {
            decision: 'accepted',
            awardedMarks: item.question.maxMarks,
            finalAnswer: item.crop.recognizedAnswer
          }
        });
      }

      await api(`/api/v1/assessments/${state.selectedAssessmentId}/finalize`, {
        method: 'POST',
        token,
        body: {}
      });
      const exportJob = await api('/api/v1/exports', {
        method: 'POST',
        token,
        body: {
          assessmentId: state.selectedAssessmentId,
          classSectionId: selectedAssessment?.classSectionId ?? state.selectedClassId,
          exportType: 'class_result_csv'
        }
      });
      return { assessmentId: state.selectedAssessmentId, statePatch: { paperBatch, scanBatch, exportJob } };
    }, 'Report generated.');
  }

  async function downloadReport() {
    setNotice('');
    try {
      if (!state.exportJob?.id) {
        throw new Error('Generate report first.');
      }
      await downloadArtifact(`/api/v1/exports/${state.exportJob.id}/download`, token);
      setNotice('Report downloaded.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <main className="app-shell teacher-only">
      <header className="topbar">
        <div>
          <p className="eyebrow">SmartFLN</p>
          <h1>FLN Demo Dashboard</h1>
        </div>
        <div className="user-block">
          <span>{session.user.displayName}</span>
          <button className="secondary" onClick={onLogout} type="button">
            Sign Out
          </button>
        </div>
      </header>

      {notice ? <p className={notice.includes('loading') || notice.includes('first') ? 'notice error' : 'notice'}>{notice}</p> : null}

      <DemoDashboard
        state={state}
        setState={setState}
        onGenerate={generatePapers}
        onPrint={printFirstPaper}
        onDownloadPaper={downloadFirstPaper}
        onGenerateReport={generateReport}
        onDownloadReport={downloadReport}
      />
    </main>
  );
}

function DemoDashboard({
  state,
  setState,
  onGenerate,
  onPrint,
  onDownloadPaper,
  onGenerateReport,
  onDownloadReport
}) {
  const selectedPaper = state.paperBatch?.paperInstances?.[0];
  const selectedPage = selectedPaper?.pages?.[0];
  const questions = state.assessmentDetail?.questions ?? [];
  const latestResult = state.results[0];

  return (
    <section className="demo-grid">
      <section className="summary-grid">
        <Metric label="Students" value={state.students.length} />
        <Metric label="Papers" value={state.paperBatch?.paperInstances?.length ?? 0} />
        <Metric label="Marks" value={latestResult ? `${latestResult.awardedMarks}/${latestResult.totalMarks}` : '0/0'} />
        <Metric label="Report" value={state.exportJob ? 'Ready' : 'Not Ready'} />
      </section>

      <section className="demo-card">
        <div>
          <p className="eyebrow">Question Paper</p>
          <h2>Generate And Print</h2>
        </div>
        <div className="stack compact">
          <select
            value={state.selectedAssessmentId}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                selectedAssessmentId: event.target.value,
                paperBatch: null,
                scanBatch: null,
                results: [],
                crops: [],
                exportJob: null
              }))
            }
          >
            {state.assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title}
              </option>
            ))}
          </select>
          <div className="demo-actions">
            <button disabled={!state.selectedAssessmentId} onClick={onGenerate} type="button">
              Generate Question Paper
            </button>
            <button className="secondary" disabled={!state.paperBatch} onClick={onPrint} type="button">
              Print
            </button>
            <button className="secondary" disabled={!state.paperBatch} onClick={onDownloadPaper} type="button">
              Download
            </button>
          </div>
        </div>
        {selectedPage ? (
          <div className="status-line">
            <strong>Paper ready for demo student</strong>
            <span>{selectedPaper.studentId}</span>
            <code>{selectedPage.qrText}</code>
          </div>
        ) : (
          <p className="muted">Generate the question paper before printing.</p>
        )}
      </section>

      <section className="demo-card">
        <div>
          <p className="eyebrow">Answer Key</p>
          <h2>Teacher Reference</h2>
        </div>
        {questions.length > 0 ? (
          <Table
            columns={['Question', 'Type', 'Answer', 'Marks']}
            rows={questions.map((question, index) => [
              `Q${index + 1}. ${question.prompt}`,
              question.type,
              formatAnswer(question.answerKey),
              question.maxMarks
            ])}
          />
        ) : (
          <p className="muted">Answer key will appear after the assessment loads.</p>
        )}
      </section>

      <section className="demo-card">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Result And Report</h2>
        </div>
        <div className="demo-actions">
          <button disabled={!state.selectedAssessmentId} onClick={onGenerateReport} type="button">
            Generate Report
          </button>
          <button className="secondary" disabled={!state.exportJob} onClick={onDownloadReport} type="button">
            Download CSV
          </button>
        </div>
        <FinalMarks state={state} />
      </section>
    </section>
  );
}

function FinalMarks({ state }) {
  const latest = state.results[0];
  return (
    <div className="final-box">
      <div className="metric compact-metric">
        <span>Score</span>
        <strong>{latest ? `${latest.awardedMarks}/${latest.totalMarks}` : '0/0'}</strong>
      </div>
      <div className="metric compact-metric">
        <span>Status</span>
        <strong>{latest?.status ?? 'Not Ready'}</strong>
      </div>
      <div className="metric compact-metric">
        <span>Percent</span>
        <strong>{latest ? `${latest.percentage}%` : '0%'}</strong>
      </div>
      {state.crops.length > 0 ? (
        <Table
          columns={['Question', 'Answer', 'Confidence', 'Marks', 'Status']}
          rows={state.crops.map((crop) => [
            crop.questionId,
            String(crop.recognizedAnswer || 'Blank'),
            `${Math.round((crop.recognitionConfidence ?? 0) * 100)}%`,
            `${crop.awardedMarks}/${crop.maxMarks}`,
            crop.status
          ])}
        />
      ) : null}
    </div>
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
