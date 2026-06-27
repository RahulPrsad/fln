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

const adminTabs = ['Dashboard', 'Roster', 'Assessments', 'Papers', 'Scanner', 'Review', 'Results', 'Analytics', 'Exports'];
const teacherTabs = ['Dashboard', 'Assessments', 'Papers', 'Scanner', 'Review', 'Results', 'Analytics', 'Exports'];

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

function canManage(user) {
  return user?.permissions?.some((permission) => ['school:manage', 'roster:manage', 'assessment:manage'].includes(permission));
}

function canGeneratePapers(user) {
  return canManage(user) || user?.permissions?.includes('scan:create');
}

async function decodeQrFromImage(file) {
  if (!file) {
    throw new Error('Select a scanned paper image first.');
  }
  if (!('BarcodeDetector' in window)) {
    throw new Error('This browser cannot read QR codes automatically. Type the QR text printed below the QR code.');
  }
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const bitmap = await createImageBitmap(file);
  const codes = await detector.detect(bitmap);
  bitmap.close?.();
  const rawValue = codes[0]?.rawValue;
  if (!rawValue) {
    throw new Error('No SmartFLN QR found. Retake the photo with the QR clearly visible.');
  }
  return rawValue;
}

async function cropAnswerRegions(file, answerRegions = [], questions = []) {
  if (!file) {
    return [];
  }

  const bitmap = await createImageBitmap(file);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const crops = answerRegions.map((region, index) => {
    const padding = 0.012;
    const x = Math.max(0, Math.floor((region.x - padding) * bitmap.width));
    const y = Math.max(0, Math.floor((region.y - padding) * bitmap.height));
    const width = Math.min(bitmap.width - x, Math.ceil((region.width + padding * 2) * bitmap.width));
    const height = Math.min(bitmap.height - y, Math.ceil((region.height + padding * 2) * bitmap.height));
    const scale = Math.min(1, 1600 / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, x, y, width, height, 0, 0, canvas.width, canvas.height);
    return {
      id: region.id,
      questionId: region.questionId,
      label: `Q${index + 1}`,
      prompt: questionById.get(region.questionId)?.prompt ?? region.questionId,
      dataUrl: canvas.toDataURL('image/jpeg', 0.86)
    };
  });
  bitmap.close?.();
  return crops;
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
    scanOutput: null,
    roiCrops: [],
    crops: [],
    reviewTasks: [],
    results: [],
    analytics: null,
    exportJob: null
  });
  const [notice, setNotice] = useState('');
  const token = session.accessToken;
  const selectedAssessment = state.assessments.find((assessment) => assessment.id === state.selectedAssessmentId);
  const isManager = canManage(session.user);
  const visibleTabs = useMemo(() => (isManager ? adminTabs : teacherTabs), [isManager]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab('Dashboard');
    }
  }, [activeTab, visibleTabs]);

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
      return { assessmentId: state.selectedAssessmentId, statePatch: { paperBatch } };
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
        body: { qrText: page.qrText, answers, imageQuality: 0.78 }
      });
      setState((current) => ({ ...current, paperBatch, scanBatch }));
      return { assessmentId: state.selectedAssessmentId };
    }, 'Scan processed.');
  }

  async function scanUploadedPaper({ file, manualQrText }) {
    return runAction(async () => {
      const qrText = manualQrText?.trim() || (await decodeQrFromImage(file));
      const resolved = await api('/api/v1/paper-pages/resolve-qr', {
        method: 'POST',
        token,
        body: { qrText }
      });
      const assessmentDetail = await api(`/api/v1/assessments/${resolved.assessment.id}`, { token });
      const roiCrops = await cropAnswerRegions(
        file,
        assessmentDetail.template?.answerRegions ?? [],
        assessmentDetail.questions ?? []
      );
      const scanBatch = await api('/api/v1/scan-batches', {
        method: 'POST',
        token,
        body: {
          assessmentId: resolved.assessment.id,
          classSectionId: resolved.assessment.classSectionId
        }
      });
      const scanPage = await api(`/api/v1/scan-batches/${scanBatch.id}/pages`, {
        method: 'POST',
        token,
        body: {
          qrText,
          ocrCrops: roiCrops.map((crop) => ({
            questionId: crop.questionId,
            cropUri: `browser://roi/${crop.id}`,
            imageDataUrl: crop.dataUrl
          })),
          imageQuality: 0.72,
          scanMode: 'photo_upload'
        }
      });
      setState((current) => ({
        ...current,
        selectedAssessmentId: resolved.assessment.id,
        selectedClassId: resolved.assessment.classSectionId,
        scanBatch,
        scanOutput: { resolved, scanPage },
        roiCrops
      }));
      return {
        assessmentId: resolved.assessment.id,
        statePatch: {
          selectedAssessmentId: resolved.assessment.id,
          selectedClassId: resolved.assessment.classSectionId,
          scanBatch,
          scanOutput: { resolved, scanPage },
          roiCrops
        }
      };
    }, 'Photo scan processed. Doubtful answers are ready for review.');
  }

  async function resolveReview(task, decision = 'accepted') {
    return runAction(async () => {
      const accepted = decision === 'accepted';
      await api(`/api/v1/review-tasks/${task.id}/decision`, {
        method: 'POST',
        token,
        body: {
          decision,
          awardedMarks: accepted ? task.question.maxMarks : 0,
          finalAnswer: accepted ? task.crop.recognizedAnswer : ''
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

  async function printFirstPaper() {
    setNotice('');
    try {
      if (!state.paperBatch?.id || !state.paperBatch.paperInstances?.[0]?.studentId) {
        throw new Error('Generate a paper first.');
      }
      await printArtifact(
        `/api/v1/paper-batches/${state.paperBatch.id}/print?studentId=${state.paperBatch.paperInstances[0].studentId}`,
        token
      );
      setNotice('Paper print opened.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function submitFinalMarks() {
    if (state.reviewTasks.length > 0) {
      setNotice('Finish manual checks before submitting marks.');
      return null;
    }
    return finalizeResults();
  }

  return (
    <main className="app-shell teacher-only">
      <header className="topbar">
        <div>
          <p className="eyebrow">SmartFLN</p>
          <h1>Teacher Assessment Flow</h1>
        </div>
        <div className="user-block">
          <span>{session.user.displayName}</span>
          <button className="secondary" onClick={onLogout} type="button">
            Sign Out
          </button>
        </div>
      </header>

      {notice ? <p className={notice.includes('required') || notice.includes('permission') ? 'notice error' : 'notice'}>{notice}</p> : null}

      <TeacherFlow
        state={state}
        setState={setState}
        onGenerate={generatePapers}
        onPrint={printFirstPaper}
        onScanFile={scanUploadedPaper}
        onReview={resolveReview}
        onSubmitMarks={submitFinalMarks}
      />
      {state.reviewTasks.length > 0 ? (
        <ReviewOverlay task={state.reviewTasks[0]} roiCrops={state.roiCrops} onReview={resolveReview} />
      ) : null}
    </main>
  );
}

function TeacherFlow({ state, setState, onGenerate, onPrint, onScanFile, onReview, onSubmitMarks }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [manualQrText, setManualQrText] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedPaper = state.paperBatch?.paperInstances?.[0];
  const selectedPage = selectedPaper?.pages?.[0];
  const pendingTask = state.reviewTasks[0];

  function chooseFile(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : '';
    });
  }

  async function submitScan() {
    setBusy(true);
    try {
      await onScanFile({ file: selectedFile, manualQrText });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flow-stack">
      <section className="flow-card">
        <div className="step-badge">1</div>
        <div className="flow-body">
          <h2>Generate Paper</h2>
          <div className="stack compact">
            <select
              value={state.selectedAssessmentId}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  selectedAssessmentId: event.target.value,
                  paperBatch: null,
                  scanOutput: null,
                  roiCrops: []
                }))
              }
            >
              {state.assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title}
                </option>
              ))}
            </select>
            <button disabled={!state.selectedAssessmentId} onClick={onGenerate} type="button">
              Generate Paper
            </button>
          </div>
          {selectedPage ? (
            <div className="status-line">
              <strong>Ready</strong>
              <span>{selectedPaper.studentId}</span>
              <code>{selectedPage.qrText}</code>
            </div>
          ) : null}
        </div>
      </section>

      <section className="flow-card">
        <div className="step-badge">2</div>
        <div className="flow-body">
          <h2>Print Paper</h2>
          <button disabled={!state.paperBatch} onClick={onPrint} type="button">
            Print Paper
          </button>
        </div>
      </section>

      <section className="flow-card">
        <div className="step-badge">3</div>
        <div className="flow-body">
          <h2>Scan Filled Sheet</h2>
          <div className="stack compact">
            <input accept="image/*" capture="environment" onChange={chooseFile} type="file" />
            {previewUrl ? <img alt="Selected paper scan" className="scan-preview" src={previewUrl} /> : null}
            <input
              placeholder="QR text fallback"
              value={manualQrText}
              onChange={(event) => setManualQrText(event.target.value)}
            />
            <button disabled={busy || (!selectedFile && !manualQrText.trim())} onClick={submitScan} type="button">
              {busy ? 'Running OCR' : 'Scan And Run OCR'}
            </button>
          </div>
        </div>
      </section>

      <section className="flow-card">
        <div className="step-badge">4</div>
        <div className="flow-body">
          <h2>Manual Check</h2>
          {pendingTask ? (
            <div className="review-mini">
              <strong>{pendingTask.question.prompt}</strong>
              <span>{Math.round((pendingTask.crop.recognitionConfidence ?? 0) * 100)}% confidence</span>
              <div className="action-row">
                <button onClick={() => onReview(pendingTask, 'accepted')} type="button">
                  Correct
                </button>
                <button className="danger" onClick={() => onReview(pendingTask, 'rejected')} type="button">
                  Wrong
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">No manual checks pending.</p>
          )}
        </div>
      </section>

      <section className="flow-card">
        <div className="step-badge">5</div>
        <div className="flow-body">
          <h2>Final Marks</h2>
          <button disabled={state.crops.length === 0 || state.reviewTasks.length > 0} onClick={onSubmitMarks} type="button">
            Submit Final Marks
          </button>
          <FinalMarks state={state} />
        </div>
      </section>
    </section>
  );
}

