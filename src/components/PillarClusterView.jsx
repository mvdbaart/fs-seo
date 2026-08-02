import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ExternalLink,
  Sparkles,
  Link2,
  Unlink,
  Target,
  BookOpen
} from 'lucide-react';

export default function PillarClusterView({ projectId }) {
  const [data, setData] = useState(null);
  const [activeClusterId, setActiveClusterId] = useState(null);

  // Custom Cluster Form Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPillarUrl, setNewPillarUrl] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClusters();
  }, [projectId]);

  const fetchClusters = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/topic-clusters`);
      const result = await res.json();
      setData(result);
      if (result.clusters && result.clusters.length > 0) {
        if (!activeClusterId || !result.clusters.some(c => c.id === activeClusterId)) {
          setActiveClusterId(result.clusters[0].id);
        }
      }
    } catch (err) {
      console.error('Fout bij laden van Topic Clusters:', err);
    }
  };

  const handleAddCluster = async (e) => {
    e.preventDefault();
    if (!newTitle || !newPillarUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/topic-clusters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          pillarUrl: newPillarUrl,
          keywords: newKeywords
        })
      });
      if (res.ok) {
        setNewTitle('');
        setNewPillarUrl('');
        setNewKeywords('');
        setShowAddModal(false);
        await fetchClusters();
      } else {
        const errData = await res.json();
        alert('Fout bij toevoegen: ' + (errData.error || 'Onbekende fout'));
      }
    } catch (err) {
      alert('Fout bij toevoegen: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCluster = async (dbId) => {
    if (!window.confirm('Weet je zeker dat je deze eigen Pillar Page wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/topic-clusters/${dbId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchClusters();
      }
    } catch (err) {
      alert('Fout bij verwijderen: ' + err.message);
    }
  };

  if (!data) return <div className="card">Laden van Topic Clusters & Pillar Page Analyzer...</div>;

  const { clusters, totalContentPages, summary } = data;
  const currentCluster = clusters.find(c => c.id === activeClusterId) || clusters[0];

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(5,150,105,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="var(--primary)" /> Topic Cluster & Pillar Page Analyzer
          </span>
          <button 
            className="btn btn-primary" 
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            onClick={() => setShowAddModal(!showAddModal)}
          >
            {showAddModal ? 'Annuleren' : '+ Pillar Page Toevoegen'}
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
          Analyseer de thematische opbouw en interne autoriteitsstructuur van <strong>frissestart.nl</strong>. Koppel sub-artikelen (Spokes) aan centrale gids-pagina's (Pillars) om topical authority in Google op te bouwen.
        </p>

        {/* Modal / Form to add custom Pillar Page */}
        {showAddModal && (
          <form onSubmit={handleAddCluster} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-main)' }}>
              Eigen Pillar Page & Topic Cluster Toevoegen
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Titel / Thema (bijv. Certificeringsbeheer) *
                </label>
                <input 
                  type="text"
                  className="input-field"
                  placeholder="bijv. Certificeringsbeheer & Bedrijfsopleidingen"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Pillar Page URL of Pad *
                </label>
                <input 
                  type="text"
                  className="input-field"
                  placeholder="https://frissestart.nl/opleidingen/certificeringsbeheer"
                  value={newPillarUrl}
                  onChange={e => setNewPillarUrl(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Zoekwoorden voor herkenning van Sub-pagina's (gescheiden door komma's)
              </label>
              <input 
                type="text"
                className="input-field"
                placeholder="certificeringsbeheer, certificering, soob, nascholing beheer, hercertificering"
                value={newKeywords}
                onChange={e => setNewKeywords(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Opslaan...' : 'Opslaan & Cluster Aanmaken'}
            </button>
          </form>
        )}
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-header">Geanalyseerde Content Pagina's</div>
          <div className="stat-value">{totalContentPages}</div>
          <div className="stat-subtext">Geen vacatures/utility</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Gedetecteerde Topic Clusters</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{summary.totalClusters}</div>
          <div className="stat-subtext">Hoofdthema's & Pillars</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Gem. Cluster Health Score</div>
          <div className="stat-value" style={{ color: summary.avgHealthScore >= 70 ? 'var(--success)' : 'var(--warning)' }}>
            {summary.avgHealthScore}%
          </div>
          <div className="stat-subtext">Link & contentdekking</div>
        </div>
      </div>

      {/* Cluster Selector Tabs */}
      <div className="filter-tabs" style={{ marginBottom: '20px' }}>
        {clusters.map(cluster => (
          <button
            key={cluster.id}
            className={`tab-btn ${activeClusterId === cluster.id ? 'active' : ''}`}
            onClick={() => setActiveClusterId(cluster.id)}
          >
            {cluster.title} ({cluster.stats.totalSpokes} spokes)
          </button>
        ))}
      </div>

      {currentCluster && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pillar Card Header */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: '8px', fontSize: '0.75rem' }}>
                  CENTRE PILLAR PAGE
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', margin: 0 }}>
                    {currentCluster.title}
                  </h3>
                  {currentCluster.isCustom && (
                    <button 
                      className="btn btn-danger" 
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleDeleteCluster(currentCluster.dbId)}
                    >
                      Verwijderen
                    </button>
                  )}
                </div>
                {currentCluster.pillarPage ? (
                  <div style={{ marginTop: '6px' }}>
                    <a href={currentCluster.pillarPage.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {currentCluster.pillarPage.url} <ExternalLink size={14} />
                    </a>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Titel: {currentCluster.pillarPage.title || '(Geen titel)'} &bull; Woorden: {currentCluster.pillarPage.wordCount} &bull; Inkomende links: {currentCluster.pillarPage.inboundLinks}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--warning)', fontSize: '0.9rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} /> Nog geen specifieke Pillar Page gevonden voor dit cluster! Maak een centrale gids-pagina aan.
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right', minWidth: '180px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cluster Health Score</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: currentCluster.stats.healthScore >= 75 ? 'var(--success)' : 'var(--warning)' }}>
                  {currentCluster.stats.healthScore}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Interne linkdekking: {currentCluster.stats.interconnectedness}%
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <strong>Gekoppelde Zoekwoorden ({currentCluster.keywords.length}):</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {currentCluster.keywords.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Geen directe zoekwoorden in Rank Tracker voor dit cluster.</span>
                ) : (
                  currentCluster.keywords.map((k, i) => (
                    <span key={i} className="badge badge-secondary" style={{ fontSize: '0.78rem' }}>
                      {k.keyword} {k.position ? `(#${k.position})` : ''}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Spoke Pages Table */}
          <div className="card">
            <h3 className="card-title">
              <BookOpen size={18} color="var(--primary)" /> Cluster Sub-pagina's & Artikelen (Spoke Pages: {currentCluster.spokes.length})
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Sub-artikelen en regiopagina's die tot dit thema behoren. Zorg dat elke spoke-pagina teruglinkt naar de centrale Pillar Page.
            </p>

            {currentCluster.spokes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
                Geen specifieke sub-pagina's gedetecteerd voor dit cluster.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table wrap-text">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '240px' }}>Sub-pagina (Spoke URL)</th>
                      <th style={{ minWidth: '200px' }}>Titel</th>
                      <th>Woorden</th>
                      <th>Inkomende Links</th>
                      <th>Linkt naar Pillar?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCluster.spokes.map((spoke, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500, color: 'var(--primary)' }}>
                          <a href={spoke.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {spoke.url} <ExternalLink size={12} />
                          </a>
                        </td>
                        <td>{spoke.title || '-'}</td>
                        <td>{spoke.wordCount}</td>
                        <td>{spoke.inboundLinks} links</td>
                        <td>
                          {spoke.spokeLinksToPillar ? (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Link2 size={12} /> Gelinkt
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Unlink size={12} /> Ontbreekt
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Recommendations Card */}
          <div className="card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
              <Sparkles size={18} /> Actieplan voor dit Topic Cluster
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
              <li>
                Plaats in alle {currentCluster.spokes.filter(s => !s.spokeLinksToPillar).length} niet-gelinkte sub-pagina's een interne link naar de Pillar Page (<code>{currentCluster.pillarPage?.url || 'Pillar URL'}</code>).
              </li>
              <li>
                Voeg meer regio-specifieke landingspagina's toe (bijv. <em>Code 95 Helmond</em> of <em>Heftruckcursus Nuenen</em>) om topical authority in de regio uit te bouwen.
              </li>
              <li>
                Zorg voor minimaal 600+ woorden op de Pillar Page met een uitgebreide FAQ-sectie.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
