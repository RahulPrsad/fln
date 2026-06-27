import React, { useEffect, useRef, useState } from 'react';
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

async function decodeQrFromImage(file) {
  if (!('BarcodeDetector' in window)) {
    throw new Error('QR detection is not available in this browser.');
  }
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const bitmap = await createImageBitmap(file);
  const codes = await detector.detect(bitmap);
  bitmap.close?.();
  const qrText = codes[0]?.rawValue;
  if (!qrText) {
    throw new Error('QR not detected.');
  }
  return qrText;
}

async function cropAnswerRegions(file, answerRegions = [], questions = []) {
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
    canvas.getContext('2d').drawImage(bitmap, x, y, width, height, 0, 0, canvas.width, canvas.height);
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
        body: { ...demoAccount, deviceId: 'web-camera-workflow' }
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
          <h1>Camera Assessment Workflow</h1>
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
    scanOutput: null,
    roiCrops: [],
    reviewTasks: [],
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
    let reviewTasks = [];
    let results = [];
    let crops = [];
    if (selectedAssessmentId) {
      assessmentDetail = await api(`/api/v1/assessments/${selectedAssessmentId}`, { token }).catch(() => null);
      reviewTasks = (await api('/api/v1/review-tasks?status=pending', { token }).catch(() => [])).filter(
        (task) => task.assessmentId === selectedAssessmentId
      );
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
      reviewTasks,
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
      return {
        assessmentId: state.selectedAssessmentId,
        statePatch: { paperBatch, scanBatch: null, scanOutput: null, roiCrops: [], exportJob: null }
      };
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

  async function scanPaperPhoto(file) {
    return runAction(async () => {
      if (!file) {
        throw new Error('Capture a paper photo first.');
      }

      let qrText;
      try {
        qrText = await decodeQrFromImage(file);
      } catch {
        qrText = state.paperBatch?.paperInstances?.[0]?.pages?.[0]?.qrText;
        if (!qrText) {
          throw new Error('QR was not readable. Retake the photo with the QR clearly visible.');
        }
      }

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
            cropUri: `browser://camera/${crop.id}`,
            imageDataUrl: crop.dataUrl
          })),
          imageQuality: 0.82,
          scanMode: 'camera_capture'
        }
      });

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
    }, 'OCR complete. Review confidence and result below.');
  }

  async function decideTeacherCheck(task, decision) {
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
    }, 'Teacher check saved.');
  }

  async function generateReport() {
    return runAction(async () => {
      if (state.crops.length === 0 && state.results.length === 0) {
        throw new Error('Run camera OCR before generating the report.');
      }
      if (state.reviewTasks.length > 0) {
        throw new Error('Finish teacher checks before generating the report.');
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
      return { assessmentId: state.selectedAssessmentId, statePatch: { exportJob } };
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
          <h1>Camera Assessment Workflow</h1>
        </div>
        <div className="user-block">
          <span>{session.user.displayName}</span>
          <button className="secondary" onClick={onLogout} type="button">
            Sign Out
          </button>
        </div>
      </header>

      {notice ? <p className={notice.includes('before') || notice.includes('Retake') ? 'notice error' : 'notice'}>{notice}</p> : null}

      <TeacherWorkflow
        state={state}
        setState={setState}
        onGenerate={generatePapers}
        onPrint={printFirstPaper}
        onDownloadPaper={downloadFirstPaper}
        onScanPhoto={scanPaperPhoto}
        onTeacherCheck={decideTeacherCheck}
        onGenerateReport={generateReport}
        onDownloadReport={downloadReport}
      />
    </main>
  );
}

function TeacherWorkflow({
  state,
  setState,
  onGenerate,
  onPrint,
  onDownloadPaper,
  onScanPhoto,
  onTeacherCheck,
  onGenerateReport,
  onDownloadReport
}) {
  const selectedPaper = state.paperBatch?.paperInstances?.[0];
  const selectedPage = selectedPaper?.pages?.[0];
  const questions = state.assessmentDetail?.questions ?? [];
  const latestResult = state.results[0];
  const averageConfidence =
    state.crops.length > 0
      ? Math.round(
          (state.crops.reduce((sum, crop) => sum + Number(crop.recognitionConfidence ?? 0), 0) /
            state.crops.length) *
            100
        )
      : 0;

  return (
    <section className="demo-grid">
      <section className="summary-grid">
        <Metric label="Papers" value={state.paperBatch?.paperInstances?.length ?? 0} />
        <Metric label="Scanned" value={state.scanOutput ? 'Yes' : 'No'} />
        <Metric label="Confidence" value={averageConfidence ? `${averageConfidence}%` : '0%'} />
        <Metric label="Marks" value={latestResult ? `${latestResult.awardedMarks}/${latestResult.totalMarks}` : '0/0'} />
      </section>

      <section className="demo-card">
        <div>
          <p className="eyebrow">Question Paper</p>
          <h2>Generate, Print, Then Fill On Paper</h2>
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
                scanOutput: null,
                roiCrops: [],
                reviewTasks: [],
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
          <p className="muted">Generate the question paper before opening the camera.</p>
        )}
      </section>

      <CameraScanner disabled={!state.paperBatch} onScanPhoto={onScanPhoto} />

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

      <ResultPanel
        state={state}
        onTeacherCheck={onTeacherCheck}
        onGenerateReport={onGenerateReport}
        onDownloadReport={onDownloadReport}
      />
    </section>
  );
}

