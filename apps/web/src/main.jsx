import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBaseUrl = (import.meta.env.VITE_SMARTFLN_API_BASE_URL ?? 'http://127.0.0.1:8080').replace(
  /\/$/,
  ''
);

const demoCredentials = {
  email: 'teacher@smartfln.local',
  password: 'SmartFLN@123'
};

function App() {
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    setUser(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, deviceId: 'web-mvp' })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error?.message ?? 'Login failed.');
      }

      setUser(body.data.user);
      setStatus('success');
      setMessage(`Signed in as ${body.data.user.displayName}.`);
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  return (
    <main className="shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">SmartFLN MVP</p>
          <h1 id="login-title">Teacher Login</h1>
          <p className="intro">Sign in to manage scans, reviews, class results, and analytics.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

        {user ? (
          <dl className="session-summary" aria-label="Signed in user">
            <div>
              <dt>Role</dt>
              <dd>{user.roles.join(', ')}</dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>{user.tenantId}</dd>
            </div>
          </dl>
        ) : null}

        <div className="status-grid" aria-label="Milestone 1 scope">
          <span>Secure Access</span>
          <span>Teacher Review</span>
          <span>Class Results</span>
          <span>Paper Scans</span>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
