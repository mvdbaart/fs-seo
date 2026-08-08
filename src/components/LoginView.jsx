import React, { useState, useEffect } from 'react';
import { SearchCheck, ShieldCheck, Copy, Check, Smartphone, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';

// Groepjes van vier maken de sleutel leesbaar voor handmatige invoer.
function groupSecret(secret) {
  return (secret || '').replace(/(.{4})/g, '$1 ').trim();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

function CopyButton({ value, label = 'Kopieer' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button type="button" className="btn btn-secondary" onClick={handleCopy} style={{ whiteSpace: 'nowrap' }}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? 'Gekopieerd' : label}
    </button>
  );
}

export default function LoginView({ onAuthenticated }) {
  const enrollTokenFromUrl = new URLSearchParams(window.location.search).get('enroll');

  const [mode, setMode] = useState(enrollTokenFromUrl ? 'enroll' : 'login');
  const [enrollToken, setEnrollToken] = useState(enrollTokenFromUrl || '');
  const [enrollment, setEnrollment] = useState(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [savedAcknowledged, setSavedAcknowledged] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Haal de QR + sleutel op zodra we een geldig enroll-token hebben.
  useEffect(() => {
    if (mode !== 'enroll' || !enrollToken) return;
    let cancelled = false;

    setBusy(true);
    fetch(`/api/auth/enroll/${enrollToken}`)
      .then(async res => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Deze uitnodigingslink is ongeldig of verlopen');
          setEnrollment(null);
        } else {
          setEnrollment(data);
          setError('');
        }
      })
      .catch(err => { if (!cancelled) setError('Kan de uitnodiging niet laden: ' + err.message); })
      .finally(() => { if (!cancelled) setBusy(false); });

    return () => { cancelled = true; };
  }, [mode, enrollToken]);

  const finish = (user) => {
    // Haal ?enroll= uit de URL zodat een refresh niet opnieuw het enrollment opent.
    window.history.replaceState({}, '', window.location.pathname);
    onAuthenticated(user);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Inloggen mislukt');
        setCode('');
        return;
      }
      finish(data.user);
    } catch (err) {
      setError('Inloggen mislukt: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmEnroll = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/enroll/${enrollToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Aanmelden mislukt');
        setCode('');
        return;
      }
      // De server heeft de sessie-cookie al gezet; eerst de herstelcodes tonen.
      setRecoveryCodes(data.recoveryCodes);
      setPendingUser(data.user);
    } catch (err) {
      setError('Aanmelden mislukt: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recoveryCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Herstellen mislukt');
        return;
      }
      // Een herstelcode levert een nieuwe uitnodiging op, geen directe sessie:
      // je authenticator is weg, dus je moet opnieuw aanmelden.
      setRecoveryCode('');
      setCode('');
      setEnrollToken(data.token);
      setMode('enroll');
    } catch (err) {
      setError('Herstellen mislukt: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const header = (title, subtitle) => (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div className="brand-icon" style={{ margin: '0 auto 14px' }}>
        <SearchCheck size={22} />
      </div>
      <h1 style={{ fontSize: '1.35rem', marginBottom: 6 }}>{title}</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{subtitle}</p>
    </div>
  );

  // ----- Herstelcodes (eenmalig, na geslaagd aanmelden) -----
  if (recoveryCodes) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          {header('Bewaar je herstelcodes', 'Je ziet deze codes maar één keer. Zonder je authenticator-app zijn ze de enige manier om weer binnen te komen.')}

          <div className="recovery-grid" style={{ marginBottom: 16 }}>
            {recoveryCodes.map(rc => <span key={rc}>{rc}</span>)}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <CopyButton value={recoveryCodes.join('\n')} label="Kopieer alle codes" />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.85rem', marginBottom: 18, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={savedAcknowledged}
              onChange={e => setSavedAcknowledged(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>Ik heb de codes op een veilige plek opgeslagen</span>
          </label>

          <button
            className="btn btn-primary"
            disabled={!savedAcknowledged}
            onClick={() => finish(pendingUser)}
            style={{ width: '100%', justifyContent: 'center', opacity: savedAcknowledged ? 1 : 0.5 }}
          >
            Naar de tool
          </button>
        </div>
      </div>
    );
  }

  // ----- Aanmelden: QR scannen of sleutel invoeren -----
  if (mode === 'enroll') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          {header('Authenticator instellen', enrollment ? enrollment.email : 'Je uitnodiging wordt geladen…')}

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          {busy && !enrollment && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} /> Laden…
            </div>
          )}

          {enrollment && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img
                  src={enrollment.qrDataUrl}
                  alt="QR-code voor je authenticator-app"
                  style={{ width: 200, height: 200, maxWidth: '100%', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                />
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Scan met Google Authenticator, 1Password, Bitwarden of Microsoft Authenticator.
                </p>
              </div>

              {/* Op een telefoon kun je je eigen scherm niet scannen: de otpauth-link
                  opent de authenticator-app direct met de sleutel erin. */}
              <a
                href={enrollment.uri}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 12, textDecoration: 'none' }}
              >
                <Smartphone size={15} /> Op je telefoon? Open in authenticator-app
              </a>

              <div style={{ marginBottom: 18 }}>
                <span className="form-label">Of voer deze sleutel handmatig in</span>
                <div className="auth-secret" style={{ marginBottom: 8 }}>{groupSecret(enrollment.secret)}</div>
                <CopyButton value={enrollment.secret} label="Kopieer sleutel" />
              </div>

              <form onSubmit={handleConfirmEnroll} className="auth-form">
                <div>
                  <label className="form-label" htmlFor="enroll-code">Voer ter controle de 6-cijferige code in</label>
                  <input
                    id="enroll-code"
                    className="input-field auth-code-input"
                    style={{ width: '100%' }}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    required
                  />
                </div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy || code.length !== 6}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <ShieldCheck size={16} /> {busy ? 'Bezig…' : 'Aanmelden afronden'}
                </button>
              </form>
            </>
          )}

          {!busy && !enrollment && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => { setMode('login'); setError(''); setEnrollToken(''); }}
            >
              <ArrowLeft size={15} /> Terug naar inloggen
            </button>
          )}
        </div>
      </div>
    );
  }

  // ----- Herstellen met een herstelcode -----
  if (mode === 'recover') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          {header('Authenticator kwijt', 'Gebruik een van je herstelcodes om een nieuwe authenticator in te stellen.')}

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleRecover} className="auth-form">
            <div>
              <label className="form-label" htmlFor="recover-email">E-mailadres</label>
              <input
                id="recover-email"
                type="email"
                className="input-field"
                style={{ width: '100%' }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="recover-code">Herstelcode</label>
              <input
                id="recover-code"
                className="input-field"
                style={{ width: '100%', fontFamily: 'ui-monospace, monospace' }}
                value={recoveryCode}
                onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              <KeyRound size={16} /> {busy ? 'Bezig…' : 'Herstellen'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button type="button" className="auth-link-btn" onClick={() => { setMode('login'); setError(''); }}>
              Terug naar inloggen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Inloggen -----
  return (
    <div className="auth-page">
      <div className="auth-card">
        {header('FS SEO Prof.', 'Log in met je e-mailadres en de code uit je authenticator-app.')}

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
          <div>
            <label className="form-label" htmlFor="login-email">E-mailadres</label>
            <input
              id="login-email"
              type="email"
              className="input-field"
              style={{ width: '100%' }}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="form-label" htmlFor="login-code">Code uit je authenticator-app</label>
            <input
              id="login-code"
              className="input-field auth-code-input"
              style={{ width: '100%' }}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || code.length !== 6}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ShieldCheck size={16} /> {busy ? 'Bezig…' : 'Inloggen'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button type="button" className="auth-link-btn" onClick={() => { setMode('recover'); setError(''); }}>
            Authenticator kwijt?
          </button>
        </div>
      </div>
    </div>
  );
}
