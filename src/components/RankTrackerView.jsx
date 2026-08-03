import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  RefreshCw, 
  MapPin, 
  Globe, 
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  History,
  Tag,
  Eye,
  Minus
} from 'lucide-react';
import AiPromptCanvas from './AiPromptCanvas';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { isBrandKeyword } from '../utils/brandFilter';

export default function RankTrackerView({ projectId, activeProject }) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Uitklapbare positie-historie per zoekwoord
  const [expandedId, setExpandedId] = useState(null);
  const [historyData, setHistoryData] = useState({});

  const toggleHistory = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!historyData[id]) {
      try {
        const res = await fetch(`/api/keywords/${id}/history`);
        const rows = await res.json();
        setHistoryData(prev => ({ ...prev, [id]: rows }));
      } catch (err) {
        console.error('Fout bij ophalen historie:', err);
      }
    }
  };
  
  // New keyword form
  const [newKeyword, setNewKeyword] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [region, setRegion] = useState('Geldrop');

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'top3', 'top10', 'improved', 'declined', 'unranked'
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [sortField, setSortField] = useState('position');
  const [sortOrder, setSortOrder] = useState('asc');
  const [hideBrandKeywords, setHideBrandKeywords] = useState(true);
  const [deletingBrand, setDeletingBrand] = useState(false);

  const domain = activeProject?.domain || '';
  const businessName = activeProject?.name || '';

  const isBrand = (kwStr) => isBrandKeyword(kwStr, domain, businessName);

  const handleDeleteBrandKeywords = async () => {
    const brandCount = keywords.filter(k => isBrand(k.keyword)).length;
    if (brandCount === 0) {
      alert('Geen merknaam zoekwoorden gevonden om te verwijderen.');
      return;
    }
    if (!confirm(`Weet je zeker dat je alle ${brandCount} merknaam zoekwoorden definitief wilt verwijderen uit de rank tracker?`)) return;

    setDeletingBrand(true);
    try {
      const res = await fetch('/api/keywords/delete-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId || 1 })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.deletedCount} merknaam zoekwoorden succesvol verwijderd.`);
        fetchKeywords();
      } else {
        alert('Fout bij verwijderen: ' + (data.error || 'Onbekend'));
      }
    } catch (err) {
      alert('Fout bij verwijderen merknamen: ' + err.message);
    } finally {
      setDeletingBrand(false);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, [projectId]);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/keywords?projectId=${projectId || 1}`);
      const data = await res.json();
      setKeywords(data);
    } catch (err) {
      console.error('Fout bij ophalen keywords:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || 1,
          keyword: newKeyword.trim(),
          targetUrl: targetUrl.trim(),
          region
        })
      });
      if (res.ok) {
        setNewKeyword('');
        setTargetUrl('');
        fetchKeywords();
      }
    } catch (err) {
      alert('Fout bij toevoegen zoekwoord: ' + err.message);
    }
  };

  const handleDeleteKeyword = async (id) => {
    if (!confirm('Weet je zeker dat je dit zoekwoord wilt verwijderen?')) return;
    try {
      await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
      fetchKeywords();
    } catch (err) {
      alert('Fout bij verwijderen: ' + err.message);
    }
  };

  const handleCheckRankings = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/keywords/check-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId || 1 })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Ranking check mislukt');
      }
      fetchKeywords();
    } catch (err) {
      alert('Fout bij hercontroleren van rankings: ' + err.message);
    } finally {
      setChecking(false);
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

  // Filter logic
  const filteredKeywords = keywords.filter(kw => {
    const matchesSearch = kw.keyword.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (kw.target_url || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (hideBrandKeywords && isBrand(kw.keyword)) return false;

    if (selectedRegion !== 'all' && kw.region !== selectedRegion) return false;

    if (activeFilter === 'top3') return kw.position > 0 && kw.position <= 3;
    if (activeFilter === 'top10') return kw.position > 0 && kw.position <= 10;
    if (activeFilter === 'improved') return kw.position > 0 && kw.position < kw.previous_position;
    if (activeFilter === 'declined') return kw.position > 0 && kw.position > kw.previous_position;
    if (activeFilter === 'unranked') return kw.position === 0;

    return true;
  });

  // Count brand keywords total
  const brandKeywordsCount = keywords.filter(k => isBrand(k.keyword)).length;

  // Sort logic
  const sortedKeywords = [...filteredKeywords].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'position' || sortField === 'previous_position') {
      if (valA === 0 || valA === null || valA === undefined) valA = 999;
      if (valB === 0 || valB === null || valB === undefined) valB = 999;
    } else if (sortField === 'search_volume' || sortField === 'impressions' || sortField === 'trend') {
      if (valA === null || valA === undefined) valA = -999;
      if (valB === null || valB === undefined) valB = -999;
    } else {
      if (valA === 0 || valA === null || valA === undefined) valA = 999;
      if (valB === 0 || valB === null || valB === undefined) valB = 999;
    }

    if (typeof valA === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortOrder === 'asc' ? <ArrowUp size={12} color="var(--primary)" /> : <ArrowDown size={12} color="var(--primary)" />;
  };

  const uniqueRegions = Array.from(new Set(keywords.map(k => k.region).filter(Boolean)));

  const quickWins = keywords.filter(k => k.position >= 4 && k.position <= 10);
  const unrankedList = keywords.filter(k => k.position === 0 || k.position > 10);

  const projectLabel = activeProject ? `${activeProject.name} (${activeProject.domain})` : 'dit project';
  const rankAiPromptProposal = `Je bent een vooraanstaande SEO Strategist voor Google.nl.

Stel een concreet actieplan op voor ${projectLabel} om onze posities te veroveren:

=== HUIDIGE MONITORING & ECHTE POSITIES ===
${keywords.map((k, i) => `${i + 1}. Zoekwoord: "${k.keyword}" | Regio: ${k.region || 'Nederland'} | Positie: ${k.position > 0 ? '#' + k.position : k.position === 0 ? 'Niet in Top 100 (>100)' : 'Nog niet gecheckt'} | Gevonden URL: ${k.url_found || '(Geen)'}`).join('\n')}

=== ACTIEPUNTEN VOOR HET VERDER STIJGEN ===
1. **Nieuwe Landingspagina's**: Maak voor onvindbare zoekwoorden een specifieke landingspagina aan.
2. **Content Uitbreiding**: Voeg 300 woorden waardevolle informatie + FAQ toe.
3. **Internal Links & Local Schema**: Bouw interne links vanuit sterk rankende pagina's en voeg LocalBusiness schema toe.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(rankAiPromptProposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      {/* Header & Add Keyword Form */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '14px' }}>
        <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
            <Search size={18} color="var(--primary)" /> Live Dutch Keyword Rank Tracker (Google.nl vanaf Geldrop / Nuenen)
          </span>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary" 
              onClick={async () => {
                try {
                  const res = await fetch('/api/supabase/import-course-keywords', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId })
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert(`✓ Succesvol ${data.imported} cursus-zoekwoorden & URL's geïmporteerd uit Supabase!`);
                    fetchKeywords();
                  } else {
                    alert(`Fout: ${data.error}`);
                  }
                } catch (e) {
                  alert(`Fout bij importeren uit Supabase: ${e.message}`);
                }
              }}
              style={{ background: '#059669', color: '#ffffff', borderColor: '#059669', padding: '5px 10px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} /> Sync Cursussen uit Supabase
            </button>

            <button className="btn btn-primary" onClick={handleCheckRankings} disabled={checking} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
              {checking ? (
                <>
                  <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Controleren op Google.nl...
                </>
              ) : (
                <>
                  <RefreshCw size={14} /> Check Live Rankings Nu
                </>
              )}
            </button>
          </div>
        </div>

        <form onSubmit={handleAddKeyword} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 0 }}>
          <input 
            type="text"
            className="input-field"
            style={{ flex: '1 1 200px', minWidth: '150px' }}
            placeholder="Nieuw zoekwoord (bijv. 'heftruckcertificaat halen eindhoven')"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            required
          />
          <input 
            type="text"
            className="input-field"
            style={{ flex: '1 1 150px', minWidth: '120px' }}
            placeholder="Doel URL (optioneel)"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
          <select 
            className="input-field" 
            style={{ width: '120px', flexShrink: 0 }}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="Geldrop">Geldrop</option>
            <option value="Nuenen">Nuenen</option>
            <option value="Eindhoven">Eindhoven</option>
            <option value="Helmond">Helmond</option>
            <option value="Nederland">Heel Nederland</option>
          </select>
          <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0, padding: '6px 12px' }}>
            <Plus size={15} /> Zoekwoord Toevoegen
          </button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">Totaal Gemonitord</div>
          <div className="stat-value">
            {keywords.length}
            {hideBrandKeywords && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>({keywords.length - brandKeywordsCount} ex. merk)</span>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">Top 3 Rankings</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {keywords.filter(k => (!hideBrandKeywords || !isBrand(k.keyword)) && k.position > 0 && k.position <= 3).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">Top 10 Rankings</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {keywords.filter(k => (!hideBrandKeywords || !isBrand(k.keyword)) && k.position > 0 && k.position <= 10).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">Niet in Top 100</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {keywords.filter(k => (!hideBrandKeywords || !isBrand(k.keyword)) && k.position === 0).length}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Brand Controls & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="filter-tabs" style={{ marginBottom: 0, gap: '4px' }}>
          <button className={`tab-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
            Alle ({keywords.filter(k => !hideBrandKeywords || !isBrand(k.keyword)).length})
          </button>
          <button className={`tab-btn ${activeFilter === 'top3' ? 'active' : ''}`} onClick={() => setActiveFilter('top3')} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
            Top 3 ({keywords.filter(k => (!hideBrandKeywords || !isBrand(k.keyword)) && k.position > 0 && k.position <= 3).length})
          </button>
          <button className={`tab-btn ${activeFilter === 'top10' ? 'active' : ''}`} onClick={() => setActiveFilter('top10')} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
            Top 10 ({keywords.filter(k => (!hideBrandKeywords || !isBrand(k.keyword)) && k.position > 0 && k.position <= 10).length})
          </button>
          <button className={`tab-btn ${activeFilter === 'unranked' ? 'active' : ''}`} onClick={() => setActiveFilter('unranked')} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
            Niet in Top 100 ({keywords.filter(k => (!hideBrandKeywords || !isBrand(k.keyword)) && k.position === 0).length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Brand Filter Toggle Button */}
          <button 
            className={`btn ${hideBrandKeywords ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setHideBrandKeywords(!hideBrandKeywords)}
            title={hideBrandKeywords ? "Toon alle zoekwoorden inclusief merknamen" : "Verberg merknaam zoekwoorden uit de lijst"}
          >
            {hideBrandKeywords ? <ShieldOff size={14} /> : <Tag size={14} />}
            {hideBrandKeywords ? 'Merknamen Verborgen' : 'Verberg Merknamen'}
          </button>

          {/* Bulk Delete Brand Keywords Button */}
          {brandKeywordsCount > 0 && (
            <button 
              className="btn btn-danger"
              style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={handleDeleteBrandKeywords}
              disabled={deletingBrand}
              title="Verwijder alle merknaam zoekwoorden definitief uit de database"
            >
              <Trash2 size={14} />
              {deletingBrand ? 'Opschonen...' : `Schoon Merknamen Op (${brandKeywordsCount})`}
            </button>
          )}

          {uniqueRegions.length > 0 && (
            <select 
              className="input-field" 
              style={{ width: '120px', padding: '5px 8px', fontSize: '0.8rem' }}
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              <option value="all">Alle Regio's</option>
              {uniqueRegions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          <div style={{ position: 'relative', width: '170px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              className="input-field"
              style={{ paddingLeft: '30px', padding: '5px 10px 5px 30px', fontSize: '0.8rem' }}
              placeholder="Zoek zoekwoord..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sortable Keywords Table */}
      <div className="table-container" style={{ marginBottom: '20px' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('keyword')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Zoekwoord {renderSortIcon('keyword')}</div>
              </th>
              <th onClick={() => handleSort('region')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Regio {renderSortIcon('region')}</div>
              </th>
              <th onClick={() => handleSort('impressions')} style={{ cursor: 'pointer' }} title="Vertoningen in Google Search Console over de afgelopen 28 dagen">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Zoekvolume (GSC) {renderSortIcon('impressions')}</div>
              </th>
              <th onClick={() => handleSort('trend')} style={{ cursor: 'pointer' }} title="Procentuele stijging/daling in GSC-vertoningen t.o.v. de vorige 28 dagen">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Trend (28d) {renderSortIcon('trend')}</div>
              </th>
              <th onClick={() => handleSort('position')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Echte Positie (Google.nl) {renderSortIcon('position')}</div>
              </th>
              <th onClick={() => handleSort('previous_position')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Verschil {renderSortIcon('previous_position')}</div>
              </th>
              <th onClick={() => handleSort('target_url')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Gevonden URL {renderSortIcon('target_url')}</div>
              </th>
              <th style={{ textAlign: 'right' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeywords.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Geen zoekwoorden gevonden voor de huidige filter/zoekopdracht.
                </td>
              </tr>
            ) : (
              sortedKeywords.map((kw) => {
                const diff = (kw.previous_position && kw.position > 0) ? kw.previous_position - kw.position : 0;
                const history = historyData[kw.id] || [];
                const chartData = history.map(h => ({
                  date: (h.checked_at || '').slice(5, 16),
                  position: h.position > 0 ? h.position : null
                }));
                return (
                  <React.Fragment key={kw.id}>
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => toggleHistory(kw.id)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <History size={13} color={expandedId === kw.id ? 'var(--primary)' : 'var(--text-dim)'} />
                        {kw.keyword}
                        {isBrand(kw.keyword) && (
                          <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '1px 5px', opacity: 0.85 }}>
                            Merknaam
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ gap: '4px' }}>
                        <MapPin size={10} /> {kw.region || 'Geldrop'}
                      </span>
                    </td>
                    <td>
                      {kw.impressions > 0 ? (
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={13} color="var(--primary)" />
                          {kw.impressions.toLocaleString('nl-NL')} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>/mnd</span>
                        </span>
                      ) : kw.search_volume > 0 ? (
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {kw.search_volume.toLocaleString('nl-NL')} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>/mnd</span>
                        </span>
                      ) : kw.gsc_connected ? (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                          0 <span style={{ fontSize: '0.75rem' }}>/mnd</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {kw.trend > 0 ? (
                        <span className="badge badge-success" style={{ gap: '3px', fontSize: '0.78rem' }}>
                          <TrendingUp size={12} /> +{kw.trend}%
                        </span>
                      ) : kw.trend < 0 ? (
                        <span className="badge badge-danger" style={{ gap: '3px', fontSize: '0.78rem' }}>
                          <TrendingDown size={12} /> {kw.trend}%
                        </span>
                      ) : kw.gsc_connected ? (
                        <span className="badge badge-info" style={{ gap: '3px', fontSize: '0.78rem', opacity: 0.7 }}>
                          <Minus size={12} /> 0%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {kw.position > 0 ? (
                        <span style={{
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          color: kw.position <= 3 ? 'var(--primary)' : kw.position <= 10 ? 'var(--warning)' : 'var(--danger)'
                        }}>
                          #{kw.position}
                        </span>
                      ) : kw.position === 0 ? (
                        <span className="badge badge-danger">Niet in Top 100</span>
                      ) : (
                        <span className="badge badge-info">Nog niet gecheckt</span>
                      )}
                    </td>
                    <td>
                      {diff > 0 ? (
                        <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <TrendingUp size={14} /> +{diff}
                        </span>
                      ) : diff < 0 ? (
                        <span style={{ color: 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <TrendingDown size={14} /> {diff}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>0 (Gelijk)</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>
                      {kw.url_found ? (
                        <a href={kw.url_found} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{kw.url_found}</a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>Geen URL gevonden</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary btn-xs" 
                        title="Optimaliseer met AI Content Generator"
                        onClick={() => {
                          const kwUrl = kw.url_found || kw.target_url || (activeProject ? activeProject.domain : '');
                          window.dispatchEvent(new CustomEvent('open-content-optimizer', { detail: { keyword: kw.keyword, url: kwUrl } }));
                        }}
                      >
                        <Sparkles size={12} color="var(--primary)" /> AI Brief
                      </button>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDeleteKeyword(kw.id)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                  {expandedId === kw.id && (
                    <tr>
                      <td colSpan="8" style={{ background: 'var(--bg-main)', padding: '16px 24px' }}>
                        {chartData.filter(d => d.position !== null).length < 2 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
                            {history.length === 0
                              ? 'Historie wordt geladen...'
                              : 'Nog onvoldoende meetpunten voor een grafiek. Elke ranking check voegt een punt toe.'}
                          </div>
                        ) : (
                          <div style={{ height: '180px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                                <YAxis reversed domain={[1, 'auto']} allowDecimals={false} stroke="#71717a" fontSize={11} label={{ value: 'Positie', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px' }}
                                  formatter={(value) => [`#${value}`, 'Positie']}
                                />
                                <Line type="monotone" dataKey="position" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} connectNulls name="Positie" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* BOTTOM SECTION: AI Ranking Advice & Custom AI Prompt Generator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: AI Ranking Action Items */}
        <div className="card">
          <h3 className="card-title">
            <ShieldCheck size={20} color="var(--primary)" /> Echte Ranking Analyse (Geldrop / Nuenen / Eindhoven)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {unrankedList.length > 0 ? (
              <div className="rec-card type-critical">
                <div className="rec-title">
                  <AlertTriangle size={16} color="var(--danger)" /> Zoekwoorden buiten de Top 10 (#{unrankedList.length})
                </div>
                <div className="rec-desc">
                  {unrankedList.slice(0, 3).map(k => `"${k.keyword}"`).join(', ')} {unrankedList.length > 3 ? `en ${unrankedList.length - 3} andere ` : ''}
                  staan op dit moment **niet op Pagina 1 van Google.nl**. Maak specifieke landingspagina's aan of verdiep de bestaande content om te gaan scoren.
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {keywords.length === 0 ? 'Voeg zoekwoorden toe om de analyse te starten.' : 'Alle gemonitorde zoekwoorden staan in de Top 10. Blijf monitoren.'}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Custom AI Prompt Canvas */}
        <div style={{ marginTop: '-24px' }}>
          <AiPromptCanvas
            title="Kant-en-klare AI Prompt: Posities Veroveren"
            promptText={rankAiPromptProposal}
          />
        </div>
      </div>
    </div>
  );
}
