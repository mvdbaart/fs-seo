import React, { useState, useEffect } from 'react';
import { 
  Network, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  Check, 
  Globe, 
  Share2, 
  ExternalLink,
  Sparkles,
  Filter,
  Code,
  Briefcase
} from 'lucide-react';

export default function InternalLinkView({ projectId, onNavigateTab }) {
  const [data, setData] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [pageTypeFilter, setPageTypeFilter] = useState('content_only'); // 'content_only', 'all', 'vacancies', 'contact'
  const [customExclude, setCustomExclude] = useState('');

  useEffect(() => {
    fetchInternalLinks();
  }, [projectId]);

  const fetchInternalLinks = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/internal-links`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  const copyLinkInstruction = (rec, index) => {
    const text = `Plaats een interne link op de pagina: ${rec.fromUrl}\nNaar doelpagina: ${rec.toUrl}\nGebruik de ankertekst: "${rec.anchorText}"`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  if (!data) return <div className="card">Laden van Interne Link Matrix...</div>;

  const { totalPages, orphanPages, recommendations } = data;

  const isUtilityUrl = (url) => {
    const lower = (url || '').toLowerCase();
    if (customExclude && customExclude.trim()) {
      const terms = customExclude.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (terms.some(t => lower.includes(t))) return true;
    }
    return lower.includes('/vacatures/') || 
           lower.includes('/aanmelden') || 
           lower.includes('/contact') || 
           lower.includes('/privacy') || 
           lower.includes('voorwaarden');
  };

  const filteredOrphanPages = (orphanPages || []).filter(op => {
    if (pageTypeFilter === 'content_only') return !isUtilityUrl(op.url);
    if (pageTypeFilter === 'vacancies') return op.url.toLowerCase().includes('/vacatures/');
    if (pageTypeFilter === 'contact') return op.url.toLowerCase().includes('/contact') || op.url.toLowerCase().includes('/aanmelden');
    return true;
  });

  const filteredRecommendations = (recommendations || []).filter(rec => {
    if (pageTypeFilter === 'content_only') return !isUtilityUrl(rec.toUrl);
    if (pageTypeFilter === 'vacancies') return rec.toUrl.toLowerCase().includes('/vacatures/');
    if (pageTypeFilter === 'contact') return rec.toUrl.toLowerCase().includes('/contact') || rec.toUrl.toLowerCase().includes('/aanmelden');
    return true;
  });

  const excludedCount = (orphanPages || []).length - filteredOrphanPages.length;

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <Network size={20} color="var(--primary)" /> Interne Link Matrix & PageRank Autoriteit Optimizer
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Optimaliseer de interne linkstructuur en autoriteit voor <strong>frissestart.nl</strong>. Sluis autoriteit door naar belangrijke landingspagina's en diensten om zoekwoordposities te versterken.
        </p>
      </div>

      {data.message && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(241,139,26,0.06)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{data.message}</p>
        </div>
      )}

      {/* Vacancy & Contact Schema Notice Card */}
      <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--text-main)' }}>
              <Briefcase size={18} color="var(--primary)" /> Vacature- & Contactpagina's & Schema.org JSON-LD
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Voor vacatures en contactpagina's is interne linkkracht secundair. <strong>Schema Markup</strong> is hier het belangrijkst: met valide <code>JobPosting</code> JSON-LD verschijnen vacatures gratis in <strong>Google Jobs</strong> en krijgen contactpagina's <code>ContactPoint</code> Rich Snippets.
            </p>
          </div>

          {onNavigateTab && (
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => onNavigateTab('schemagen')}>
              <Code size={14} color="var(--primary)" /> Open Schema.org Generator
            </button>
          )}
        </div>
      </div>

      {/* Page Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          <button 
            className={`tab-btn ${pageTypeFilter === 'content_only' ? 'active' : ''}`}
            onClick={() => setPageTypeFilter('content_only')}
            title="Verberg vacatures, contact en aanmeldpagina's"
          >
            <Filter size={14} style={{ marginRight: '4px' }} /> Landings- & Contentpagina's ({ (orphanPages || []).filter(p => !isUtilityUrl(p.url)).length })
          </button>

          <button 
            className={`tab-btn ${pageTypeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPageTypeFilter('all')}
          >
            Alle Pagina's ({totalPages})
          </button>

          <button 
            className={`tab-btn ${pageTypeFilter === 'vacancies' ? 'active' : ''}`}
            onClick={() => setPageTypeFilter('vacancies')}
          >
            Alleen Vacatures ({ (orphanPages || []).filter(p => p.url.toLowerCase().includes('/vacatures/')).length })
          </button>

          <button 
            className={`tab-btn ${pageTypeFilter === 'contact' ? 'active' : ''}`}
            onClick={() => setPageTypeFilter('contact')}
          >
            Contact & Systeem ({ (orphanPages || []).filter(p => isUtilityUrl(p.url) && !p.url.toLowerCase().includes('/vacatures/')).length })
          </button>
        </div>

        <div style={{ width: '220px' }}>
          <input 
            type="text"
            className="input-field"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            placeholder="Extra uitsluiten (bijv. /blog)..."
            value={customExclude}
            onChange={(e) => setCustomExclude(e.target.value)}
          />
        </div>
      </div>

      {pageTypeFilter === 'content_only' && excludedCount > 0 && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', padding: '6px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          ℹ️ Filter actief: <strong>{excludedCount} vacatures & contactpagina's</strong> zijn verborgen om te focussen op echte SEO landingspagina's.
        </div>
      )}

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-header">Geanalyseerd (Gefilterd)</div>
          <div className="stat-value">{pageTypeFilter === 'content_only' ? totalPages - excludedCount : totalPages}</div>
          <div className="stat-subtext">{pageTypeFilter === 'content_only' ? 'Content & Landingspagina\'s' : 'Alle gecrawlde pagina\'s'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Gedetecteerde Weespagina's</div>
          <div className="stat-value" style={{ color: filteredOrphanPages.length > 0 ? 'var(--danger)' : 'var(--primary)' }}>
            {filteredOrphanPages.length}
          </div>
          <div className="stat-subtext">&le; 1 inkomende link</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Interne Link Kansen</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{filteredRecommendations.length}</div>
          <div className="stat-subtext">Geadviseerde ankerteksten</div>
        </div>
      </div>

      {/* Orphan Pages Alert Card */}
      <div className="card">
        <h3 className="card-title" style={{ color: filteredOrphanPages.length > 0 ? 'var(--danger)' : 'var(--primary)' }}>
          <AlertTriangle size={20} /> Gedetecteerde Weespagina's (Orphan Pages) ({filteredOrphanPages.length})
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          {pageTypeFilter === 'content_only' 
            ? "Belangrijke landingspagina's en content die nauwelijks interne links ontvangen op frissestart.nl."
            : "Pagina's die nauwelijks interne links ontvangen op frissestart.nl."}
        </p>

        {filteredOrphanPages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            <CheckCircle2 size={32} color="var(--success)" style={{ marginBottom: '8px' }} />
            <div>Geen weespagina's gevonden voor het geselecteerde filter! Alle contentpagina's worden goed gelinkt.</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table wrap-text">
              <thead>
                <tr>
                  <th style={{ minWidth: '260px' }}>URL</th>
                  <th style={{ minWidth: '220px' }}>Paginatitel</th>
                  <th>Inkomende Links</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrphanPages.map((op, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      <a href={op.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {op.url} <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>{op.title || '(Geen titel)'}</td>
                    <td><strong style={{ color: 'var(--danger)' }}>{op.links_internal_count || 0} inkomend</strong></td>
                    <td><span className="badge badge-danger">Weespagina</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recommendations Matrix */}
      <div className="card">
        <h3 className="card-title">
          <Share2 size={20} color="var(--primary)" /> Aanbevolen Interne Links & Ankerteksten ({filteredRecommendations.length})
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Voeg onderstaande interne links toe in de tekst van de bronpagina om autoriteit door te sluizen.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredRecommendations.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '16px 0', textAlign: 'center' }}>
              Geen linkaanbevelingen voor het geselecteerde filter.
            </div>
          ) : (
            filteredRecommendations.map((rec, i) => (
              <div key={i} className="rec-card type-opportunity" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, marginRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span className={`badge badge-${rec.priority === 'Kritiek' ? 'danger' : rec.priority === 'Hoog' ? 'warning' : 'success'}`}>
                      Prioriteit: {rec.priority || 'Normaal'}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bron: <strong style={{ color: 'var(--text-main)' }}>{rec.fromUrl}</strong></span>
                    <ArrowRight size={14} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Doel: <strong>{rec.toUrl}</strong></span>
                  </div>

                  <div style={{ marginBottom: '6px', fontSize: '0.95rem' }}>
                    <strong>Aanbevolen Ankertekst:</strong> <span className="badge badge-success" style={{ fontSize: '0.9rem', padding: '4px 10px' }}>"{rec.anchorText}"</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {rec.reason}
                  </div>
                </div>

                <button className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={() => copyLinkInstruction(rec, i)}>
                  {copiedIndex === i ? <Check size={14} color="var(--primary)" /> : <Copy size={14} />} 
                  {copiedIndex === i ? 'Instructie Gekopieerd' : 'Kopieer Link Instructie'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
