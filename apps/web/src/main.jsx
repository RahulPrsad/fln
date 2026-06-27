import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBaseUrl = (import.meta.env.VITE_SMARTFLN_API_BASE_URL ?? 'http://127.0.0.1:8080').replace(
  /\/$/,
  ''
);

const demoAccounts = {
  teacher: {
    email: 'teacher@smartfln.local',
    password: 'SmartFLN@123'
  },
  admin: {
    email: 'admin@smartfln.local',
    password: 'SmartFLN@123'
  }
};

async function apiRequest(path, { method = 'GET', token = null, body = null } = {}) {
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

function canManageRoster(user) {
  return user?.permissions?.some((permission) => ['school:manage', 'roster:manage'].includes(permission));
}

function App() {
  const [credentials, setCredentials] = useState(demoAccounts.teacher);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const data = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { ...credentials, deviceId: 'web-mvp' }
      });
      setSession(data);
      setStatus('success');
      setMessage(`Signed in as ${data.user.displayName}.`);
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  if (session) {
    return <Workspace session={session} onLogout={() => setSession(null)} />;
  }

  return (
    <main className="shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">SmartFLN MVP</p>
          <h1 id="login-title">Web Login</h1>
        </div>

        <div className="account-switch" aria-label="Demo account">
          {Object.entries(demoAccounts).map(([key, account]) => (
            <button
              className={credentials.email === account.email ? 'switch-active' : ''}
              key={key}
              onClick={() => setCredentials(account)}
              type="button"
            >
              {key}
            </button>
          ))}
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Signing In' : 'Sign In'}
          </button>
        </form>

        {message ? (
          <p className={`message message-${status}`} role={status === 'error' ? 'alert' : 'status'}>
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Workspace({ session, onLogout }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SmartFLN</p>
          <h1>{canManageRoster(session.user) ? 'Roster Setup' : 'My Classes'}</h1>
        </div>
        <div className="user-block">
          <span>{session.user.displayName}</span>
          <button className="ghost-button" onClick={onLogout} type="button">
            Sign Out
          </button>
        </div>
      </header>

      {canManageRoster(session.user) ? <AdminWorkspace session={session} /> : <TeacherWorkspace session={session} />}
    </main>
  );
}

function AdminWorkspace({ session }) {
  const [schools, setSchools] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [notice, setNotice] = useState('');
  const [schoolForm, setSchoolForm] = useState({ name: '', code: '', city: '', state: '' });
  const [yearForm, setYearForm] = useState({
    name: '2027-2028',
    startDate: '2027-04-01',
    endDate: '2028-03-31'
  });
  const [classForm, setClassForm] = useState({
    schoolId: '',
    academicYearId: '',
    gradeLevel: 1,
    sectionName: 'A',
    medium: 'English'
  });
  const [studentForm, setStudentForm] = useState({
    schoolId: '',
    displayName: '',
    externalStudentId: '',
    admissionNumber: ''
  });
  const [importForm, setImportForm] = useState({
    schoolId: '',
    academicYearId: '',
    classSectionId: '',
    csvText: 'displayName,externalStudentId,admissionNumber,rollNumber\n'
  });
  const [importJob, setImportJob] = useState(null);

  async function loadData() {
    const [schoolData, yearData, classData, studentData] = await Promise.all([
      apiRequest('/api/v1/schools', { token: session.accessToken }),
      apiRequest('/api/v1/academic-years', { token: session.accessToken }),
      apiRequest('/api/v1/class-sections', { token: session.accessToken }),
      apiRequest('/api/v1/students', { token: session.accessToken })
    ]);
    setSchools(schoolData);
    setAcademicYears(yearData);
    setClassSections(classData);
    setStudents(studentData);

    const firstSchoolId = schoolData[0]?.id ?? '';
    const firstYearId = yearData[0]?.id ?? '';
    const firstClassId = classData[0]?.id ?? '';

    setClassForm((current) => ({
      ...current,
      schoolId: current.schoolId || firstSchoolId,
      academicYearId: current.academicYearId || firstYearId
    }));
    setStudentForm((current) => ({ ...current, schoolId: current.schoolId || firstSchoolId }));
    setImportForm((current) => ({
      ...current,
      schoolId: current.schoolId || firstSchoolId,
      academicYearId: current.academicYearId || firstYearId,
      classSectionId: current.classSectionId || firstClassId
    }));
  }

  useEffect(() => {
    loadData().catch((error) => setNotice(error.message));
  }, []);

  async function submitWithNotice(action, successMessage) {
    try {
      await action();
      await loadData();
      setNotice(successMessage);
    } catch (error) {
      setNotice(error.message);
    }
  }

  const selectedClassStudents = useMemo(() => {
    const activeClassId = importForm.classSectionId;
    if (!activeClassId) {
      return students;
    }
    return students;
  }, [students, importForm.classSectionId]);

  return (
    <section className="workspace-grid">
      <Panel title="Schools">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithNotice(
              async () => {
                await apiRequest('/api/v1/schools', {
                  method: 'POST',
                  token: session.accessToken,
                  body: schoolForm
                });
                setSchoolForm({ name: '', code: '', city: '', state: '' });
              },
              'School saved.'
            );
          }}
        >
          <input
            placeholder="School name"
            value={schoolForm.name}
            onChange={(event) => setSchoolForm((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            placeholder="Code"
            value={schoolForm.code}
            onChange={(event) => setSchoolForm((current) => ({ ...current, code: event.target.value }))}
          />
          <input
            placeholder="City"
            value={schoolForm.city}
            onChange={(event) => setSchoolForm((current) => ({ ...current, city: event.target.value }))}
          />
          <input
            placeholder="State"
            value={schoolForm.state}
            onChange={(event) => setSchoolForm((current) => ({ ...current, state: event.target.value }))}
          />
          <button type="submit">Save School</button>
        </form>
        <SimpleList items={schools.map((school) => `${school.name} · ${school.code}`)} />
      </Panel>

      <Panel title="Academic Years">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithNotice(
              () =>
                apiRequest('/api/v1/academic-years', {
                  method: 'POST',
                  token: session.accessToken,
                  body: { ...yearForm, status: 'active' }
                }),
              'Academic year saved.'
            );
          }}
        >
          <input
            value={yearForm.name}
            onChange={(event) => setYearForm((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            type="date"
            value={yearForm.startDate}
            onChange={(event) => setYearForm((current) => ({ ...current, startDate: event.target.value }))}
          />
          <input
            type="date"
            value={yearForm.endDate}
            onChange={(event) => setYearForm((current) => ({ ...current, endDate: event.target.value }))}
          />
          <button type="submit">Save Year</button>
        </form>
        <SimpleList items={academicYears.map((year) => `${year.name} · ${year.status}`)} />
      </Panel>

      <Panel title="Classes">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithNotice(
              () =>
                apiRequest('/api/v1/class-sections', {
                  method: 'POST',
                  token: session.accessToken,
                  body: classForm
                }),
              'Class saved.'
            );
          }}
        >
          <select
            value={classForm.schoolId}
            onChange={(event) => setClassForm((current) => ({ ...current, schoolId: event.target.value }))}
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          <select
            value={classForm.academicYearId}
            onChange={(event) => setClassForm((current) => ({ ...current, academicYearId: event.target.value }))}
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
          <input
            min="1"
            max="5"
            type="number"
            value={classForm.gradeLevel}
            onChange={(event) => setClassForm((current) => ({ ...current, gradeLevel: event.target.value }))}
          />
          <input
            value={classForm.sectionName}
            onChange={(event) => setClassForm((current) => ({ ...current, sectionName: event.target.value }))}
          />
          <input
            value={classForm.medium}
            onChange={(event) => setClassForm((current) => ({ ...current, medium: event.target.value }))}
          />
          <button type="submit">Save Class</button>
        </form>
        <SimpleList
          items={classSections.map((section) => `Class ${section.gradeLevel}-${section.sectionName} · ${section.medium}`)}
        />
      </Panel>

      <Panel title="Students">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithNotice(
              async () => {
                await apiRequest('/api/v1/students', {
                  method: 'POST',
                  token: session.accessToken,
                  body: studentForm
                });
                setStudentForm((current) => ({
                  ...current,
                  displayName: '',
                  externalStudentId: '',
                  admissionNumber: ''
                }));
              },
              'Student saved.'
            );
          }}
        >
          <select
            value={studentForm.schoolId}
            onChange={(event) => setStudentForm((current) => ({ ...current, schoolId: event.target.value }))}
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Student name"
            value={studentForm.displayName}
            onChange={(event) => setStudentForm((current) => ({ ...current, displayName: event.target.value }))}
          />
          <input
            placeholder="External ID"
            value={studentForm.externalStudentId}
            onChange={(event) => setStudentForm((current) => ({ ...current, externalStudentId: event.target.value }))}
          />
          <input
            placeholder="Admission number"
            value={studentForm.admissionNumber}
            onChange={(event) => setStudentForm((current) => ({ ...current, admissionNumber: event.target.value }))}
          />
          <button type="submit">Save Student</button>
        </form>
        <DataTable
          columns={['Name', 'External ID', 'Status']}
          rows={selectedClassStudents.slice(0, 8).map((student) => [
            student.displayName,
            student.externalStudentId || '-',
            student.status
          ])}
        />
      </Panel>

      <Panel title="Roster Import">
        <form
          className="import-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithNotice(
              async () => {
                const job = await apiRequest('/api/v1/students/imports', {
                  method: 'POST',
                  token: session.accessToken,
                  body: importForm
                });
                setImportJob(job);
              },
              'Import validated.'
            );
          }}
        >
          <div className="form-grid">
            <select
              value={importForm.schoolId}
              onChange={(event) => setImportForm((current) => ({ ...current, schoolId: event.target.value }))}
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
            <select
              value={importForm.academicYearId}
              onChange={(event) => setImportForm((current) => ({ ...current, academicYearId: event.target.value }))}
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
            <select
              value={importForm.classSectionId}
              onChange={(event) => setImportForm((current) => ({ ...current, classSectionId: event.target.value }))}
            >
              {classSections.map((section) => (
                <option key={section.id} value={section.id}>
                  Class {section.gradeLevel}-{section.sectionName}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows="5"
            value={importForm.csvText}
            onChange={(event) => setImportForm((current) => ({ ...current, csvText: event.target.value }))}
          />
          <button type="submit">Validate Import</button>
        </form>

        {importJob ? (
          <div className="import-summary">
            <strong>
              {importJob.summary.validRows}/{importJob.summary.totalRows} valid
            </strong>
            <span>{importJob.summary.errorRows} errors</span>
            <span>{importJob.summary.warningRows} warnings</span>
            <button
              className="secondary-button"
              disabled={importJob.summary.errorRows > 0 || importJob.status === 'committed'}
              onClick={() =>
                submitWithNotice(async () => {
                  const committed = await apiRequest(`/api/v1/students/imports/${importJob.id}/commit`, {
                    method: 'POST',
                    token: session.accessToken,
                    body: {}
                  });
                  setImportJob(committed);
                }, 'Import committed.')
              }
              type="button"
            >
              Commit
            </button>
          </div>
        ) : null}

        {notice ? <p className="message message-success">{notice}</p> : null}
      </Panel>
    </section>
  );
}

function TeacherWorkspace({ session }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    async function loadClasses() {
      const classData = await apiRequest('/api/v1/class-sections', { token: session.accessToken });
      setClasses(classData);
      setSelectedClassId(classData[0]?.id ?? '');
    }

    loadClasses().catch((error) => setNotice(error.message));
  }, [session.accessToken]);

  useEffect(() => {
    if (!selectedClassId) {
      return;
    }

    apiRequest(`/api/v1/class-sections/${selectedClassId}/students`, { token: session.accessToken })
      .then(setStudents)
      .catch((error) => setNotice(error.message));
  }, [selectedClassId, session.accessToken]);

  return (
    <section className="teacher-layout">
      <Panel title="Classes">
        <div className="class-list">
          {classes.map((classSection) => (
            <button
              className={classSection.id === selectedClassId ? 'class-active' : ''}
              key={classSection.id}
              onClick={() => setSelectedClassId(classSection.id)}
              type="button"
            >
              Class {classSection.gradeLevel}-{classSection.sectionName}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Roster">
        <DataTable
          columns={['Name', 'External ID', 'Status']}
          rows={students.map((student) => [student.displayName, student.externalStudentId || '-', student.status])}
        />
        {notice ? <p className="message message-error">{notice}</p> : null}
      </Panel>
    </section>
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

function SimpleList({ items }) {
  return (
    <ul className="simple-list">
      {items.slice(0, 6).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function DataTable({ columns, rows }) {
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
          {rows.map((row) => (
            <tr key={row.join(':')}>
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