function ReviewOverlay({ task, roiCrops, onReview }) {
  const cropImage = roiCrops.find((crop) => crop.questionId === task.questionId)?.dataUrl ?? task.crop.cropPreviewDataUrl;

  return (
    <div className="review-overlay" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <section className="review-modal">
        <div>
          <p className="eyebrow">Manual Check</p>
          <h2 id="review-title">{task.question.prompt}</h2>
        </div>
        {cropImage ? <img alt="Answer crop" className="review-crop" src={cropImage} /> : null}
        <div className="review-facts">
          <span>Recognized answer</span>
          <strong>{String(task.crop.recognizedAnswer || 'Blank')}</strong>
          <span>Confidence</span>
          <strong>{Math.round((task.crop.recognitionConfidence ?? 0) * 100)}%</strong>
          <span>Marks</span>
          <strong>{task.question.maxMarks}</strong>
        </div>
        <div className="modal-actions">
          <button onClick={() => onReview(task, 'accepted')} type="button">
            Correct
          </button>
          <button className="danger" onClick={() => onReview(task, 'rejected')} type="button">
            Wrong
          </button>
        </div>
      </section>
    </div>
  );
}

function FinalMarks({ state }) {
  const latest = state.results[0];
  return (
    <div className="final-box">
      <div className="metric compact-metric">
        <span>Pending</span>
        <strong>{state.reviewTasks.length}</strong>
      </div>
      <div className="metric compact-metric">
        <span>Score</span>
        <strong>{latest ? `${latest.awardedMarks}/${latest.totalMarks}` : '0/0'}</strong>
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
          {canGeneratePapers(user) ? <button onClick={onPapers}>Generate Papers</button> : null}
          <button onClick={onScan}>Run Demo Scan</button>
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

function Assessments({ state, setState, onAssess, user }) {
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
          {canManage(user) ? (
            <button onClick={onAssess}>Create Published FLN Assessment</button>
          ) : (
            <p className="muted">Assigned FLN assessments are ready for scanning, review, results, and exports.</p>
          )}
        </div>
        <Table columns={['Title', 'Subject', 'Status', 'Questions']} rows={state.assessments.map((assessment) => [assessment.title, assessment.subject, assessment.status, assessment.questionCount])} />
      </Panel>
      <Panel title="Concepts">
        <List items={state.concepts.map((concept) => `${concept.name} · Grade ${concept.gradeLevel}`)} />
      </Panel>
    </section>
  );
}

function Papers({ state, token, onPapers, setNotice }) {
  const firstPage = state.paperBatch?.paperInstances?.[0]?.pages?.[0];
  return (
    <section className="content-grid">
      <Panel title="Paper Batch">
        <button onClick={onPapers}>Generate Student Papers</button>
        {state.paperBatch ? (
          <>
            <button
              className="secondary"
              onClick={() =>
                downloadArtifact(
                  `/api/v1/paper-batches/${state.paperBatch.id}/print?studentId=${state.paperBatch.paperInstances?.[0]?.studentId}`,
                  token
                ).catch((error) => setNotice(error.message))
              }
              type="button"
            >
              Download One Paper
            </button>
            <button
              className="secondary"
              onClick={() =>
                downloadArtifact(`/api/v1/paper-batches/${state.paperBatch.id}/print`, token).catch((error) =>
                  setNotice(error.message)
                )
              }
              type="button"
            >
              Download Full Packet
            </button>
          </>
        ) : null}
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
            <button
              className="secondary"
              onClick={() =>
                downloadArtifact(`/api/v1/paper-pages/${firstPage.id}/qr.svg`, token).catch((error) =>
                  setNotice(error.message)
                )
              }
              type="button"
            >
              Download QR SVG
            </button>
          </div>
        ) : (
          <p className="muted">No generated paper selected.</p>
        )}
      </Panel>
    </section>
  );
}

