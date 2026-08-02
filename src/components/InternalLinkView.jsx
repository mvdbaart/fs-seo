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
  Sparkles
} from 'lucide-react';

export default function InternalLinkView({ projectId }) {
  const [data, setData] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

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

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <Network size={20} color="var(--primary)" /> Interne Link Matrix & PageRank Autoriteit Optimizer
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Optimaliseer de interne linkwaarde voor <strong>frissestart.nl</strong>. Sluis autoriteit van populaire pagina's door naar minder goed vindbare landingspagina's en verhoog de rangschikking van je belangrijkste zoekwoorden.
        </p>
      </div>

      {data.message && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(241,139,26,0.06)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{data.message}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-header">Totaal Geanalyseerde Pagina's</div>
          <div className="stat-value">{totalPages}</div>
          <div className="stat-subtext">Crawl link-graph</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Gedetecteerde Weespagina's</div>
          <div className="stat-value" style={{ color: orphanPages.length > 0 ? 'var(--danger)' : 'var(--primary)' }}>
            {orphanPages.length}
          </div>
          <div className="stat-subtext">&le; 1 inkomende link</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Interne Link Kansen</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{recommendations.length}</div>
          <div className="stat-subtext">Geadviseerde ankerteksten</div>
        </div>
      </div>

      {/* Orphan Pages Alert Card */}
      {orphanPages.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={20} /> Gedetecteerde Weespagina's (Orphan Pages)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Deze pagina's ontvangen nauwelijks interne links op frissestart.nl. Google ziet ze daardoor als minder belangrijk en indexeert ze trager.
          </p>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Paginatitel</th>
                  <th>Inkomende Links</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orphanPages.map((op, idx) => (
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
        </div>
      )}

      {/* Recommendations Matrix */}
      <div className="card">
        <h3 className="card-title">
          <Share2 size={20} color="var(--primary)" /> Aanbevolen Interne Links & Ankerteksten (Actionable Matrix)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Voeg onderstaande interne links toe in de tekst van de bronpagina om autoriteit door te sluizen.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {recommendations.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Voer een crawl uit om alle interne linkkansen automatisch te berekenen.
            </div>
          ) : (
            recommendations.map((rec, i) => (
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