function CameraScanner({ disabled, onScanPhoto }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');

  function clearPreview() {
    setCapturedFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  useEffect(() => () => stopCamera(), [stream]);

  async function openCamera() {
    setCameraError('');
    clearPreview();
    try {
      if (window.SmartFLNAndroidPrint?.printHtml) {
        fileInputRef.current?.click();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        fileInputRef.current?.click();
        return;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (error) {
      setCameraError(`${error.message} Use Choose Photo to open the device camera.`);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('Camera is not ready yet.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const file = new File([blob], `smartfln-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    stopCamera();
    setCapturedFile(file);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  function chooseFile(event) {
    const file = event.target.files?.[0] ?? null;
    clearPreview();
    if (file) {
      stopCamera();
      setCapturedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function uploadPhoto() {
    setBusy(true);
    try {
      await onScanPhoto(capturedFile);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="demo-card camera-card">
      <div>
        <p className="eyebrow">Scan Paper</p>
        <h2>Open Camera, Capture, Retake Or Run OCR</h2>
      </div>

      {stream ? <video className="camera-view" muted playsInline ref={videoRef} /> : null}
      {previewUrl ? <img alt="Captured answer sheet" className="camera-view" src={previewUrl} /> : null}
      {!stream && !previewUrl ? (
        <div className="camera-placeholder">
          <strong>Camera preview will appear here.</strong>
          <span>Place the full printed sheet inside the frame with QR visible.</span>
        </div>
      ) : null}

      <div className="demo-actions">
        {!stream ? (
          <button disabled={disabled || busy} onClick={openCamera} type="button">
            Open Camera
          </button>
        ) : (
          <button onClick={capturePhoto} type="button">
            Capture Photo
          </button>
        )}
        {capturedFile ? (
          <>
            <button className="secondary" disabled={busy} onClick={openCamera} type="button">
              Retake
            </button>
            <button disabled={busy} onClick={uploadPhoto} type="button">
              {busy ? 'Running OCR' : 'Upload And Run OCR'}
            </button>
          </>
        ) : null}
        <label className="file-button">
          Choose Photo
          <input
            accept="image/*"
            capture="environment"
            disabled={disabled || busy}
            onChange={chooseFile}
            ref={fileInputRef}
            type="file"
          />
        </label>
      </div>

      {disabled ? <p className="muted">Generate the question paper before scanning.</p> : null}
      {cameraError ? <p className="notice error">{cameraError}</p> : null}
    </section>
  );
}

function ResultPanel({ state, onTeacherCheck, onGenerateReport, onDownloadReport }) {
  return (
    <section className="demo-card">
      <div>
        <p className="eyebrow">OCR Result</p>
        <h2>Confidence, Teacher Check, Final Marks</h2>
      </div>

      {state.crops.length === 0 ? (
        <p className="muted">Capture and upload the filled paper to show OCR result here.</p>
      ) : (
        <FinalMarks state={state} />
      )}

      {state.reviewTasks.length > 0 ? (
        <div className="check-list">
          {state.reviewTasks.map((task) => (
            <TeacherCheckCard key={task.id} task={task} roiCrops={state.roiCrops} onTeacherCheck={onTeacherCheck} />
          ))}
        </div>
      ) : state.crops.length > 0 ? (
        <p className="notice">All answers are ready for report generation.</p>
      ) : null}

      <div className="demo-actions">
        <button disabled={state.crops.length === 0 || state.reviewTasks.length > 0} onClick={onGenerateReport} type="button">
          Generate Report
        </button>
        <button className="secondary" disabled={!state.exportJob} onClick={onDownloadReport} type="button">
          Download CSV
        </button>
      </div>
    </section>
  );
}

function TeacherCheckCard({ task, roiCrops, onTeacherCheck }) {
  const cropImage = roiCrops.find((crop) => crop.questionId === task.questionId)?.dataUrl ?? task.crop.cropPreviewDataUrl;

  return (
    <article className="check-card">
      <div>
        <strong>{task.question.prompt}</strong>
        <span>{Math.round((task.crop.recognitionConfidence ?? 0) * 100)}% confidence</span>
      </div>
      {cropImage ? <img alt="Answer crop" src={cropImage} /> : null}
      <div className="review-facts">
        <span>Recognized</span>
        <strong>{String(task.crop.recognizedAnswer || 'Blank')}</strong>
        <span>Marks</span>
        <strong>{task.question.maxMarks}</strong>
      </div>
      <div className="demo-actions">
        <button onClick={() => onTeacherCheck(task, 'accepted')} type="button">
          Correct
        </button>
        <button className="danger" onClick={() => onTeacherCheck(task, 'rejected')} type="button">
          Wrong
        </button>
      </div>
    </article>
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
