import React, { useState, useEffect } from 'react';
import { Settings, Key, Globe, Database, Save, Check, Trash2, Users, UserPlus, RefreshCw, Copy, Ban, CheckCircle2 } from 'lucide-react';

export default function SettingsView({ activeProject, currentUser, onProjectChange }) {
  const isAdmin = currentUser?.role === 'admin';

  // Gebruikersbeheer
  const [users, setUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteFor, setInviteFor] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const [pagespeedKey, setPagespeedKey] = useState('');
  const [serpKey, setSerpKey] = useState('');
  const [gscJson, setGscJson] = useState('');
  const [gscConnected, setGscConnected] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(false);
  const [autoCheckFrequency, setAutoCheckFrequency] = useState('daily');
  const [reportRecipients, setReportRecipients] = useState('');
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  const [clarityProjectId, setClarityProjectId] = useState('');
  // Ads-secrets worden nooit teruggegeven door de API; leeg laten = ongewijzigd.
  const [adsConnected, setAdsConnected] = useState(false);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [placesConnected, setPlacesConnected] = useState(false);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [placesApiKey, setPlacesApiKey] = useState('');
  const [gbpLocationId, setGbpLocationId] = useState('');
  const [adsDeveloperToken, setAdsDeveloperToken] = useState('');
  const [adsClientId, setAdsClientId] = useState('');
  const [adsClientSecret, setAdsClientSecret] = useState('');
  const [adsRefreshToken, setAdsRefreshToken] = useState('');
  const [adsCustomerId, setAdsCustomerId] = useState('');
  const [adsLoginCustomerId, setAdsLoginCustomerId] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('FrisseStart/fs-next');
  const [remoteFsNextUrl, setRemoteFsNextUrl] = useState('');
  const [githubStatus, setGithubStatus] = useState(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState([]);
  
  // New Project Form
  const [newProjName, setNewProjName] = useState('');
  const [newProjDomain, setNewProjDomain] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (!res.ok) return;
      setUsers(await res.json());
    } catch (err) {
      console.error('Fout bij ophalen gebruikers:', err);
    }
  };

  // De enroll-link wordt hier opgebouwd zodat de server geen basis-URL hoeft te kennen.
  const showInvite = (email, token) => {
    setInviteFor(email);
    setInviteLink(`${window.location.origin}/?enroll=${token}`);
    setLinkCopied(false);
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail) return;
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUserEmail, name: newUserName, role: newUserRole })
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Uitnodigen mislukt: ' + data.error);
        return;
      }
      showInvite(data.user.email, data.token);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('member');
      fetchUsers();
    } catch (err) {
      alert('Uitnodigen mislukt: ' + err.message);
    }
  };

  const handleResetTotp = async (user) => {
    if (!confirm(`Authenticator van ${user.email} resetten? De huidige app en herstelcodes werken daarna niet meer.`)) return;
    try {
      const res = await fetch(`/api/auth/users/${user.id}/reset-totp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert('Resetten mislukt: ' + data.error);
        return;
      }
      showInvite(user.email, data.token);
      fetchUsers();
    } catch (err) {
      alert('Resetten mislukt: ' + err.message);
    }
  };

  const handleToggleDisabled = async (user) => {
    try {
      const res = await fetch(`/api/auth/users/${user.id}/disabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !user.disabled })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      fetchUsers();
    } catch (err) {
      alert('Wijzigen mislukt: ' + err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Account ${user.email} definitief verwijderen?`)) return;
    try {
      const res = await fetch(`/api/auth/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      fetchUsers();
    } catch (err) {
      alert('Verwijderen mislukt: ' + err.message);
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      /* clipboard geweigerd — de link staat al zichtbaar in beeld */
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.pagespeed_api_key) setPagespeedKey(data.pagespeed_api_key);
      if (data.serp_api_key) setSerpKey(data.serp_api_key);
      setGscConnected(Boolean(data.gsc_connected));
      if (data.business_name) setBusinessName(data.business_name);
      if (data.business_address) setBusinessAddress(data.business_address);
      if (data.business_phone) setBusinessPhone(data.business_phone);
      if (data.ga4_property_id) setGa4PropertyId(data.ga4_property_id);
      if (data.clarity_project_id) setClarityProjectId(data.clarity_project_id);
      setAdsConnected(Boolean(data.google_ads_connected));
      setGbpConnected(Boolean(data.gbp_connected));
      setPlacesConnected(Boolean(data.places_connected));
      if (data.gbp_location_id) setGbpLocationId(data.gbp_location_id);
      if (data.google_ads_customer_id) setAdsCustomerId(data.google_ads_customer_id);
      if (data.google_ads_login_customer_id) setAdsLoginCustomerId(data.google_ads_login_customer_id);
      if (data.github_token) setGithubToken(data.github_token);
      if (data.github_repo) setGithubRepo(data.github_repo);
      if (data.remote_fs_next_url) setRemoteFsNextUrl(data.remote_fs_next_url);
      setAutoCheckEnabled(data.auto_check_enabled === '1');
      if (data.auto_check_frequency) setAutoCheckFrequency(data.auto_check_frequency);
      if (data.report_email_recipients) setReportRecipients(data.report_email_recipients);

      fetchGithubStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGithubStatus = async () => {
    try {
      const res = await fetch('/api/github/status');
      const data = await res.json();
      setGithubStatus(data);
    } catch (err) {
      console.error('Fout bij ophalen GitHub status:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        pagespeed_api_key: pagespeedKey,
        serp_api_key: serpKey,
        business_name: businessName,
        business_address: businessAddress,
        business_phone: businessPhone,
        ga4_property_id: ga4PropertyId,
        clarity_project_id: clarityProjectId,
        google_ads_customer_id: adsCustomerId,
        google_ads_login_customer_id: adsLoginCustomerId,
        gbp_location_id: gbpLocationId,
        github_token: githubToken,
        github_repo: githubRepo,
        remote_fs_next_url: remoteFsNextUrl,
        auto_check_enabled: autoCheckEnabled ? '1' : '0',
        auto_check_frequency: autoCheckFrequency,
        report_email_recipients: reportRecipients
      };
      if (gscJson.trim()) payload.gsc_service_account_json = gscJson.trim();
      // Secrets alleen meesturen als ze zijn ingevuld, anders wist opslaan ze.
      if (adsDeveloperToken.trim()) payload.google_ads_developer_token = adsDeveloperToken.trim();
      if (adsClientId.trim()) payload.google_ads_client_id = adsClientId.trim();
      if (adsClientSecret.trim()) payload.google_ads_client_secret = adsClientSecret.trim();
      if (adsRefreshToken.trim()) payload.google_ads_refresh_token = adsRefreshToken.trim();
      if (oauthClientId.trim()) payload.google_oauth_client_id = oauthClientId.trim();
      if (oauthClientSecret.trim()) payload.google_oauth_client_secret = oauthClientSecret.trim();
      if (placesApiKey.trim()) payload.places_api_key = placesApiKey.trim();

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setGscJson('');
      fetchSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Fout bij opslaan instellingen: ' + err.message);
    }
  };

  const handleSendTestEmail = async () => {
    if (!reportRecipients) {
      alert('Vul eerst een of meerdere e-mailadressen in bij het veld e-mail ontvangers.');
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject?.id || 1, to: reportRecipients })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Test e-mail succesvol verzonden naar: ${data.recipients}! Check je inbox.`);
      } else {
        alert(`Fout bij versturen e-mail: ${data.error}`);
      }
    } catch (err) {
      alert(`Fout bij versturen e-mail: ${err.message}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjName || !newProjDomain) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjName, domain: newProjDomain })
      });
      const newProj = await res.json();
      setNewProjName('');
      setNewProjDomain('');
      fetchProjects();
      if (onProjectChange) onProjectChange(newProj);
    } catch (err) {
      alert('Fout bij aanmaken project');
    }
  };

  const handleDeleteProject = async (proj) => {
    if (!window.confirm(`Weet u zeker dat u het project "${proj.name}" (${proj.domain}) wilt verwijderen?\nAlle opgeslagen keywords en rankings voor dit project worden definitief gewist.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${proj.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const updatedProjects = projects.filter(p => p.id !== proj.id);
        setProjects(updatedProjects);
        
        // If active project was deleted, switch to first remaining project
        if (activeProject?.id === proj.id && updatedProjects.length > 0) {
          if (onProjectChange) onProjectChange(updatedProjects[0]);
        }
      }
    } catch (err) {
      alert('Fout bij verwijderen van project: ' + err.message);
    }
  };

  return (
    <div>
      {/* Gebruikersbeheer (alleen beheerders) */}
      {isAdmin && (
        <div className="card">
          <h2 className="card-title">
            <Users size={20} color="var(--primary)" /> Gebruikers
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Nodig collega's uit. Ze stellen zelf een authenticator-app in via de aanmeldlink — geef die
            link persoonlijk door, hij is 48 uur geldig.
          </p>

          {inviteLink && (
            <div className="alert alert-info" style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Aanmeldlink voor {inviteFor}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="input-field" readOnly value={inviteLink} style={{ minWidth: '260px', fontSize: '0.8rem' }} />
                <button className="btn btn-secondary" onClick={handleCopyInvite}>
                  {linkCopied ? <Check size={15} /> : <Copy size={15} />} {linkCopied ? 'Gekopieerd' : 'Kopieer'}
                </button>
                <button className="btn btn-secondary" onClick={() => setInviteLink('')}>Sluiten</button>
              </div>
            </div>
          )}

          <div className="table-container" style={{ marginBottom: '24px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Naam</th>
                  <th>Rol</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.name || '—'}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                        {u.role === 'admin' ? 'Beheerder' : 'Gebruiker'}
                      </span>
                    </td>
                    <td>
                      {u.disabled ? (
                        <span className="badge badge-danger">Geblokkeerd</span>
                      ) : u.enrolled ? (
                        <span className="badge badge-success">Actief</span>
                      ) : (
                        <span className="badge badge-warning">Nog niet aangemeld</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" onClick={() => handleResetTotp(u)} title="Nieuwe aanmeldlink; oude authenticator vervalt">
                        <RefreshCw size={14} /> Reset
                      </button>{' '}
                      <button className="btn btn-secondary" onClick={() => handleToggleDisabled(u)}>
                        {u.disabled ? <CheckCircle2 size={14} /> : <Ban size={14} />} {u.disabled ? 'Activeer' : 'Blokkeer'}
                      </button>{' '}
                      <button className="btn btn-danger" onClick={() => handleDeleteUser(u)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ color: 'var(--text-dim)' }}>Nog geen gebruikers.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={handleInviteUser} className="input-group" style={{ flexWrap: 'wrap' }}>
            <input
              type="email"
              className="input-field"
              placeholder="E-mailadres"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              required
            />
            <input
              type="text"
              className="input-field"
              placeholder="Naam (optioneel)"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
            <select
              className="input-field"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              style={{ flex: '0 0 auto' }}
            >
              <option value="member">Gebruiker</option>
              <option value="admin">Beheerder</option>
            </select>
            <button className="btn btn-primary" type="submit" style={{ flex: '0 0 auto' }}>
              <UserPlus size={16} /> Uitnodigen
            </button>
          </form>
        </div>
      )}

      {/* API Key Configuration */}
      <div className="card">
        <h2 className="card-title">
          <Key size={20} color="var(--primary)" /> API Sleutels & Koppelingen
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Beheer je gratis of betaalde API-keys voor live Google.nl data en PageSpeed kwota.
        </p>

        <form onSubmit={handleSaveSettings}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
              Google PageSpeed Insights API Key (Optioneel)
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="AIzaSy..." 
              value={pagespeedKey}
              onChange={(e) => setPagespeedKey(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Laat leeg om de gratis openbare Google API-limiet te gebruiken.
            </span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
              SERP API Key (Serper / DataForSEO / SerpAPI)
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Sleutel voor live SERP scans..." 
              value={serpKey}
              onChange={(e) => setSerpKey(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Vereist voor het geautomatiseerd ophalen van échte live `google.nl` rank data.
            </span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
              Google Search Console — Service Account JSON{' '}
              {gscConnected ? (
                <span className="badge badge-success">Gekoppeld</span>
              ) : (
                <span className="badge badge-warning">Niet gekoppeld</span>
              )}
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
              placeholder='Plak hier de volledige service account JSON ({"type": "service_account", ...})'
              value={gscJson}
              onChange={(e) => setGscJson(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Maak in Google Cloud een service account aan met de Search Console API, download de JSON-sleutel en voeg het service account e-mailadres toe als gebruiker (Volledig) in Search Console. De sleutel wordt alleen op de server opgeslagen.
            </span>
          </div>

          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.92rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={autoCheckEnabled}
                onChange={(e) => setAutoCheckEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              Geautomatiseerde ranking check & E-mail rapportage
            </label>

            {autoCheckEnabled && (
              <div style={{ marginTop: '16px', paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Frequentie van de automatische scan & rapportage:
                  </label>
                  <select
                    className="input-field"
                    style={{ maxWidth: '240px' }}
                    value={autoCheckFrequency}
                    onChange={(e) => setAutoCheckFrequency(e.target.value)}
                  >
                    <option value="daily">Dagelijks (~elke 24 uur)</option>
                    <option value="weekly">Wekelijks (~elke 7 dagen)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    E-mailadres(sen) voor geautomatiseerde rapporten (gescheiden door komma):
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="bijv. mvdbaart@gmail.com, frissestartbv@gmail.com"
                      value={reportRecipients}
                      onChange={(e) => setReportRecipients(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSendTestEmail}
                      disabled={sendingTestEmail}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {sendingTestEmail ? 'Versturen...' : '📧 Stuur Test Rapport'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginTop: '4px' }}>
                    Verzendt automatisch een geformatteerd SEO overzicht via de Resend API na elke geautomatiseerde scan.
                  </span>
                </div>
              </div>
            )}
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 12px' }}>Conversie & UX Analytics Koppelingen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                Google Analytics 4 (GA4) Property ID
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="bijv. 348291056"
                value={ga4PropertyId}
                onChange={(e) => setGa4PropertyId(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Numerieke ID in GA4 Beheer ➔ Property Settings. Gebruikt hetzelfde Service Account.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                Microsoft Clarity Project ID / API Key
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="bijv. k9x2p8q1m"
                value={clarityProjectId}
                onChange={(e) => setClarityProjectId(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Vind in Clarity Settings ➔ Overview ➔ Project ID. Alleen voor de doorklik; Clarity heeft geen automatische koppeling.
              </span>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 4px' }}>
            Google Bedrijfsprofiel &amp; Maps {gbpConnected && <span className="badge badge-success">gekoppeld</span>}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
            Bedrijfsprofiel werkt met OAuth, niet met een service account: de gegevens zijn jouw eigendom, dus Google vraagt
            om jouw toestemming. Maak een OAuth client aan (type &ldquo;Desktop app&rdquo;), vul client ID en secret hieronder in,
            en draai daarna eenmalig <code>node server/oauth-setup.js gbp</code> om de koppeling af te ronden.
            Let op: de Business Profile API heeft ook goedkeuring van Google nodig voordat je quotum boven nul komt.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>OAuth client ID</label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={oauthClientId} onChange={(e) => setOauthClientId(e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Wordt gedeeld met Google Ads.</span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>OAuth client secret</label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                Places API-sleutel {placesConnected && <span className="badge badge-success">actief</span>}
              </label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={placesApiKey} onChange={(e) => setPlacesApiKey(e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Voor beoordelingen van jou en je concurrenten. Wordt maximaal één keer per dag opgehaald.
              </span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Vestiging (optioneel)</label>
              <input type="text" className="input-field" placeholder="Alleen bij meerdere vestigingen"
                value={gbpLocationId} onChange={(e) => setGbpLocationId(e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Standaard wordt de eerste vestiging gerapporteerd.</span>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 4px' }}>
            Google Ads {adsConnected && <span className="badge badge-success">gekoppeld</span>}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
            De Google Ads API accepteert geen service account. Je hebt een developer token nodig (Google Ads ➔ Tools ➔ API Center)
            plus een OAuth2 client en refresh token. Zolang deze velden leeg zijn, toont de tool geen Ads-cijfers.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Developer token</label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={adsDeveloperToken} onChange={(e) => setAdsDeveloperToken(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Customer ID</label>
              <input type="text" className="input-field" placeholder="bijv. 1868790470"
                value={adsCustomerId} onChange={(e) => setAdsCustomerId(e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>10 cijfers, zonder streepjes.</span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>OAuth client ID</label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={adsClientId} onChange={(e) => setAdsClientId(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>OAuth client secret</label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={adsClientSecret} onChange={(e) => setAdsClientSecret(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Refresh token</label>
              <input type="password" className="input-field" placeholder="Laat leeg om ongewijzigd te laten"
                value={adsRefreshToken} onChange={(e) => setAdsRefreshToken(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Login customer ID (optioneel)</label>
              <input type="text" className="input-field" placeholder="Alleen bij een MCC-account"
                value={adsLoginCustomerId} onChange={(e) => setAdsLoginCustomerId(e.target.value)} />
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '18px 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} color="var(--primary)" /> GitHub & Remote Vercel Connector (`github-fs`)
          </h3>
          <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="github_pat_11..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  PAT met `repo` / `contents:write` rechten om direct op GitHub te pushen.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  GitHub Repository (Owner/Repo)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="FrisseStart/fs-next"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  De GitHub repository waarnaar Vercel is gekoppeld.
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                Remote Vercel URL (Productie / Staging API)
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="https://frissestart.nl of https://fs-next-xxx.vercel.app"
                value={remoteFsNextUrl}
                onChange={(e) => setRemoteFsNextUrl(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Hiermee communiceert de SEO App direct wanneer fs-next live op Vercel staat.
              </span>
            </div>

            {githubStatus && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', fontSize: '0.82rem' }}>
                <span className={`badge ${githubStatus.gitHubApiConnection ? 'badge-success' : 'badge-warning'}`}>
                  {githubStatus.gitHubApiConnection ? 'GitHub Repo: Gekoppeld' : 'GitHub: Vul PAT Token in'}
                </span>
                <span className={`badge ${githubStatus.remoteVercelConnection ? 'badge-success' : 'badge-info'}`}>
                  {githubStatus.remoteVercelConnection ? 'Vercel API: Live Online' : 'Vercel API: Standby / Lokaal'}
                </span>
              </div>
            )}

            {/* Handleiding voor de gebruiker */}
            <details style={{ marginTop: '14px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '0.85rem' }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--primary)' }}>
                📖 Hoe kom je aan deze GitHub & Vercel gegevens? (Klik voor stappenplan)
              </summary>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>1. GitHub Personal Access Token (PAT) Rechten (Permissions):</strong>
                  <div style={{ marginTop: '4px' }}>
                    <p>Afhankelijk van het type token dat je aanmaakt in GitHub:</p>
                    <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                      <li><strong>Fine-grained token (Aanbevolen):</strong> Selecteer de <code>FrisseStart/fs-next</code> repository en stel bij <strong>Repository permissions</strong> in:
                        <br />- <code>Contents</code> ➔ <strong>Read and Write</strong> (om bestanden te lezen en SEO-commits te maken)
                        <br />- <code>Metadata</code> ➔ <strong>Read-only</strong> (wordt automatisch geselecteerd)
                      </li>
                      <li style={{ marginTop: '6px' }}><strong>Tokens (classic):</strong> Vink simpelweg het vinkje <strong><code>repo</code></strong> aan (geeft volledige toegang tot lezen en committen op private repositories).</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <strong style={{ color: 'var(--text-main)' }}>2. GitHub Repository (Owner/Repo):</strong>
                  <p style={{ marginTop: '2px' }}>
                    De naam van je GitHub-repository inclusief je organisatie/gebruikersnaam. Bijvoorbeeld: <code>FrisseStart/fs-next</code> of <code>jouwnaam/fs-next</code>.
                  </p>
                </div>

                <div>
                  <strong style={{ color: 'var(--text-main)' }}>3. Remote Vercel URL:</strong>
                  <p style={{ marginTop: '2px' }}>
                    Ga naar je <strong>Vercel Dashboard ➔ Project Settings ➔ Domains</strong>. Kopieer de live URL (bijv. <code>https://frissestart.nl</code> of <code>https://fs-next-xxx.vercel.app</code>).
                  </p>
                </div>
              </div>
            </details>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 12px' }}>Bedrijfsgegevens (NAP) voor Local SEO</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Bedrijfsnaam"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Adres (straat, postcode, plaats)"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Telefoonnummer"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary">
            {saved ? <><Check size={16} /> Opgeslagen!</> : <><Save size={16} /> Instellingen Opslaan</>}
          </button>
        </form>
      </div>

      {/* Project Management */}
      <div className="card">
        <h3 className="card-title">
          <Database size={20} color="var(--accent)" /> Projecten & Domeinen Beheren
        </h3>
        
        <form onSubmit={handleCreateProject} className="input-group" style={{ marginBottom: '20px' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Projectnaam (bijv. Webshop Nederland)" 
            value={newProjName}
            onChange={(e) => setNewProjName(e.target.value)}
            required
          />
          <input 
            type="url" 
            className="input-field" 
            placeholder="Domein (https://mijnwebshop.nl)" 
            value={newProjDomain}
            onChange={(e) => setNewProjDomain(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-secondary">Nieuw Project</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projects.map(proj => (
            <div 
              key={proj.id} 
              style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px', 
                background: activeProject?.id === proj.id ? 'var(--primary-light)' : 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-md)',
                border: activeProject?.id === proj.id ? '1px solid var(--border-active)' : '1px solid var(--border-color)'
              }}
            >
              <div>
                <strong>{proj.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({proj.domain})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {activeProject?.id === proj.id ? (
                  <span className="badge badge-success">Actief Project</span>
                ) : (
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onProjectChange(proj)}>
                    Selecteer
                  </button>
                )}

                <button 
                  className="btn btn-danger" 
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => handleDeleteProject(proj)}
                  title="Project Verwijderen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
