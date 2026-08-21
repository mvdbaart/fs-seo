import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  MousePointer, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles, 
  Eye, 
  Zap,
  Activity,
  UserCheck,
  Filter,
  Shield,
  Plus,
  X,
  Save,
  Check
} from 'lucide-react';
import AiPromptCanvas from './AiPromptCanvas';

export default function Ga4ClarityView({ projectId, activeProject }) {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageFilter, setPageFilter] = useState('seo_only'); // 'seo_only' or 'all'
  const [showExcludeManager, setShowExcludeManager] = useState(false);
  const [excludedPaths, setExcludedPaths] = useState(['/auth', '/admin', '/portaal']);
  const [newPathInput, setNewPathInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchAnalyticsData();
  }, [projectId]);

  const fetchAnalyticsData = async (customExcludedList) => {
    setLoading(true);
    try {
      const activeList = customExcludedList || excludedPaths;
      const queryParam = encodeURIComponent(activeList.join(', '));
      const res = await fetch(`/api/projects/${projectId || 1}/ga4-clarity?excluded_paths=${queryParam}`);
      const data = await res.json();
      setAnalyticsData(data);
      if (data.excludedPaths && Array.isArray(data.excludedPaths) && !customExcludedList) {
        setExcludedPaths(data.excludedPaths);
      }
    } catch (err) {
      console.error('Fout bij ophalen GA4/Clarity data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExcludedPath = (pathToAdd) => {
    const raw = (pathToAdd || newPathInput).trim().toLowerCase();
    if (!raw) return;
    const formatted = raw.startsWith('/') || raw === '(not set)' ? raw : `/${raw}`;
    if (!excludedPaths.includes(formatted)) {
      const updated = [...excludedPaths, formatted];
      setExcludedPaths(updated);
      setNewPathInput('');
      fetchAnalyticsData(updated);
    } else {
      setNewPathInput('');
    }
  };

  const handleRemoveExcludedPath = (pathToRemove) => {
    const updated = excludedPaths.filter(p => p !== pathToRemove);
    setExcludedPaths(updated);
    fetchAnalyticsData(updated);
  };

  const handleSaveExcludedAsDefault = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ga4_excluded_paths: excludedPaths.join(', ')
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        const data = await res.json();
        alert('Opslaan mislukt: ' + (data.error || 'Onbekende fout'));
      }
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && !analyticsData) return <div className="card">Laden van GA4 & Clarity Analytics...</div>;
  if (!analyticsData) return null;

  const {
    isGa4Connected, totals, previousTotals, landingPageInsights = [], allLandingPages = [],
    excludedLandingPages = [], excludedCount = 0, excludedSessionsCount = 0,
    recommendations = [], clarityProjectId, clarityUrl, clarityMessage, period, message, channelWarning
  } = analyticsData;

  const displayedPages = pageFilter === 'seo_only' ? landingPageInsights : (allLandingPages.length ? allLandingPages : landingPageInsights);

  // Nooit een getal tonen dat er niet is: een streepje is eerlijker dan een gok.
  const fmt = (value) => (value === null || value === undefined || value === '' ? '—' : value);
  const fmtNum = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('nl-NL'));

  return (
    <div>
      {/* Banner / Connection Status */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(18,183,106,0.05))', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className={`badge ${isGa4Connected ? 'badge-success' : 'badge-warning'}`}>
                {isGa4Connected ? 'Analytics: gekoppeld' : 'Analytics: nog niet gekoppeld'}
              </span>
              <span className="badge badge-info">{activeProject?.name || 'FrisseStart'}</span>
              {period && <span className="badge badge-info">{period.label}</span>}
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Analytics: gedrag op je landingspagina's</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Hoeveel bezoekers je organisch binnenhaalt, hoe lang ze blijven en waar ze wel of niet converteren.
            </p>
          </div>

          <button className={`btn btn-primary ${loading ? 'btn-progress-container' : ''}`} onClick={() => fetchAnalyticsData()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Ophalen & Analyseren...' : 'Vernieuw Analytics'}
            {loading && <div className="btn-progress-bar" />}
          </button>
        </div>
      </div>

      {/* Setup-instructies zolang Analytics niet gekoppeld is */}
      {!isGa4Connected && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'var(--warning-light)' }}>
          <h3 className="card-title" style={{ color: 'var(--warning)' }}>
            <AlertTriangle size={20} color="var(--warning)" /> Analytics is nog niet gekoppeld
          </h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>{message}</p>
          <ol style={{ fontSize: '0.88rem', color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: 1.8 }}>
            <li>Zet de <strong>Google Analytics Data API</strong> aan in hetzelfde Google Cloud-project als het service account.</li>
            <li>Ga in Analytics naar <strong>Beheer &rarr; Toegangsbeheer property</strong> en voeg het service account toe als <strong>Lezer</strong> — op property-niveau, niet alleen op accountniveau.</li>
            <li>Het numerieke Property ID wordt daarna automatisch gevonden. Lukt dat niet, vul het dan handmatig in bij Instellingen (een getal van 9 à 10 cijfers, niet <code>G-XXXXXXX</code>).</li>
          </ol>
        </div>
      )}

      {channelWarning && (
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
            <AlertTriangle size={14} color="var(--warning)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {channelWarning}
          </p>
        </div>
      )}

      {/* KPI Cards — uitsluitend gemeten waarden, nooit een fallback */}
      {isGa4Connected && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-header">Organische bezoeken</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtNum(totals.totalSessions)}</div>
            <div className="stat-subtext">
              {previousTotals ? `Vorige periode: ${fmtNum(previousTotals.totalSessions)}` : 'Via organisch zoeken'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">Betrokken bezoeken</div>
            <div className="stat-value">{fmtNum(totals.totalEngagedSessions)}</div>
            <div className="stat-subtext">Bezoekers die bleven hangen</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">Gem. bezoekduur</div>
            <div className="stat-value">{fmt(totals.averageEngagementTime)}</div>
            <div className="stat-subtext">Tijd op de site</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">Bouncepercentage</div>
            <div className="stat-value" style={{ color: parseFloat(totals.bounceRate) >= 60 ? 'var(--danger)' : 'var(--primary)' }}>
              {fmt(totals.bounceRate)}
            </div>
            <div className="stat-subtext">
              {previousTotals ? `Was ${fmt(previousTotals.bounceRate)}` : 'Haakt direct af'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">Conversieratio</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{fmt(totals.overallConversionRate)}</div>
            <div className="stat-subtext">
              {totals.keyEvents === null
                ? 'Geen sleutelgebeurtenissen ingesteld'
                : `${fmtNum(totals.keyEvents)} conversies`}
            </div>
          </div>
        </div>
      )}

      {/* Microsoft Clarity: geen koppeling, wel een doorklik */}
      <div className="card">
        <h3 className="card-title">
          <AlertTriangle size={18} color="var(--text-muted)" /> Microsoft Clarity
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: clarityUrl ? '12px' : 0 }}>
          {clarityMessage}
        </p>
        {clarityUrl && (
          <a className="btn btn-secondary" href={clarityUrl} target="_blank" rel="noreferrer">
            Open Clarity dashboard
          </a>
        )}
      </div>

      {/* Table: Landingspagina's uit organisch zoekverkeer met Uitsluitingen Filter */}
      {isGa4Connected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={20} color="var(--primary)" /> Landingspagina's uit organisch zoekverkeer
              </span>
            </h3>

            {/* Filter Toggle Buttons & Manager Knop */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setPageFilter('seo_only')}
                  className={`btn ${pageFilter === 'seo_only' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '5px 12px', border: 'none' }}
                >
                  🎯 Alleen SEO Landingspagina's ({landingPageInsights.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPageFilter('all')}
                  className={`btn ${pageFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '5px 12px', border: 'none' }}
                >
                  🌐 Alle Pagina's ({allLandingPages.length || landingPageInsights.length})
                </button>
              </div>

              <button
                type="button"
                className={`btn btn-secondary ${showExcludeManager ? 'btn-primary' : ''}`}
                onClick={() => setShowExcludeManager(!showExcludeManager)}
                style={{ fontSize: '0.8rem', padding: '5px 12px' }}
                title="Beheer uitgesloten paden zoals /auth, /admin, /portaal"
              >
                <Shield size={14} /> Uitsluitingen ({excludedCount})
              </button>
            </div>
          </div>

          {/* Filter Actief Info Banner */}
          {pageFilter === 'seo_only' && excludedCount > 0 && (
            <div style={{
              background: 'rgba(5, 150, 105, 0.06)',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 14px',
              fontSize: '0.82rem',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px'
            }}>
              <div>
                🛡️ <strong>Filter actief:</strong> {excludedCount} interne pagina's ({excludedSessionsCount} bezoeken) zijn verborgen op basis van uitgesloten paden (<code>{excludedPaths.join(', ')}</code>).
              </div>
              <button
                type="button"
                onClick={() => setShowExcludeManager(!showExcludeManager)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
              >
                {showExcludeManager ? 'Sluit beheer' : 'Paden bewerken'}
              </button>
            </div>
          )}

          {/* Uitsluitingen Beheer Paneel */}
          {showExcludeManager && (
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="var(--primary)" /> Uitgesloten paden (Interne &amp; Systeem Pagina's)
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                    Pagina's die beginnen met of matchen op deze paden worden genegeerd in de SEO-rapportage en CRO-adviezen.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveExcludedAsDefault}
                  disabled={savingSettings}
                  style={{ fontSize: '0.8rem', padding: '5px 12px' }}
                >
                  {saveSuccess ? <><Check size={14} /> Opgeslagen als standaard!</> : <><Save size={14} /> Opslaan als standaard</>}
                </button>
              </div>

              {/* Tag Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                {excludedPaths.map((term, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--danger)',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    <code>{term}</code>
                    <X
                      size={13}
                      style={{ cursor: 'pointer', opacity: 0.8 }}
                      onClick={() => handleRemoveExcludedPath(term)}
                      title={`Verwijder ${term}`}
                    />
                  </span>
                ))}
                {excludedPaths.length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Geen uitgesloten paden ingesteld (alle pagina's worden getoond).</span>
                )}
              </div>

              {/* Pad Toevoegen Form & Snelkeuzes */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px', flex: '1', minWidth: '220px' }}>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                    placeholder="bijv. /auth, /admin, /portaal of (not set)"
                    value={newPathInput}
                    onChange={(e) => setNewPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExcludedPath();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleAddExcludedPath()}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} /> Toevoegen
                  </button>
                </div>

                {/* Snelkeuzes */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Snelkeuze:</span>
                  {!excludedPaths.includes('/auth') && (
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={() => handleAddExcludedPath('/auth')}>+ /auth</button>
                  )}
                  {!excludedPaths.includes('/admin') && (
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={() => handleAddExcludedPath('/admin')}>+ /admin</button>
                  )}
                  {!excludedPaths.includes('/portaal') && (
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={() => handleAddExcludedPath('/portaal')}>+ /portaal</button>
                  )}
                  {!excludedPaths.includes('(not set)') && (
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={() => handleAddExcludedPath('(not set)')}>+ (not set)</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {displayedPages.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Geen landingspagina's met organisch verkeer gemeten in deze periode.
            </p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Landingspagina</th>
                    <th>Bezoeken</th>
                    <th>Betrokken</th>
                    <th>Bounce</th>
                    <th>Gem. tijd</th>
                    <th>Conversies</th>
                    <th>Conversieratio</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPages.map((p, i) => (
                    <tr key={i} style={p.isExcluded ? { background: 'rgba(239, 68, 68, 0.03)' } : {}}>
                      <td style={{ maxWidth: '320px', wordBreak: 'break-word' }}>
                        <span>{p.path}</span>
                        {p.isExcluded && (
                          <span
                            className="badge badge-warning"
                            style={{ fontSize: '0.68rem', padding: '1px 5px', marginLeft: '8px', verticalAlign: 'middle' }}
                            title="Deze pagina is uitgesloten van SEO statistieken"
                          >
                            Intern / Uitgesloten
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmtNum(p.sessions)}</td>
                      <td>{fmtNum(p.engagedSessions)}</td>
                      <td>{fmt(p.bounceRate)}</td>
                      <td>{fmt(p.engagedDuration)}</td>
                      <td>{fmtNum(p.keyEvents)}</td>
                      <td>
                        <strong style={{
                          color: parseFloat(p.conversionRate) >= 3.0
                            ? 'var(--primary)'
                            : (p.conversionRate !== null && parseFloat(p.conversionRate) < 1.5)
                              ? 'var(--danger)'
                              : 'var(--text-main)'
                        }}>
                          {fmt(p.conversionRate)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Actiepunten & Conversie Kansen */}
      {recommendations.length > 0 && (
        <div className="card">
          <h3 className="card-title">
            <Sparkles size={20} color="var(--primary)" /> Conversie- &amp; UX-aanbevelingen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recommendations.map((rec, i) => (
              <div key={i} className="rec-card type-opportunity">
                <div className="rec-title">{rec.title}</div>
                <div className="rec-desc">{rec.description}</div>
                <div className="rec-action">🚀 Actie: {rec.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isGa4Connected && landingPageInsights.length > 0 && (
        <AiPromptCanvas
          title="AI Prompt: conversie verhogen op je landingspagina's"
          promptId="ga4_conversion"
          promptText={`Je bent een CRO-specialist (conversie-optimalisatie). Hier zijn de gemeten Analytics-cijfers voor ${activeProject?.name || ''} over de periode ${period?.label || ''}:\n\nTotaal:\n- Organische bezoeken: ${fmtNum(totals.totalSessions)}\n- Betrokken bezoeken: ${fmtNum(totals.totalEngagedSessions)}\n- Gemiddelde bezoekduur: ${fmt(totals.averageEngagementTime)}\n- Bouncepercentage: ${fmt(totals.bounceRate)}\n- Conversies: ${fmtNum(totals.keyEvents)} (${fmt(totals.overallConversionRate)})\n\nPer landingspagina:\n${landingPageInsights.map(p => `- ${p.path}: ${fmtNum(p.sessions)} bezoeken, ${fmt(p.bounceRate)} bounce, ${fmt(p.engagedDuration)} gemiddelde tijd, ${fmtNum(p.keyEvents)} conversies (${fmt(p.conversionRate)})`).join('\n')}\n\nOpdracht:\n1. Benoem de drie pagina's met de grootste conversiekans en leg per pagina uit waaróm je dat uit deze cijfers afleidt.\n2. Geef per pagina een concreet verbeteradvies voor tekst, call-to-action en formulier.\n3. Schrijf 3 A/B-testhypotheses, elk met de verwachte uitkomst.\n4. Gebruik uitsluitend de cijfers hierboven. Verzin niets.`}
        />
      )}
    </div>
  );
}