function Scanner({ state, onScan, onScanFile }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [manualQrText, setManualQrText] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);

  function chooseFile(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : '';
    });
  }

  async function submitScan() {
    setBusy(true);
    try {
      await onScanFile({ file: selectedFile, manualQrText });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-grid">
      <Panel title="Scan Sheet">
        <div className="stack">
          <label>
            Paper photo
            <input accept="image/*" capture="environment" onChange={chooseFile} type="file" />
          </label>
          {previewUrl ? <img alt="Selected paper scan" className="scan-preview" src={previewUrl} /> : null}
          <label>
            QR text fallback
            <input
              placeholder="SFLN:pp_..."
              value={manualQrText}
              onChange={(event) => setManualQrText(event.target.value)}
            />
          </label>
          <div className="action-row">
            <button disabled={busy || (!selectedFile && !manualQrText.trim())} onClick={submitScan} type="button">
              {busy ? 'Scanning' : 'Scan Uploaded Sheet'}
            </button>
            <button className="secondary" onClick={onScan} type="button">
              Run Demo Scan
            </button>
          </div>
        </div>
        <Pipeline state={state} />
      </Panel>
      <Panel title="Scan Output">
        {state.scanOutput ? (
          <div className="scan-output">
            <Metric label="Student" value={state.scanOutput.resolved.student.displayName ?? state.scanOutput.resolved.student.id} />
            <Metric label="Paper Page" value={state.scanOutput.resolved.paperPage.id} />
            <Metric label="Status" value={state.scanOutput.scanPage.status} />
            <Metric label="QR Confidence" value={`${Math.round((state.scanOutput.scanPage.quality?.qrConfidence ?? 0) * 100)}%`} />
            <div className="pipeline">
              {(state.scanOutput.scanPage.pipeline ?? []).map((step) => (
                <span className="done" key={step}>
                  {step.replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">Upload a printed sheet photo. The system will identify the paper and queue answer crops.</p>
        )}
      </Panel>
      <Panel title="Answer ROI Crops">
        {state.roiCrops.length > 0 ? (
          <div className="roi-grid">
            {state.roiCrops.map((crop) => (
              <figure className="roi-card" key={crop.id}>
                <img alt={`${crop.label} answer crop`} src={crop.dataUrl} />
                <figcaption>
                  <strong>{crop.label}</strong>
                  <span>{crop.prompt}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="muted">ROI crops will appear here after scanning a photographed sheet.</p>
        )}
      </Panel>
      <Panel title="Answer Crops">
        <Table
          columns={['Question', 'Answer', 'Confidence', 'Model', 'Marks', 'Status']}
          rows={state.crops.map((crop) => [
            crop.questionId,
            String(crop.recognizedAnswer),
            `${Math.round((crop.recognitionConfidence ?? 0) * 100)}%`,
            crop.recognizedBy,
            `${crop.awardedMarks}/${crop.maxMarks}`,
            crop.status
          ])}
        />
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

function Exports({ state, token, onExport, setNotice }) {
  return (
    <section className="content-grid">
      <Panel title="Export Center">
        <button onClick={onExport}>Generate CSV Export</button>
        {state.exportJob ? (
          <div className="export-box">
            <strong>{state.exportJob.fileName}</strong>
            <span>{state.exportJob.status}</span>
            <button
              className="secondary"
              onClick={() =>
                downloadArtifact(`/api/v1/exports/${state.exportJob.id}/download`, token).catch((error) =>
                  setNotice(error.message)
                )
              }
              type="button"
            >
              Download CSV
            </button>
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
