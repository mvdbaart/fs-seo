import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MousePointer, 
  Eye, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ShieldCheck,
  ShieldOff,
  Target,
  PlusCircle,
  Tag
} from 'lucide-react';
import { isBrandKeyword } from '../utils/brandFilter';

export default function GscView({ projectId, activeProject }) {
  const [gscData, setGscData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [copiedCtr, setCopiedCtr] = useState(false);
  const [copiedPage2, setCopiedPage2] = useState(false);
  const [hideBrand, setHideBrand] = useState(false);

  useEffect(() => {
    fetchGscData();
  }, [projectId]);

  const fetchGscData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/gsc`);
      const data = await res.json();
      setGscData(data);
    } catch (err) {
      console.error('Fout bij ophalen GSC data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportToRankTracker = async () => {
    setImporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/gsc/import-keywords`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setImported(true);
        setTimeout(() => setImported(false), 3000);
      }
    } catch (err) {
      alert('Fout bij importeren zoekwoorden: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCopyPrompt = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'ctr') {
      setCopiedCtr(true);
      setTimeout(() => setCopiedCtr(false), 2500);
    } else {
      setCopiedPage2(true);
      setTimeout(() => setCopiedPage2(false), 2500);
    }
  };

  if (loading && !gscData) return <div className="card">Laden van Google Search Console gegevens...</div>;
  if (!gscData) return null;

  const { totals, ctrOpportunities = [], strikingDistance = [], indexationHealth, actionPlan, aiPrompts } = gscData;
  const fmtNum = (v) => (v === null || v === undefined) ? '—' : v.toLocaleString('nl-NL');

  const domain = activeProject?.domain || gscData.domain || '';
  const businessName = activeProject?.name || '';
  const isBrand = (kwStr) => isBrandKeyword(kwStr, domain, businessName);

  const filteredCtrOpp = ctrOpportunities.filter(op => !hideBrand || !isBrand(op.keyword));
  const filteredStriking = strikingDistance.filter(s => !hideBrand || !isBrand(s.keyword));

  return (
    <div>
      {/* GSC niet gekoppeld banner */}
      {!gscData.gscConnected && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(241,139,26,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Google Search Console is nog niet gekoppeld.</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
                De posities hieronder komen uit live Google.nl checks van je eigen zoekwoorden; klikken, vertoningen en CTR zijn pas beschikbaar na koppeling.
              </p>
              {gscData.gscError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '4px' }}>Koppelingsfout: {gscData.gscError}</p>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>{gscData.connectInstructions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className={`badge ${gscData.gscConnected ? 'badge-success' : 'badge-warning'}`}>
                {gscData.gscConnected ? 'Google Search Console: Live Gekoppeld' : 'GSC niet gekoppeld — eigen ranking-data'}
              </span>
              <span className="badge badge-info">{gscData.domain}</span>
              {gscData.period && (
                <span className="badge badge-info">{gscData.period.startDate} t/m {gscData.period.endDate}</span>
              )}
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Search Console Audit & Plan van Aanpak</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Identificeer zoekwoorden met hoge vertoningen maar lage CTR, pagina 2 kansen en genereer kant-en-klare AI prompts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={`btn ${hideBrand ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setHideBrand(!hideBrand)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {hideBrand ? <ShieldOff size={16} /> : <Tag size={16} />}
              {hideBrand ? 'Merknamen Verborgen' : 'Verberg Merknamen'}
            </button>
            <button className="btn btn-secondary" onClick={handleImportToRankTracker} disabled={importing}>
              {imported ? (
                <>
                  <Check size={16} color="var(--primary)" /> Gekoppeld aan Rank Tracker!
                </>
              ) : importing ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Importeren...
                </>
              ) : (
                <>
                  <PlusCircle size={16} /> Importeer naar Rank Tracker
                </>
              )}
            </button>

            <button className={`btn btn-primary ${loading ? 'btn-progress-container' : ''}`} onClick={fetchGscData} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Verbinding Testen...' : '🧪 Test GSC Verbinding'}
              {loading && <div className="btn-progress-bar" />}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span>Totaal Organische Klikken</span>
            <MousePointer size={18} color="var(--primary)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtNum(totals.totalClicks)}</div>
          <div className="stat-subtext">{gscData.gscConnected ? 'Laatste 28 dagen' : 'Vereist GSC-koppeling'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Totaal Vertoningen (Impressies)</span>
            <Eye size={18} color="var(--primary)" />
          </div>
          <div className="stat-value">{fmtNum(totals.totalImpressions)}</div>
          <div className="stat-subtext">{gscData.gscConnected ? 'Verschijningen in Google.nl' : 'Vereist GSC-koppeling'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Gemiddelde CTR</span>
            <TrendingUp size={18} color="var(--warning)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{totals.averageCtr || '—'}</div>
          <div className="stat-subtext">{gscData.gscConnected ? 'Doel: > 4.0%' : 'Vereist GSC-koppeling'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Gemiddelde Positie</span>
            <Target size={18} color="var(--text-main)" />
          </div>
          <div className="stat-value">{totals.averagePosition !== null ? `#${totals.averagePosition}` : '—'}</div>
          <div className="stat-subtext">Over alle zoekwoorden</div>
        </div>
      </div>

      {/* Table 1: High Potential CTR Opportunities */}
      <div className="card">
        <h3 className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="var(--primary)" /> High Potential CTR Kansen (Hoge Vertoningen op Pagina 1)
          </span>
          <span className="badge badge-success">{filteredCtrOpp.length} kansen gevonden</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Deze zoekwoorden staan al op pagina 1 in Google.nl (#1-#5), maar behalen een lage CTR (&lt; 3%). Herschrijf de Title & Meta Description om direct extra bezoekers te trekken.
        </p>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Zoekwoord</th>
                <th>Google.nl Positie</th>
                <th>Vertoningen</th>
                <th>Huidige CTR</th>
                <th>Potentiële Extra Klikken</th>
                <th>Doel URL</th>
              </tr>
            </thead>
            <tbody>
              {filteredCtrOpp.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Geen pagina 1 posities gevonden. Voer een ranking check uit in de Rank Tracker.
                  </td>
                </tr>
              )}
              {filteredCtrOpp.map((op, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {op.keyword}
                    {isBrand(op.keyword) && (
                      <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '1px 5px', marginLeft: '6px', opacity: 0.85 }}>
                        Merknaam
                      </span>
                    )}
                  </td>
                  <td>
                    {op.position.startsWith('#') ? (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {op.position}
                      </span>
                    ) : (
                      <span className="badge badge-danger">{op.position}</span>
                    )}
                  </td>
                  <td>{fmtNum(op.impressions)}</td>
                  <td>
                    {op.ctr ? <span className="badge badge-warning">{op.ctr}</span> : '—'}
                  </td>
                  <td>
                    <strong style={{ color: 'var(--primary)' }}>{op.potentialClicks || '—'}</strong>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>{op.targetUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Striking Distance Keywords (Page 2) */}
      <div className="card">
        <h3 className="card-title">
          <ArrowUpRight size={20} color="var(--warning)" /> Striking Distance Zoekwoorden (Pagina 2: #11 - #20)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Zoekwoorden op pagina 2 die met 300 woorden extra verdiepende content & interne links eenvoudig doorstijgen naar pagina 1.
        </p>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Zoekwoord</th>
                <th>Google.nl Positie</th>
                <th>Vertoningen</th>
                <th>Huidige CTR</th>
                <th>Doel URL</th>
              </tr>
            </thead>
            <tbody>
              {filteredStriking.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Geen striking distance zoekwoorden gevonden.
                  </td>
                </tr>
              )}
              {filteredStriking.map((sd, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {sd.keyword}
                    {isBrand(sd.keyword) && (
                      <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '1px 5px', marginLeft: '6px', opacity: 0.85 }}>
                        Merknaam
                      </span>
                    )}
                  </td>
                  <td>
                    {sd.position.startsWith('#') ? (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning)' }}>
                        {sd.position}
                      </span>
                    ) : (
                      <span className="badge badge-danger">{sd.position}</span>
                    )}
                  </td>
                  <td>{fmtNum(sd.impressions)}</td>
                  <td>{sd.ctr || '—'}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>{sd.targetUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan van Aanpak Section */}
      <div className="card">
        <h3 className="card-title">
          <ShieldCheck size={20} color="var(--primary)" /> Plan van Aanpak (op basis van actuele data)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {actionPlan.map((plan, i) => (
            <div key={i} className="rec-card type-opportunity" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{plan.phase}</strong>
                <span className="badge badge-success">{plan.timeframe}</span>
              </div>
              <div className="rec-title" style={{ fontSize: '0.95rem' }}>{plan.title}</div>
              <div className="rec-desc" style={{ fontSize: '0.88rem' }}>{plan.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Prompts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Prompt 1: CTR Boost */}
        <div className="card" style={{ border: '1px solid var(--primary-border)', background: 'var(--primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Sparkles size={18} /> AI Prompt 1: Title & Meta CTR Boost
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Herschrijf Titles & Meta Descriptions om geklik te verdubbelen op Pagina 1.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => handleCopyPrompt(aiPrompts.ctrBoostPrompt, 'ctr')}>
              {copiedCtr ? <Check size={14} /> : <Copy size={14} />} {copiedCtr ? 'Gekopieerd' : 'Kopieer'}
            </button>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '250px', overflowY: 'auto' }}>
            {aiPrompts.ctrBoostPrompt}
          </div>
        </div>

        {/* Prompt 2: Page 2 to Page 1 Jump */}
        <div className="card" style={{ border: '1px solid var(--primary-border)', background: 'var(--primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Sparkles size={18} /> AI Prompt 2: Pagina 2 naar Pagina 1 Stijging
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Genereer 300 woorden verdiepende content & FAQ vragen voor pagina 2 zoekwoorden.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => handleCopyPrompt(aiPrompts.page2JumpPrompt, 'page2')}>
              {copiedPage2 ? <Check size={14} /> : <Copy size={14} />} {copiedPage2 ? 'Gekopieerd' : 'Kopieer'}
            </button>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '250px', overflowY: 'auto' }}>
            {aiPrompts.page2JumpPrompt}
          </div>
        </div>
      </div>
    </div>
  );
}
