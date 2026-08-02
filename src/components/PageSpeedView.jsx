import React, { useState, useEffect } from 'react';
import { Zap, Smartphone, Monitor, AlertCircle, CheckCircle2, Clock, Cpu } from 'lucide-react';
import AiPromptCanvas from './AiPromptCanvas';

export default function PageSpeedView({ projectId, projectDomain }) {
  const [url, setUrl] = useState(projectDomain || 'https://voorbeeld.nl');
  const [strategy, setStrategy] = useState('mobile');
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);

  useEffect(() => {
    if (projectDomain) setUrl(projectDomain);
    fetchLatestPageSpeedAudit();
  }, [projectId, projectDomain]);

  const fetchLatestPageSpeedAudit = async () => {
    try {
      const res = await fetch(`/api/pagespeed?projectId=${projectId || 1}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setAuditData(data[0]); // Most recent audit
      } else {
        setAuditData(null);
      }
    } catch (err) {
      console.error('Fout bij ophalen PageSpeed data:', err);
    }
  };

  const handleRunAudit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/pagespeed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId || 1, url, strategy })
      });
      
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error('De server stuurde geen geldige JSON (mogelijk een netwerk- of proxytimeout van 90 seconden).');
      }

      if (!res.ok) {
        alert(data.error || 'PageSpeed audit mislukt');
        return;
      }
      setAuditData(data);
    } catch (err) {
      alert('Fout bij uitvoeren PageSpeed audit: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--primary)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div>
      {/* Search/Form Banner */}
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="var(--warning)" /> Google PageSpeed Insights API Audit
          </span>

          {auditData && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} /> Opslagen geladen van: {new Date(auditData.created_at).toLocaleString('nl-NL')}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Analyseer de werkelijke laadsnelheid, mobiele ervaring en Core Web Vitals van Google.
        </p>

        <form onSubmit={handleRunAudit} className="input-group" style={{ marginBottom: 0 }}>
          <input 
            type="url"
            className="input-field"
            placeholder="https://jouwwebsite.nl/pagina"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button 
              type="button" 
              className={`btn ${strategy === 'mobile' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => setStrategy('mobile')}
            >
              <Smartphone size={14} /> Mobiel
            </button>
            <button 
              type="button"
              className={`btn ${strategy === 'desktop' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => setStrategy('desktop')}
            >
              <Monitor size={14} /> Desktop
            </button>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Analyse bezig (10-15s)...' : 'Start PageSpeed Meting'}
          </button>
        </form>
      </div>

      {/* Results View */}
      {auditData ? (
        <>
          {/* Main 4 Scores */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div className="stat-header">Performance</div>
              <div className="stat-value" style={{ color: getScoreColor(auditData.performance_score), fontSize: '2.8rem' }}>
                {auditData.performance_score}
              </div>
              <div className="stat-subtext">Prestatiescore</div>
            </div>

            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div className="stat-header">Toegankelijkheid</div>
              <div className="stat-value" style={{ color: getScoreColor(auditData.accessibility_score), fontSize: '2.8rem' }}>
                {auditData.accessibility_score}
              </div>
              <div className="stat-subtext">Accessibility</div>
            </div>

            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div className="stat-header">Best Practices</div>
              <div className="stat-value" style={{ color: getScoreColor(auditData.best_practices_score), fontSize: '2.8rem' }}>
                {auditData.best_practices_score}
              </div>
              <div className="stat-subtext">Ontwikkelstandaarden</div>
            </div>

            <div className="stat-card" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div className="stat-header">SEO Score</div>
              <div className="stat-value" style={{ color: getScoreColor(auditData.seo_score), fontSize: '2.8rem' }}>
                {auditData.seo_score}
              </div>
              <div className="stat-subtext">Technische SEO</div>
            </div>
          </div>

          {/* Core Web Vitals Breakdown */}
          <div className="card">
            <h3 className="card-title">
              <Clock size={18} color="var(--primary)" /> Core Web Vitals (Google Rangschikkingsfactoren)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>LCP (Grootste Content Weergave)</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{auditData.lcp}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Doel: &lt; 2.5 seconden</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CLS (Layout Verschuiving)</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{auditData.cls}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Doel: &lt; 0.10</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>INP / FID (Interactiviteit)</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>{auditData.inp}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Doel: &lt; 200 ms</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FCP (Eerste Content Weergave)</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{auditData.fcp}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Doel: &lt; 1.8 seconden</div>
              </div>
            </div>
          </div>

          {/* Diagnostic Opportunities */}
          {(() => {
            const diagnosticsList = Array.isArray(auditData.diagnostics)
              ? auditData.diagnostics
              : (typeof auditData.diagnostics === 'string' ? JSON.parse(auditData.diagnostics || '[]') : []);

            return (
              <div className="card">
                <h3 className="card-title">
                  <Cpu size={18} color="var(--primary)" /> Aanbevolen Snelheidsoptimalisaties
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {diagnosticsList.length > 0 ? (
                    diagnosticsList.map((diag, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--warning)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{diag.title}</strong>
                          <span className="badge badge-warning">{diag.displayValue || 'Optimaliseerbaar'}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{diag.description}</p>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      ✓ Er zijn geen grote vertragende elementen gevonden op deze pagina.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <AiPromptCanvas
            title="AI Prompt: PageSpeed & Core Web Vitals Optimalisatie"
            promptText={`Je bent een Senior Frontend & Web Performance Engineer. Hier zijn de live Google PageSpeed Insights resultaten voor ${url} (${strategy}):\n\n- Performance Score: ${auditData.performance_score}/100\n- LCP (Largest Contentful Paint): ${auditData.lcp}\n- CLS (Cumulative Layout Shift): ${auditData.cls}\n- INP / FID: ${auditData.inp}\n- FCP: ${auditData.fcp}\n\nBelangrijkste vertragingsdiagnoses:\n${(Array.isArray(auditData.diagnostics) ? auditData.diagnostics : JSON.parse(auditData.diagnostics || '[]')).map(d => `- ${d.title}: ${d.description}`).join('\n')}\n\nOpdracht:\n1. Geef concrete codevoorbeelden (CSS/HTML/JS) om de LCP en CLS scores op deze pagina direct te verbeteren.\n2. Geef aan welke afbeeldingen of scripts uitgesteld (deferred/async) moeten worden.\n3. Schrijf een stappenplan voor caching en resource inladen.`}
          />
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Zap size={40} color="var(--warning)" style={{ marginBottom: '12px', opacity: 0.8 }} />
          <h3>Nog geen PageSpeed meting uitgevoerd</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', marginBottom: '16px' }}>
            Klik op <strong>Start PageSpeed Meting</strong> hierboven om de live laadsnelheid van {projectDomain || 'je website'} te analyseren.
          </p>
        </div>
      )}
    </div>
  );
}
