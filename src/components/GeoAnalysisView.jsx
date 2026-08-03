import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  TrendingUp, 
  Award, 
  Building2, 
  Plus, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export default function GeoAnalysisView({ projectId, activeProject }) {
  const [geoData, setGeoData] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingGeo, setCheckingGeo] = useState(false);

  // Search & Sorting state for Regional Table
  const [regionSearch, setRegionSearch] = useState('');
  const [regionSortField, setRegionSortField] = useState('averagePosition');
  const [regionSortOrder, setRegionSortOrder] = useState('asc'); // 'asc' = best position #1 first

  // New competitor form state
  const [compName, setCompName] = useState('');
  const [compDomain, setCompDomain] = useState('');

  const fetchGeoAndCompetitors = async () => {
    setLoading(true);
    try {
      const [geoRes, compRes] = await Promise.all([
        fetch(`/api/projects/${projectId || 1}/geo`),
        fetch(`/api/projects/${projectId || 1}/competitors`)
      ]);
      const gData = await geoRes.json();
      const cData = await compRes.json();

      setGeoData(gData);
      setCompetitors(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGeoAndCompetitors();
  }, [projectId]);

  const handleRunGeoCheck = async () => {
    setCheckingGeo(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/geo/check`, {
        method: 'POST'
      });
      const updatedData = await res.json();
      setGeoData(updatedData);
    } catch (err) {
      alert('Fout bij uitvoeren GEO check: ' + err.message);
    } finally {
      setCheckingGeo(false);
    }
  };

  const handleAddCompetitor = async (e) => {
    e.preventDefault();
    if (!compDomain.trim()) return;

    try {
      await fetch(`/api/projects/${projectId || 1}/competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: compName || compDomain, domain: compDomain })
      });
      setCompName('');
      setCompDomain('');
      fetchGeoAndCompetitors();
    } catch (err) {
      alert('Fout bij toevoegen concurrent');
    }
  };

  const handleRegionSort = (field) => {
    if (regionSortField === field) {
      setRegionSortOrder(regionSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setRegionSortField(field);
      setRegionSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (regionSortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return regionSortOrder === 'asc' ? <ArrowUp size={12} color="var(--primary)" /> : <ArrowDown size={12} color="var(--primary)" />;
  };

  if (!geoData) return <div className="card">Laden van GEO analyse gegevens...</div>;

  const { summary = [], insights = [] } = geoData;

  // Filter & Sort Regions
  const filteredSummary = summary.filter(reg => 
    reg.region.toLowerCase().includes(regionSearch.toLowerCase())
  );

  const sortedSummary = [...filteredSummary].sort((a, b) => {
    let valA = a[regionSortField];
    let valB = b[regionSortField];

    if (typeof valA === 'string') {
      return regionSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    return regionSortOrder === 'asc' ? valA - valB : valB - valA;
  });

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-success">Regionale GEO Analyse</span>
              <span className="badge badge-info">Google.nl Steden & Provincies</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Regionale Zichtbaarheid: {activeProject?.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Analyseer hoe je domein presteert in specifieke Nederlandse steden en vergelijk je positie met concurrenten.
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleRunGeoCheck} disabled={checkingGeo}>
            <RefreshCw size={16} className={checkingGeo ? 'spin' : ''} style={{ animation: checkingGeo ? 'spin 1s linear infinite' : 'none' }} />
            {checkingGeo ? 'Regio Rankings Scannen...' : 'Check Regio Rankings Nu'}
          </button>
        </div>
      </div>

      {/* Google Business Profile Verified Status Card */}
      {geoData.businessProfile && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: '16px', background: 'rgba(5,150,105,0.05)', borderColor: 'var(--primary-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '1rem' }}>{geoData.businessProfile.title}</strong>
                  <span className="badge badge-success">✓ Google Bedrijfsprofiel Geïndexeerd op Maps</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                  📍 {geoData.businessProfile.address} &bull; 📞 {geoData.businessProfile.phone} &bull; Categorie: {geoData.businessProfile.category}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {geoData.businessProfile.rating ? `${geoData.businessProfile.rating} ★` : '4.9 ★'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {geoData.businessProfile.ratingCount} reviews op Google Maps
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Sort Controls for Regional Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} color="var(--primary)" /> Prestaties per Nederlandse Regio
        </h3>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="input-field"
            style={{ paddingLeft: '36px' }}
            placeholder="Zoek stad/regio..."
            value={regionSearch}
            onChange={(e) => setRegionSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Sortable Regional Summary Table */}
      <div className="table-container" style={{ marginBottom: '24px' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th onClick={() => handleRegionSort('region')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Stad / Regio {renderSortIcon('region')}</div>
              </th>
              <th onClick={() => handleRegionSort('averagePosition')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Gemiddelde Positie {renderSortIcon('averagePosition')}</div>
              </th>
              <th onClick={() => handleRegionSort('visibilityScore')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>GEO Zichtbaarheid {renderSortIcon('visibilityScore')}</div>
              </th>
              <th onClick={() => handleRegionSort('top3Count')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Top 3 Keywords {renderSortIcon('top3Count')}</div>
              </th>
              <th onClick={() => handleRegionSort('top10Count')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Top 10 Keywords {renderSortIcon('top10Count')}</div>
              </th>
              <th onClick={() => handleRegionSort('localPackCount')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Google Local Pack {renderSortIcon('localPackCount')}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSummary.map((reg, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{reg.region}</td>
                <td>
                  <span style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 800, 
                    color: reg.averagePosition <= 5 ? 'var(--primary)' : reg.averagePosition <= 10 ? 'var(--warning)' : 'var(--danger)' 
                  }}>
                    #{reg.averagePosition > 0 ? reg.averagePosition : '-'}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${reg.visibilityScore >= 70 ? 'success' : reg.visibilityScore >= 40 ? 'warning' : 'danger'}`}>
                    {reg.visibilityScore}% Zichtbaar
                  </span>
                </td>
                <td><strong style={{ color: 'var(--primary)' }}>{reg.top3Count}</strong> keywords</td>
                <td><strong style={{ color: 'var(--text-main)' }}>{reg.top10Count}</strong> keywords</td>
                <td>
                  {reg.localPackCount > 0 ? (
                    <span className="badge badge-success">✓ Local Pack Present</span>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid: Regional Insights & Competitors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Regional Insights & Local SEO Recommendations */}
        <div className="card">
          <h3 className="card-title">
            <Building2 size={20} color="var(--primary)" /> Lokale SEO Inzichten & Advies
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {insights.map((ins, i) => (
              <div key={i} className={`rec-card type-${ins.type === 'success' ? 'opportunity' : 'warning'}`}>
                <div className="rec-title">
                  {ins.type === 'success' ? <CheckCircle2 size={16} color="var(--primary)" /> : <AlertCircle size={16} color="var(--warning)" />}
                  {ins.title}
                </div>
                <div className="rec-desc">{ins.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Multi-Domain & Competitor Tracking */}
        <div className="card">
          <h3 className="card-title">
            <Globe size={20} color="var(--primary)" /> Concurrenten & Domeinen Vergelijken
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Voeg concurrenten toe om hun SEO-posities te vergelijken met {activeProject?.name}.
          </p>

          <form onSubmit={handleAddCompetitor} className="input-group" style={{ marginBottom: '16px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Naam (bijv. Concurrent X)"
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
            />
            <input 
              type="url" 
              className="input-field" 
              placeholder="https://concurrent.nl"
              value={compDomain}
              onChange={(e) => setCompDomain(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-secondary">
              <Plus size={16} /> Toevoegen
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--primary-border)' }}>
              <div>
                <strong>{activeProject?.name} (Jouw Site)</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeProject?.domain}</div>
              </div>
              <span className="badge badge-success">Actief Domein</span>
            </div>

            {competitors.map((c) => (
              <div key={c.id} style={{ padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{c.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.domain}</div>
                </div>
                <span className="badge badge-info">Concurrent</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
