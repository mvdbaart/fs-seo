import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  Globe, Layers, FileSearch, Zap, AlertCircle, Info, Briefcase
} from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  correct:      { label: 'Correct',      icon: CheckCircle2,  color: 'var(--success)',  bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)' },
  warning:      { label: 'Waarschuwing', icon: AlertTriangle, color: '#f59e0b',          bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  missing:      { label: 'Ontbreekt',   icon: XCircle,        color: '#ef4444',          bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)' },
  'fetch-error':{ label: 'Fetch Error', icon: AlertCircle,    color: '#8b5cf6',          bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
};

const PRIORITY_CONFIG = {
  'Kritiek':    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  'Hoog':       { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  'Aanbevolen': { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  'Optioneel':  { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
  'Goed':       { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
};

function StatusBadge({ status, small }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: small ? '2px 8px' : '4px 10px',
      borderRadius: '20px',
      fontSize: small ? '0.72rem' : '0.8rem',
      fontWeight: 600,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      whiteSpace: 'nowrap'
    }}>
      <Icon size={small ? 11 : 13} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['Optioneel'];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '20px',
      fontSize: '0.72rem',
      fontWeight: 700,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color
    }}>
      {priority}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, value, label, color, bg }) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      background: bg || 'var(--bg-card)',
      border: `1px solid ${color}33`,
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={20} color={color} />
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</span>
      </div>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function SchemaTypeGrid({ schemaTypeSummary }) {
  const typeDescriptions = {
    LocalBusiness:  'Bedrijfsgegevens voor Google Knowledge Panel',
    Organization:   'Organisatie-informatie & logo',
    WebSite:        'Websitestructuur & sitelinks zoekbox',
    Service:        'Diensten voor rich snippets',
    FAQPage:        'FAQ accordeon in zoekresultaten',
    BreadcrumbList: 'Breadcrumb navigatie in Google',
    JobPosting:     'Vacatures in Google Jobs',
    Course:         'Opleidingen & cursussen rich snippets',
    Article:        'Artikelen / nieuws schema',
    BlogPosting:    'Blogpost schema',
    ContactPoint:   'Contactgegevens & telefoonnummer',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
      {schemaTypeSummary.map(item => {
        const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.missing;
        const Icon = cfg.icon;
        return (
          <div key={item.type} style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{item.type}</div>
              <Icon size={16} color={cfg.color} style={{ flexShrink: 0 }} />
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              {typeDescriptions[item.type] || ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.type === 'JobPosting' ? (
                <span style={{ fontSize: '0.78rem', color: cfg.color, fontWeight: 600 }}>
                  {item.pagesFound > 0
                    ? `${item.validCount} / ${item.pagesFound} vacature(s) geldig & compleet`
                    : '0 vacatures met JobPosting schema gevonden'
                  }
                </span>
              ) : item.pagesNeeded > 0 ? (
                <div>
                  <span style={{ fontSize: '0.78rem', color: cfg.color, fontWeight: 600 }}>
                    {Math.min(item.pagesFound, item.pagesNeeded)} / {item.pagesNeeded} vereiste pagina's
                  </span>
                  {item.pagesFound > item.pagesNeeded && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      (Aanwezig op {item.pagesFound} pagina's)
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: '0.78rem', color: cfg.color, fontWeight: 600 }}>
                  Gevonden op {item.pagesFound} pagina's
                </span>
              )}

              {item.status === 'correct' && (
                <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>✓ Volledig goedgekeurd</span>
              )}
              {item.status === 'missing' && (
                <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>Niet gevonden op vereiste pagina's</span>
              )}
              {item.status === 'warning' && (
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>Aandachtspunt</span>
              )}
              {item.status === 'info' && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Optioneel op gescande pagina's</span>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}

function PageRow({ page }) {
  const [expanded, setExpanded] = useState(false);
  const shortUrl = page.url.replace(/^https?:\/\/[^/]+/, '') || '/';

  return (
    <>
      <tr
        style={{ cursor: 'pointer', transition: 'background 0.15s' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        <td style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }} title={page.url}>
              {shortUrl}
            </span>
          </div>
          {page.title && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 20, marginTop: 2 }}>{page.title}</div>}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <PriorityBadge priority={page.priority} />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{page.pageType}</div>
        </td>
        <td style={{ padding: '10px 12px' }}>
          {page.foundTypes.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {page.foundTypes.map(t => (
                <span key={t} style={{
                  fontSize: '0.72rem', padding: '2px 7px', borderRadius: 12,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10b981', fontWeight: 600
                }}>{t}</span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Geen schema's</span>
          )}
        </td>
        <td style={{ padding: '10px 12px' }}>
          {page.missingExpected.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {page.missingExpected.map(t => (
                <span key={t} style={{
                  fontSize: '0.72rem', padding: '2px 7px', borderRadius: 12,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontWeight: 600
                }}>{t}</span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', color: '#10b981' }}>✓ Volledig</span>
          )}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <StatusBadge status={page.status} small />
        </td>
      </tr>

      {/* Uitklap detail rij */}
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: 0 }}>
            <div style={{
              background: 'var(--bg-hover)',
              borderTop: '1px dashed var(--border-color)',
              borderBottom: '1px dashed var(--border-color)',
              padding: '14px 32px'
            }}>
              {page.fetchError && (
                <div style={{ color: '#8b5cf6', fontSize: '0.82rem', marginBottom: 10 }}>
                  ⚠️ <strong>Fetch fout:</strong> {page.fetchError}
                </div>
              )}
              {page.parseErrors > 0 && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 10 }}>
                  🔴 <strong>{page.parseErrors} JSON-LD blok(ken) met syntaxfout</strong> — controleer de schema-code op deze pagina
                </div>
              )}
              {page.validatedSchemas.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {page.validatedSchemas.map((s, i) => (
                    <div key={i} style={{
                      background: s.valid ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
                      border: `1px solid ${s.valid ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: s.warnings.length > 0 ? 8 : 0 }}>
                        {s.valid
                          ? <CheckCircle2 size={14} color="#10b981" />
                          : <AlertTriangle size={14} color="#f59e0b" />
                        }
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          {s.type}
                        </span>
                        {s.valid && <span style={{ fontSize: '0.75rem', color: '#10b981' }}>— Alle verplichte velden aanwezig</span>}
                      </div>
                      {s.warnings.length > 0 && (
                        <ul style={{ margin: '6px 0 0 22px', padding: 0, listStyle: 'disc' }}>
                          {s.warnings.map((w, wi) => (
                            <li key={wi} style={{
                              fontSize: '0.78rem',
                              color: w.startsWith('Verplicht') ? '#ef4444' : '#f59e0b',
                              marginBottom: 3
                            }}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : !page.fetchError ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Geen JSON-LD schema's gevonden op deze pagina.
                </div>
              ) : null}

              <a
                href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(page.url)}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--primary)', marginTop: 12, textDecoration: 'none' }}
              >
                <ExternalLink size={12} /> Google Rich Results Test →
              </a>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SchemaGeneratorView({ projectId }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overzicht');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/schema-audit`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setAudit(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  // ── Loading state ──
  if (loading && !audit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
        <RefreshCw size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Pagina's scannen op schema's... Dit kan even duren.
        </p>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="card" style={{ borderColor: '#ef4444', background: 'rgba(239,68,68,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', marginBottom: 12 }}>
          <XCircle size={20} /> <strong>Fout bij laden van audit</strong>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 16 }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchAudit}>Opnieuw proberen</button>
      </div>
    );
  }

  if (!audit) return null;

  // ── No crawl data state ──
  if (audit.noCrawlData) {
    return (
      <div>
        <HeaderBanner onRefresh={fetchAudit} loading={loading} />
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', borderColor: 'var(--border-color)' }}>
          <Globe size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8, color: 'var(--text-main)' }}>Geen crawl-data beschikbaar</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 480, margin: '0 auto 24px' }}>
            {audit.message}
          </p>
          <a href="#crawler" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary">
              <FileSearch size={15} /> Ga naar On-Page Crawler
            </button>
          </a>
        </div>
      </div>
    );
  }

  const { summary, schemaTypeSummary, pageResults, priorityAdvice, lastCrawlDate } = audit;

  const filteredPages = filterStatus === 'all'
    ? pageResults
    : pageResults.filter(p => p.status === filterStatus);

  const scorePercent = summary.totalPages > 0
    ? Math.round((summary.correct / summary.totalPages) * 100)
    : 0;

  const scoreColor = scorePercent >= 80 ? '#10b981' : scorePercent >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .audit-table tr { animation: slideIn 0.2s ease; }
        .audit-table td { border-bottom: 1px solid var(--border-color); vertical-align: top; }
        .audit-table th { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; border-bottom: 2px solid var(--border-color); text-align: left; }
      `}</style>

      {/* ── Header ── */}
      <HeaderBanner onRefresh={fetchAudit} loading={loading} lastCrawlDate={lastCrawlDate} />

      {/* ── Score + Samenvatting ── */}
      <div className="card" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Score cirkel */}
        <div style={{
          width: 100, height: 100, flexShrink: 0,
          borderRadius: '50%',
          background: `conic-gradient(${scoreColor} ${scorePercent * 3.6}deg, var(--border-color) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            background: 'var(--bg-card)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{scorePercent}%</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCORE</span>
          </div>
        </div>

        {/* Kaarten */}
        <div style={{ display: 'flex', gap: 12, flex: 1, flexWrap: 'wrap' }}>
          <SummaryCard icon={CheckCircle2} value={summary.correct}    label="Correct geïmplementeerd" color="#10b981" bg="rgba(16,185,129,0.05)" />
          <SummaryCard icon={XCircle}      value={summary.missing}    label="Ontbrekende schema's"     color="#ef4444" bg="rgba(239,68,68,0.05)" />
          <SummaryCard icon={AlertTriangle} value={summary.warnings}  label="Waarschuwingen"           color="#f59e0b" bg="rgba(245,158,11,0.05)" />
          <SummaryCard icon={Briefcase}    value={`${summary.jobPostings?.valid || 0} / ${summary.jobPostings?.total || 0}`} label="Geldige Vacatures (Google Jobs)" color="#8b5cf6" bg="rgba(139,92,246,0.05)" />
          <SummaryCard icon={Layers}       value={summary.totalPages} label="Pagina's geanalyseerd"    color="var(--primary)" bg="var(--primary-light)" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="filter-tabs">
        {[
          { id: 'overzicht',  label: 'Schema-types Overzicht' },
          { id: 'paginas',    label: `Pagina Details (${pageResults.length})` },
          { id: 'advies',     label: `Prioriteitsadvies (${priorityAdvice.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Schema-types Overzicht ── */}
      {activeTab === 'overzicht' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>
            <ShieldCheck size={18} color="var(--primary)" />
            Schema-types Overzicht
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Per schema-type: hoeveel pagina's het hebben versus hoeveel er het nodig hebben, inclusief validatiestatus.
          </p>
          <SchemaTypeGrid schemaTypeSummary={schemaTypeSummary} />
        </div>
      )}

      {/* ── Tab: Pagina Details ── */}
      {activeTab === 'paginas' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Filter bar */}
          <div style={{
            display: 'flex', gap: 8, padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            flexWrap: 'wrap', alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
            {[
              { value: 'all',         label: `Alle (${pageResults.length})` },
              { value: 'correct',     label: `✅ Correct (${summary.correct})` },
              { value: 'missing',     label: `❌ Ontbreekt (${summary.missing})` },
              { value: 'warning',     label: `⚠️ Waarschuwing (${summary.warnings})` },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                  border: filterStatus === f.value ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: filterStatus === f.value ? 'var(--primary-light)' : 'transparent',
                  color: filterStatus === f.value ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="audit-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>URL / Titel</th>
                  <th>Paginatype</th>
                  <th>Gevonden Schema's</th>
                  <th>Ontbrekende Schema's</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Geen pagina's voor dit filter
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((page, i) => <PageRow key={i} page={page} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Prioriteitsadvies ── */}
      {activeTab === 'advies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {priorityAdvice.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <CheckCircle2 size={40} color="#10b981" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)' }}>Geen verbeterpunten gevonden.</p>
            </div>
          ) : (
            priorityAdvice.map((advice, i) => {
              const cfg = PRIORITY_CONFIG[advice.priority] || PRIORITY_CONFIG['Optioneel'];
              return (
                <div key={i} className="card" style={{
                  border: `1px solid ${cfg.border}`,
                  background: cfg.bg,
                  animation: 'slideIn 0.25s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: '1.1rem' }}>{advice.icon}</span>
                        <PriorityBadge priority={advice.priority} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          {advice.title}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0 34px', lineHeight: 1.6 }}>
                        {advice.description}
                      </p>
                      {advice.affectedUrl && (
                        <div style={{ margin: '8px 0 0 34px' }}>
                          <a
                            href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(advice.affectedUrl)}`}
                            target="_blank" rel="noreferrer"
                            style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Zap size={11} /> Test in Google Rich Results Tool →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Tip onderaan */}
          <div className="card" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: '#3b82f6' }}>Tip:</strong> Valideer altijd gewijzigde schema's via de{' '}
              <a href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                Google Rich Results Test
              </a>{' '}
              en{' '}
              <a href="https://validator.schema.org/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                Schema.org Validator
              </a>.
              Na implementatie duurt het gemiddeld 1-2 weken voordat Google de rich snippets toont.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderBanner({ onRefresh, loading, lastCrawlDate }) {
  return (
    <div className="card" style={{
      background: 'linear-gradient(135deg, rgba(5,150,105,0.07), rgba(59,130,246,0.05))',
      borderColor: 'var(--primary-border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
    }}>
      <div>
        <div className="card-title" style={{ marginBottom: 4 }}>
          <ShieldCheck size={20} color="var(--primary)" />
          Schema.org Audit — Implementatiecheck
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
          Detecteert automatisch welke JSON-LD schema's aanwezig zijn, valideert verplichte velden en toont wat er ontbreekt.
        </p>
        {lastCrawlDate && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: '6px 0 0' }}>
            Gebaseerd op crawl van: {new Date(lastCrawlDate).toLocaleString('nl-NL')}
          </p>
        )}
      </div>
      <button
        className="btn btn-primary"
        onClick={onRefresh}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        {loading ? 'Scannen...' : 'Opnieuw scannen'}
      </button>
    </div>
  );
}
