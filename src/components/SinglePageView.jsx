import React, { useState, useEffect } from 'react';
import { 
  FileSearch, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Sparkles, 
  ExternalLink, 
  Globe, 
  Code, 
  FileText,
  FileCode,
  ShieldCheck,
  History,
  ArrowRight
} from 'lucide-react';

export default function SinglePageView({ projectId, projectDomain }) {
  const [url, setUrl] = useState(projectDomain ? `${projectDomain.replace(/\/$/, '')}/heftruck-cursus` : 'https://frissestart.nl/heftruck-cursus');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [activeTab, setActiveTab] = useState('issues'); // 'issues', 'prompt', 'inspector', 'history'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/single-page-audits?projectId=${projectId || 1}`);
      const data = await res.json();
      setHistoryList(data);
      if (data.length > 0 && !result) {
        setResult(data[0].full_data);
      }
    } catch (err) {
      console.error('Fout bij ophalen audit historie:', err);
    }
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/analyze-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), projectId: projectId || 1 })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        fetchHistory();
      } else {
        alert(data.error || 'Fout bij analyseren pagina');
      }
    } catch (err) {
      alert('Netwerkfout bij analyseren pagina: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!result?.aiPromptProposal) return;
    navigator.clipboard.writeText(result.aiPromptProposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--primary)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div>
      {/* Search Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <FileSearch size={20} color="var(--primary)" /> Single Page SEO Doctor & AI Prompt Generator
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Voer een specifieke pagina URL in voor een diepgaande audit. Alle uitgevoerde audits worden automatisch **opgeslagen in de historie** om de progressie te volgen.
        </p>

        <form onSubmit={handleAnalyze} className="input-group" style={{ marginBottom: 0 }}>
          <input 
            type="url"
            className="input-field"
            placeholder="https://frissestart.nl/heftruck-cursus"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Analyseren bezig...
              </>
            ) : (
              <>Analyseer Enkele Pagina</>
            )}
          </button>
        </form>
      </div>

      {/* History Summary Strip */}
      {historyList.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={16} color="var(--primary)" />
              <strong style={{ fontSize: '0.9rem' }}>Recent Opgeslagen Audits ({historyList.length}):</strong>
            </div>
            <button className="btn btn-secondary btn-xs" onClick={() => setActiveTab('history')}>
              Bekijk Alle Historierecords <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingTop: '10px' }}>
            {historyList.slice(0, 5).map((item) => (
              <div 
                key={item.id} 
                onClick={() => {
                  setResult(item.full_data);
                  setUrl(item.url);
                }}
                style={{ 
                  padding: '8px 12px', 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="badge badge-success" style={{ background: getScoreColor(item.score), color: '#fff', fontSize: '0.75rem', padding: '2px 6px' }}>
                  {item.score}%
                </span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{item.url.replace(/^https?:\/\/[^\/]+/, '')}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(item.created_at).toLocaleDateString('nl-NL')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Top Score Banner */}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 3fr' }}>
            <div className="stat-card" style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}>
              <div className="stat-header">Pagina SEO Score</div>
              <div className="stat-value" style={{ color: getScoreColor(result.score), fontSize: '3.2rem', margin: '8px 0' }}>
                {result.score}%
              </div>
              <span className={`badge badge-${result.score >= 80 ? 'success' : result.score >= 60 ? 'warning' : 'danger'}`}>
                {result.score >= 80 ? 'Uitstekend' : result.score >= 60 ? 'Matig' : 'Kritiek'}
              </span>
            </div>

            <div className="stat-card" style={{ justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem' }}>Geanalyseerde URL</h3>
                  <a href={result.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                    {result.url} <ExternalLink size={14} />
                  </a>
                </div>
                <span className="badge badge-info">Status: {result.statusCode} OK · {result.loadTimeMs} ms</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Title Lengte:</span>
                  <div><strong>{result.metrics.titleLength} tekens</strong></div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Meta Description:</span>
                  <div><strong>{result.metrics.metaLength} tekens</strong></div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>H1 Aantal:</span>
                  <div><strong>{result.metrics.h1List.length}x H1</strong></div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Woorden Aantal:</span>
                  <div><strong>{result.metrics.wordCount} woorden</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="filter-tabs">
            <button className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`} onClick={() => setActiveTab('issues')}>
              <AlertTriangle size={16} /> Advies & Verbeterpunten ({result.issues.length})
            </button>
            <button className={`tab-btn ${activeTab === 'prompt' ? 'active' : ''}`} onClick={() => setActiveTab('prompt')}>
              <Sparkles size={16} color="var(--primary)" /> Kant-en-klare AI Prompt Voorstel
            </button>
            <button className={`tab-btn ${activeTab === 'inspector' ? 'active' : ''}`} onClick={() => setActiveTab('inspector')}>
              <FileCode size={16} /> Technische Inspector
            </button>
            <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              <History size={16} color="var(--primary)" /> Audit Historie Log ({historyList.length})
            </button>
          </div>

          {/* Tab 1: Issues & Recommendations */}
          {activeTab === 'issues' && (
            <div className="card">
              <h3 className="card-title">
                <ShieldCheck size={20} color="var(--primary)" /> Geconstateerde Punten & Advies
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {result.issues.length === 0 ? (
                  <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    ✓ Geweldig! Er zijn geen kritieke SEO-fouten gevonden op deze pagina.
                  </div>
                ) : (
                  result.issues.map((iss, i) => (
                    <div key={i} className={`rec-card type-${iss.type === 'critical' ? 'critical' : iss.type === 'warning' ? 'warning' : 'opportunity'}`}>
                      <div className="rec-title">
                        {iss.type === 'critical' && <AlertTriangle size={16} color="var(--danger)" />}
                        {iss.type === 'warning' && <AlertTriangle size={16} color="var(--warning)" />}
                        {iss.type === 'opportunity' && <CheckCircle2 size={16} color="var(--primary)" />}
                        {iss.title}
                      </div>
                      <div className="rec-desc">{iss.description}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: AI Prompt Proposal */}
          {activeTab === 'prompt' && (
            <div className="card" style={{ border: '1px solid var(--primary-border)', background: 'var(--primary-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <Sparkles size={20} /> Kant-en-klare AI Prompt Voorstel
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Kopieer deze prompt rechtstreeks naar ChatGPT, Claude of Gemini om deze pagina direct te herschrijven.
                  </p>
                </div>

                <button className="btn btn-primary" onClick={handleCopyPrompt}>
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Gekopieerd!' : 'Kopieer AI Prompt'}
                </button>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-main)', maxHeight: '450px', overflowY: 'auto' }}>
                {result.aiPromptProposal}
              </div>
            </div>
          )}

          {/* Tab 3: Detailed Technical Meta Inspector */}
          {activeTab === 'inspector' && (
            <div className="card">
              <h3 className="card-title">
                <Code size={20} color="var(--primary)" /> Technische Meta Inspector
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div style={{ padding: '14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <strong>Title Tag ({result.metrics.titleLength} tekens):</strong>
                  <div style={{ marginTop: '4px', fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 600 }}>
                    {result.metrics.title || '(Geen Title Tag)'}
                  </div>
                </div>

                <div style={{ padding: '14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <strong>Meta Description ({result.metrics.metaLength} tekens):</strong>
                  <div style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {result.metrics.metaDescription || '(Geen Meta Description)'}
                  </div>
                </div>

                <div style={{ padding: '14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <strong>H1 Kopteksten ({result.metrics.h1List.length}):</strong>
                  <ul style={{ marginTop: '4px', paddingLeft: '20px', fontSize: '0.9rem' }}>
                    {result.metrics.h1List.length > 0 ? (
                      result.metrics.h1List.map((h, i) => <li key={i}>{h}</li>)
                    ) : (
                      <li style={{ color: 'var(--danger)' }}>Geen H1 koptekst aanwezig</li>
                    )}
                  </ul>
                </div>

                <div style={{ padding: '14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <strong>H2 Subkoppen ({result.metrics.h2List.length}):</strong>
                  <ul style={{ marginTop: '4px', paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {result.metrics.h2List.slice(0, 8).map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Audit History Log */}
          {activeTab === 'history' && (
            <div className="card">
              <h3 className="card-title">
                <History size={20} color="var(--primary)" /> Historie van Uitgevoerde Single Page Audits
              </h3>

              <div className="table-container" style={{ marginTop: '16px' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Datum & Tijd</th>
                      <th>Pagina URL</th>
                      <th>Score</th>
                      <th>Verbeterpunten</th>
                      <th>Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.created_at).toLocaleString('nl-NL')}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{h.url}</td>
                        <td>
                          <span className="badge badge-success" style={{ background: getScoreColor(h.score), color: '#fff' }}>
                            {h.score}%
                          </span>
                        </td>
                        <td>{h.issues_count} gevonden</td>
                        <td>
                          <button 
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              setResult(h.full_data);
                              setUrl(h.url);
                              setActiveTab('issues');
                            }}
                          >
                            Herbekijk Audit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
