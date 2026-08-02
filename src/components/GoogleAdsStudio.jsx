import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Sparkles, 
  Trash2, 
  ShieldAlert, 
  ExternalLink, 
  Target, 
  Layers, 
  DollarSign, 
  MapPin, 
  FileSpreadsheet,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  CheckCircle2,
  ArrowRight,
  UploadCloud
} from 'lucide-react';

export default function GoogleAdsStudio({ projectId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    fetchCampaigns();
    fetchLiveStats();
  }, [projectId]);

  const fetchLiveStats = async () => {
    try {
      const res = await fetch('/api/google-ads/live-stats');
      if (res.ok) {
        const data = await res.json();
        setLiveStats(data);
      }
    } catch (err) {
      console.error('Fout bij ophalen live stats:', err);
    }
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = projectId ? `/api/google-ads/campaigns?projectId=${projectId}` : '/api/google-ads/campaigns';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Server status ${res.status}: Backend nog niet bereikbaar.`);
      }
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns);
        if (data.campaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data.campaigns[0]);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateBlueprint = async (blueprintKey) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/google-ads/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintKey, projectId })
      });
      const data = await res.json();
      if (data.success) {
        await fetchCampaigns();
        setSelectedCampaign(data.campaign);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Fout bij genereren van campagne: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Weet je zeker dat je deze campagne wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/google-ads/campaigns/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedCampaign && selectedCampaign.id === id) {
          setSelectedCampaign(null);
        }
        fetchCampaigns();
      }
    } catch (err) {
      alert('Fout bij verwijderen: ' + err.message);
    }
  };

  const downloadCsv = (campaignId) => {
    window.open(`/api/google-ads/export-csv/${campaignId}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div 
        className="card" 
        style={{ 
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f172a 100%)', 
          color: '#ffffff',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Megaphone size={14} /> SEA &amp; Ads Automation
              </span>
              <span style={{ background: 'rgba(241, 139, 26, 0.25)', color: '#fef08a', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(241, 139, 26, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} /> Schuldhulp-Filter Actief
              </span>
            </div>
            <h2 style={{ fontSize: '1.6rem', color: '#ffffff', marginBottom: '6px' }}>Google Ads Campaign Studio</h2>
            <p style={{ color: '#e2e8f0', fontSize: '0.9rem', maxWidth: '750px', lineHeight: 1.4 }}>
              Genereer kant-en-klare Google Ads zoekcampagnes (RSA advertenties + Ad Groups + Zoekwoorden + Uitsluitingswoorden) op basis van de unieke FrisseStart propositie &amp; SEO rankings.
            </p>
          </div>

          <button
            onClick={() => generateBlueprint('code-95-hercertificering')}
            disabled={generating}
            style={{
              background: 'var(--brand-orange)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(241, 139, 26, 0.4)'
            }}
            title="Maakt direct een complete Code 95 campagne aan op basis van de SEO data"
          >
            <Sparkles size={16} />
            {generating ? 'Campagne genereren...' : '✨ Genereer Code 95 Campagne'}
          </button>
        </div>
      </div>

      {/* Live Account Stats Bar */}
      {liveStats && (
        <div className="card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--primary)" /> Gekoppeld Google Ads Account #{liveStats.customerId}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {liveStats.statusMessage}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Totale Klikken</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{liveStats.summary.totalClicks.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Vertoningen</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{liveStats.summary.totalImpressions.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Gem. CTR</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{liveStats.summary.ctr}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Totale Bestedingen</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--brand-orange)' }}>{liveStats.summary.totalCost}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', padding: '18px 22px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={18} color="var(--primary)" /> Hoe werkt deze tool &amp; wat gebeurt er met je data?
          </h3>
          <button 
            onClick={() => setShowGuide(!showGuide)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
          >
            {showGuide ? 'Verberg uitleg' : 'Toon uitleg'}
          </button>
        </div>

        {showGuide && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', paddingTop: '8px', borderTop: '1px solid var(--primary-border)' }}>
            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                Stap 1: Automatisch Genereren
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Klik op een van de <strong>Snel-Generatoren</strong>. De tool verzamelt automatisch de USPs (zoals <em>1-uurs hercertificering</em>), juiste landingspagina's en geo-locations (Eindhoven/Geldrop) en stelt direct 15 advertentiekoppen en 4 beschrijvingen samen.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                Stap 2: Controleren &amp; Filteren
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Je bekijkt de gegenereerde advertenties, zoekwoorden en uitsluitingswoorden in je dashboard. Het <strong>Schuldhulp-Filter</strong> voorkomt automatisch dat er ooit geboden wordt op bewindvoering of schuldverlening termen.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                Stap 3: 1-Click Exporteren / API Sync
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Klik op <strong>"Export CSV (Google Ads Editor)"</strong>. Je kunt dit CSV-bestand in 1 seconde importeren in Google Ads (of Google Ads Editor) óf automatisch laten synchroniseren met je gekoppelde Google Ads account.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: 'var(--danger-light)', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
          <AlertCircle size={18} />
          <div>
            <strong>Status: </strong>{error}
          </div>
        </div>
      )}

      {/* Snel-Generatoren Bar */}
      <div className="card" style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--primary)" /> Snel-Generatoren (Kies een FrisseStart Blueprint)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div 
            onClick={() => !generating && generateBlueprint('code-95-hercertificering')}
            style={{ 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-card-hover)', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                1. Code 95 &amp; Hercertificering
              </span>
              <span style={{ fontSize: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Regio ZO-Brabant
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Genereert een campagne voor 1-uurs hercertificering, 3.5 daagse e-learning &amp; SOOB subsidies.
            </p>
          </div>

          <div 
            onClick={() => !generating && generateBlueprint('certificeringsbeheer-b2b')}
            style={{ 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-card-hover)', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                2. Certificeringsbeheer B2B
              </span>
              <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Landelijke Transporteurs
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Genereert een B2B campagne voor het ontzorgen van transportbedrijven met periodiek certificatenbeheer.
            </p>
          </div>

          <div 
            onClick={() => !generating && generateBlueprint('heftruck-vca-cursussen')}
            style={{ 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-card-hover)', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                3. Heftruck &amp; VCA Cursussen
              </span>
              <span style={{ fontSize: '0.75rem', background: 'var(--brand-orange-light)', color: 'var(--brand-orange)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Lokaal &amp; Regionaal
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Genereert directe conversie-campagnes voor heftruckcertificaat en VCA Basis/VOL.
            </p>
          </div>
        </div>
      </div>

      {/* Main Campaign Management View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '20px' }}>
        {/* Campaign List Sidebar */}
        <div className="card" style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" /> Gegenereerde Campagnes ({campaigns.length})
          </h3>

          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Laden van campagnes...
            </div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              Nog geen campagnes gegenereerd. Klik op een snel-generator bovenaan om je eerste campagne aan te maken.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {campaigns.map((c) => {
                const isSelected = selectedCampaign && selectedCampaign.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCampaign(c)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{c.name}</h4>
                      <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {c.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={12} /> €{c.budget_daily_eur}/dag
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layers size={12} /> {c.groups ? c.groups.length : 0} ad groups
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Campaign Detail View */}
        <div>
          {selectedCampaign ? (
            <div className="card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Campaign Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{selectedCampaign.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)', fontWeight: 500 }}>
                      <MapPin size={14} color="var(--primary)" /> {selectedCampaign.target_locations}
                    </span>
                    <span>•</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      Dagbudget: €{selectedCampaign.budget_daily_eur}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => downloadCsv(selectedCampaign.id)}
                    style={{
                      background: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Downloadt een kant-en-klaar CSV-bestand om te importeren in Google Ads Editor"
                  >
                    <FileSpreadsheet size={16} /> Export CSV (Google Ads Editor)
                  </button>
                  <button
                    onClick={() => handleDelete(selectedCampaign.id)}
                    style={{
                      background: 'var(--danger-light)',
                      color: 'var(--danger)',
                      border: '1px solid #fca5a5',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Campagne verwijderen uit SQLite database"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Negative Keywords Security Badge */}
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                    <ShieldAlert size={16} color="#d97706" /> Automatische Uitsluitingswoorden (Schuldhulp-Filter)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                    {selectedCampaign.negatives ? selectedCampaign.negatives.length : 0} uitgesloten termen
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedCampaign.negatives && selectedCampaign.negatives.map((neg, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: '#fef3c7',
                        color: '#78350f',
                        border: '1px solid #fde68a',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace'
                      }}
                    >
                      -{neg.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ad Groups */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={16} color="var(--primary)" /> Ad Groups &amp; Responsive Search Ads
                </h3>

                {selectedCampaign.groups && selectedCampaign.groups.map((group, idx) => {
                  const isExpanded = expandedGroup === group.id || expandedGroup === null;
                  return (
                    <div key={group.id || idx} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedGroup(isExpanded && expandedGroup !== null ? -1 : group.id)}
                        style={{
                          background: 'var(--bg-card-hover)',
                          padding: '14px 18px',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center' }}>
                            {idx + 1}
                          </span>
                          <div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{group.name}</h4>
                            <a
                              href={group.landing_page_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                            >
                              {group.landing_page_url} <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {group.keywords ? group.keywords.length : 0} Zoekwoorden
                          </span>
                          {isExpanded ? <ChevronDown size={16} color="var(--text-dim)" /> : <ChevronRight size={16} color="var(--text-dim)" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '18px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-color)' }}>
                          {/* Keywords */}
                          <div>
                            <h5 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              Zoekwoorden &amp; Biedingen
                            </h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                              {group.keywords && group.keywords.map((kw, kIdx) => (
                                <div
                                  key={kIdx}
                                  style={{
                                    padding: '8px 12px',
                                    background: 'var(--bg-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {kw.match_type === 'EXACT' ? `[${kw.text}]` : `"${kw.text}"`}
                                  </span>
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    €{kw.cpc_bid_eur || '2.50'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* RSA Preview */}
                          {group.copy && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <h5 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                Advertentie Koppen (Headlines max 30 tekens)
                              </h5>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                                {group.copy.headlines && group.copy.headlines.map((h, hIdx) => (
                                  <div
                                    key={hIdx}
                                    style={{
                                      padding: '6px 10px',
                                      background: 'var(--primary-light)',
                                      border: '1px solid var(--primary-border)',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: 'var(--primary-hover)',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                    title={h}
                                  >
                                    <span style={{ color: 'var(--primary)', marginRight: '4px', opacity: 0.7 }}>{hIdx + 1}.</span> {h}
                                  </div>
                                ))}
                              </div>

                              <h5 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', paddingTop: '6px' }}>
                                Advertentie Beschrijvingen (Descriptions max 90 tekens)
                              </h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {group.copy.descriptions && group.copy.descriptions.map((d, dIdx) => (
                                  <div
                                    key={dIdx}
                                    style={{
                                      padding: '8px 12px',
                                      background: 'var(--bg-main)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.8rem',
                                      color: 'var(--text-main)'
                                    }}
                                  >
                                    <strong style={{ color: 'var(--text-muted)', marginRight: '8px' }}>D{dIdx + 1}:</strong> {d}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Megaphone size={36} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Selecteer een campagne om details en ad groups te bekijken</p>
              <p style={{ fontSize: '0.8rem' }}>Of genereer direct een nieuwe campagne via een van de snel-generatoren bovenaan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
