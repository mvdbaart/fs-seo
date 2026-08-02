import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  X, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon,
  Zap,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import AiPromptCanvas from './AiPromptCanvas';

export default function CrawlerView({ projectId, projectDomain, onCrawlComplete }) {
  const [startUrl, setStartUrl] = useState(projectDomain || 'https://voorbeeld.nl');
  const [maxPages, setMaxPages] = useState(25);
  const [loading, setLoading] = useState(false);
  const [crawledData, setCrawledData] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [wrapText, setWrapText] = useState(true);

  // Sorting state
  const [sortField, setSortField] = useState('url');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  useEffect(() => {
    if (projectDomain) setStartUrl(projectDomain);
    fetchLatestCrawlSession();
  }, [projectId, projectDomain]);

  const fetchLatestCrawlSession = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/crawl/latest`);
      const data = await res.json();
      if (data.session && data.pages.length > 0) {
        setCrawledData(data);
      } else {
        setCrawledData(null);
      }
    } catch (err) {
      console.error('Fout bij laden van crawl sessie:', err);
    }
  };

  const handleStartCrawl = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, startUrl, maxPages })
      });
      const data = await res.json();
      
      if (data.sessionId) {
        const sessionRes = await fetch(`/api/crawl/sessions/${data.sessionId}`);
        const sessionData = await sessionRes.json();
        setCrawledData(sessionData);
        if (onCrawlComplete) onCrawlComplete();
      }
    } catch (err) {
      alert('Fout tijdens crawlen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const pages = crawledData?.pages || [];
  const session = crawledData?.session || null;

  // Filter logic
  const filteredPages = pages.filter(page => {
    const matchesSearch = page.url.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (page.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (page.keywords || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'errors') return page.status_code >= 400;
    if (activeTab === 'missing_title') return !page.title || page.title.trim() === '';
    if (activeTab === 'title_length') return page.title && (page.title_length < 30 || page.title_length > 60);
    if (activeTab === 'missing_meta') return !page.meta_description || page.meta_description.trim() === '';
    if (activeTab === 'missing_h1') return page.h1_count === 0;
    if (activeTab === 'missing_alt') return page.images_missing_alt > 0;

    return true;
  });

  // Sort logic
  const sortedPages = [...filteredPages].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    if (typeof valA === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    }

    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortOrder === 'asc' ? <ArrowUp size={12} color="var(--primary)" /> : <ArrowDown size={12} color="var(--primary)" />;
  };

  return (
    <div>
      {/* Crawl Control Form */}
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="var(--primary)" /> On-Page SEO Website Krawler
          </span>

          {session && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} /> Opslagen geladen van: {new Date(session.created_at).toLocaleString('nl-NL')}
            </span>
          )}
        </div>
        
        <form onSubmit={handleStartCrawl} className="input-group" style={{ marginBottom: 0 }}>
          <input 
            type="url" 
            className="input-field" 
            placeholder="https://jouwwebsite.nl"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            required
          />
          <select 
            className="input-field" 
            style={{ maxWidth: '170px' }}
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
          >
            <option value={10}>10 Pagina's</option>
            <option value={25}>25 Pagina's</option>
            <option value={50}>50 Pagina's</option>
            <option value={100}>100 Pagina's</option>
            <option value={250}>250 Pagina's</option>
            <option value={500}>500 Pagina's</option>
            <option value={1000}>1000 Pagina's</option>
            <option value={5000}>5000 (Max Batches)</option>
          </select>
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Crawlen bezig...
              </>
            ) : (
              <>Start Website Crawl</>
            )}
          </button>
        </form>
      </div>

      {pages.length > 0 ? (
        <>
          {/* Summary KPIs */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-header">Totaal Gekrawld</div>
              <div className="stat-value">{pages.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">HTTP Fouten</div>
              <div className="stat-value" style={{ color: pages.filter(p => p.status_code >= 400).length > 0 ? 'var(--danger)' : 'var(--primary)' }}>
                {pages.filter(p => p.status_code >= 400).length}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-header">Ontbrekende Titles</div>
              <div className="stat-value" style={{ color: pages.filter(p => !p.title).length > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                {pages.filter(p => !p.title).length}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-header">Ontbrekende Meta's</div>
              <div className="stat-value">{pages.filter(p => !p.meta_description).length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">Afbeeldingen zonder Alt</div>
              <div className="stat-value">{pages.reduce((acc, p) => acc + (p.images_missing_alt || 0), 0)}</div>
            </div>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="filter-tabs" style={{ marginBottom: 0 }}>
              <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                Alle Pagina's ({pages.length})
              </button>
              <button className={`tab-btn ${activeTab === 'errors' ? 'active' : ''}`} onClick={() => setActiveTab('errors')}>
                HTTP Fouten ({pages.filter(p => p.status_code >= 400).length})
              </button>
              <button className={`tab-btn ${activeTab === 'missing_title' ? 'active' : ''}`} onClick={() => setActiveTab('missing_title')}>
                Geen Title ({pages.filter(p => !p.title).length})
              </button>
              <button className={`tab-btn ${activeTab === 'title_length' ? 'active' : ''}`} onClick={() => setActiveTab('title_length')}>
                Title Lengte Waarschuwing ({pages.filter(p => p.title && (p.title_length < 30 || p.title_length > 60)).length})
              </button>
              <button className={`tab-btn ${activeTab === 'missing_meta' ? 'active' : ''}`} onClick={() => setActiveTab('missing_meta')}>
                Geen Meta Description ({pages.filter(p => !p.meta_description).length})
              </button>
              <button className={`tab-btn ${activeTab === 'missing_h1' ? 'active' : ''}`} onClick={() => setActiveTab('missing_h1')}>
                Geen H1 ({pages.filter(p => p.h1_count === 0).length})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                type="button"
                className={`btn ${wrapText ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                onClick={() => setWrapText(!wrapText)}
                title="Wissel tussen volledige tekstweergave en compacte regels"
              >
                {wrapText ? 'Tekst Inklappen (Compact)' : 'Volledige Tekst Tonen'}
              </button>

              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '36px' }}
                  placeholder="Zoek in URL's & keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Screaming Frog Interactive Sortable Table */}
          <div className="table-container">
            <table className={`custom-table ${wrapText ? 'wrap-text' : ''}`}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('status_code')} style={{ cursor: 'pointer', minWidth: '90px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Status {renderSortIcon('status_code')}</div>
                  </th>
                  <th onClick={() => handleSort('url')} style={{ cursor: 'pointer', minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>URL {renderSortIcon('url')}</div>
                  </th>
                  <th onClick={() => handleSort('keywords')} style={{ cursor: 'pointer', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Focus Keywords {renderSortIcon('keywords')}</div>
                  </th>
                  <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Title Tag {renderSortIcon('title')}</div>
                  </th>
                  <th onClick={() => handleSort('title_length')} style={{ cursor: 'pointer', minWidth: '110px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Title Lengte {renderSortIcon('title_length')}</div>
                  </th>
                  <th onClick={() => handleSort('meta_description')} style={{ cursor: 'pointer', minWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Meta Description {renderSortIcon('meta_description')}</div>
                  </th>
                  <th onClick={() => handleSort('h1')} style={{ cursor: 'pointer', minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>H1 Koptekst {renderSortIcon('h1')}</div>
                  </th>
                  <th onClick={() => handleSort('images_missing_alt')} style={{ cursor: 'pointer', minWidth: '140px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>NoAlt Afbeeldingen {renderSortIcon('images_missing_alt')}</div>
                  </th>
                  <th onClick={() => handleSort('load_time_ms')} style={{ cursor: 'pointer', minWidth: '100px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Snelheid {renderSortIcon('load_time_ms')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPages.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Geen pagina's gevonden voor de geselecteerde filter/zoekopdracht.
                    </td>
                  </tr>
                ) : (
                  sortedPages.map((page, index) => (
                    <tr key={index} onClick={() => setSelectedPage(page)} style={{ cursor: 'pointer' }}>
                      <td>
                        {page.status_code === 200 ? (
                          <span className="badge badge-success">200 OK</span>
                        ) : page.status_code >= 400 ? (
                          <span className="badge badge-danger">{page.status_code} Error</span>
                        ) : (
                          <span className="badge badge-warning">{page.status_code}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--primary)' }} title={page.url}>{page.url}</td>
                      <td title={page.keywords || ''}>
                        {page.keywords ? (
                          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                            {page.keywords}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>
                      <td title={page.title || ''}>{page.title || <span style={{ color: 'var(--danger)' }}>(Ontbreekt)</span>}</td>
                      <td>
                        {page.title_length ? (
                          <span style={{ color: (page.title_length < 30 || page.title_length > 60) ? 'var(--warning)' : 'var(--text-main)' }}>
                            {page.title_length} tekens
                          </span>
                        ) : '-'}
                      </td>
                      <td title={page.meta_description || ''}>{page.meta_description || <span style={{ color: 'var(--warning)' }}>(Ontbreekt)</span>}</td>
                      <td title={page.h1 || ''}>{page.h1 || <span style={{ color: 'var(--warning)' }}>(Geen H1)</span>}</td>
                      <td>
                        {page.images_missing_alt > 0 ? (
                          <span className="badge badge-warning">{page.images_missing_alt} zonder alt</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td>{page.load_time_ms} ms</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AiPromptCanvas 
            title="AI Prompt: On-Page Crawler Problemen Oplossen"
            promptText={`Je bent een senior Technical SEO & Web Performance Specialist. Hier zijn de geanalyseerde problemen van onze website crawl voor ${startUrl}:\n\n- Totaal aantal gekrawlde pagina's: ${pages.length}\n- Aantal HTTP Fouten (404/500): ${pages.filter(p => p.status_code >= 400).length} (${pages.filter(p => p.status_code >= 400).map(p => p.url).join(', ')})\n- Ontbrekende Titles (${pages.filter(p => !p.title).length}): ${pages.filter(p => !p.title).map(p => p.url).join(', ')}\n- Ontbrekende Meta Descriptions (${pages.filter(p => !p.meta_description).length}): ${pages.filter(p => !p.meta_description).map(p => p.url).join(', ')}\n- Ontbrekende H1 kopteksten (${pages.filter(p => p.h1_count === 0).length}): ${pages.filter(p => p.h1_count === 0).map(p => p.url).join(', ')}\n- Afbeeldingen zonder Alt-tekst: ${pages.reduce((acc, p) => acc + (p.images_missing_alt || 0), 0)}\n\nOpdracht:\n1. Schrijf voor elke pagina met een ontbrekende Title en Meta Description een pakkende, SEO-geoptimaliseerde Title (50-60 tekens) en Meta Description (140-155 tekens) gericht op de Nederlandse markt.\n2. Geef een stap-voor-stap actieplan om de HTTP 404/500 fouten en ontbrekende H1 kopteksten op te lossen.\n3. Genereer een lijst met relevante Alt-teksten voor de afbeeldingen zonder Alt.`}
          />
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Globe size={40} color="var(--primary)" style={{ marginBottom: '12px', opacity: 0.8 }} />
          <h3>Nog geen gekrawlde pagina's voor dit project</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', marginBottom: '16px' }}>
            Voer hierboven de URL van {projectDomain || 'je website'} in en klik op <strong>Start Website Crawl</strong>.
          </p>
        </div>
      )}

      {/* Page Inspector Drawer */}
      {selectedPage && (
        <div className="modal-overlay" onClick={() => setSelectedPage(null)}>
          <div className="modal-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Pagina Inspecteren</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setSelectedPage(null)} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>URL</div>
              <a href={selectedPage.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all', fontSize: '0.9rem' }}>
                {selectedPage.url} <ExternalLink size={12} />
              </a>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Google.nl SERP Preview</h4>
              <div style={{ color: '#1a0dab', fontSize: '1rem', fontWeight: 500 }}>{selectedPage.title || 'Geen Titel Opgegeven'}</div>
              <div style={{ color: '#006621', fontSize: '0.75rem' }}>{selectedPage.url}</div>
              <div style={{ color: '#545454', fontSize: '0.82rem', marginTop: '4px' }}>
                {selectedPage.meta_description || 'Geen meta description opgegeven. Google genereert zelf een snippet.'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <strong>Focus Keywords:</strong> {selectedPage.keywords || '(Geen)'}
              </div>
              <div>
                <strong>HTTP Statuscode:</strong> {selectedPage.status_code}
              </div>
              <div>
                <strong>H1 Koptekst:</strong> {selectedPage.h1 || '(Geen)'}
              </div>
              <div>
                <strong>H2 Aantal:</strong> {selectedPage.h2_count}
              </div>
              <div>
                <strong>Canonical Tag:</strong> {selectedPage.canonical || '(Geen)'}
              </div>
              <div>
                <strong>Robots Meta:</strong> {selectedPage.robots || 'index, follow'}
              </div>
              <div>
                <strong>Woorden Aantal:</strong> {selectedPage.word_count} woorden
              </div>
              <div>
                <strong>Interne Links:</strong> {selectedPage.links_internal_count}
              </div>
              <div>
                <strong>Externe Links:</strong> {selectedPage.links_external_count}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
