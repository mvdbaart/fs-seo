import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Star, 
  Building2, 
  Share2, 
  Phone, 
  Navigation
} from 'lucide-react';

export default function LocalPackView({ projectId, activeProject }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);

  useEffect(() => {
    fetchLocalPackData();
  }, [projectId]);

  const fetchLocalPackData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/local-pack`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReview = () => {
    if (!data?.reviewTemplate) return;
    navigator.clipboard.writeText(data.reviewTemplate);
    setCopiedReview(true);
    setTimeout(() => setCopiedReview(false), 2500);
  };

  if (!data) return <div className="card">Laden van Google Bedrijfsprofiel & Local Pack gegevens...</div>;

  const { napInfo, localRankings, citations, actionItems, reviewTemplate } = data;

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <MapPin size={20} color="var(--primary)" /> Google Bedrijfsprofiel & Local Pack Audit (Google Maps Top 3)
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Local pack aanwezigheid per regio op basis van de laatste regionale scan, plus een checklist voor consistente bedrijfsvermeldingen.
        </p>
      </div>

      {/* NAP Consistency Check */}
      <div className="card">
        <h3 className="card-title">
          <Building2 size={20} color="var(--primary)" /> NAP Consistentie (Naam, Adres, Telefoon)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '16px' }}>
          <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bedrijfsnaam</span>
            <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.95rem' }}>{napInfo.name}</div>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Locatie Adres</span>
            <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.95rem' }}>{napInfo.address}</div>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telefoonnummer</span>
            <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.95rem' }}>{napInfo.phone}</div>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>NAP-gegevens</span>
            <div style={{ fontWeight: 700, marginTop: '4px', color: napInfo.napConfigured ? 'var(--primary)' : 'var(--warning)', fontSize: '0.95rem' }}>
              {napInfo.napConfigured ? '✓ Volledig ingevuld' : 'Onvolledig — vul in bij Instellingen'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Google Maps Rankings & Citations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Local Rankings per City */}
        <div className="card">
          <h3 className="card-title">
            <Navigation size={20} color="var(--primary)" /> Google Maps Rankings per Regio
          </h3>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            De onderstaande tabel toont je <strong>beste organische positie</strong> in Google.nl voor jouw gemonitorde zoekwoorden per regio, en of je bedrijf getoond wordt in het <strong>Google Maps 3-pack</strong>.
          </p>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Stad / Regio</th>
                  <th>Local Pack Vermeldingen</th>
                  <th>Beste Positie / Gem.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {localRankings.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      Nog geen regionale scan uitgevoerd. Start een scan via de GEO Analyse tab.
                    </td>
                  </tr>
                )}
                {localRankings.map((lr, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{lr.city}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: lr.localPackCount > 0 ? 'var(--primary)' : 'var(--warning)' }}>
                        {lr.localPackCount === null ? '—' : `${lr.localPackCount} van ${lr.totalKeywords} zoekwoorden`}
                      </span>
                    </td>
                    <td>
                      {lr.bestOrganic ? (
                        <span>
                          <strong style={{ color: 'var(--primary)' }}>#{lr.bestOrganic}</strong>
                          {lr.avgOrganic && <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginLeft: '6px' }}>(Gem. #{lr.avgOrganic})</span>}
                        </span>
                      ) : 'Niet in Top 100'}
                    </td>
                    <td>
                      <span className={`badge badge-${lr.status === 'In Local Pack' ? 'success' : 'warning'}`}>
                        {lr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Local Citations Check */}
        <div className="card">
          <h3 className="card-title">
            <Share2 size={20} color="var(--primary)" /> Lokale Bedrijfsvermeldingen (Citations)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Controleer handmatig of de bedrijfsgegevens (NAP) overal identiek zijn:
            </p>
            {citations.map((c, i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{c.source}</strong>
                  {c.category && (
                    <span className="badge badge-info" style={{ marginLeft: '8px', fontSize: '0.68rem' }}>
                      {c.category}
                    </span>
                  )}
                </div>
                <a href={c.checkUrl} target="_blank" rel="noreferrer" className="badge badge-success" style={{ textDecoration: 'none' }}>
                  Controleer / Registreer →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Booster Template Card */}
      <div className="card" style={{ border: '1px solid var(--primary-border)', background: 'var(--primary-light)', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
              <Star size={20} /> Review Booster Berichtsjabloon voor Cursisten
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Stuur dit bericht naar tevreden klanten om 5-sterren Google reviews te verzamelen.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleCopyReview}>
            {copiedReview ? <Check size={16} /> : <Copy size={16} />} {copiedReview ? 'Gekopieerd' : 'Kopieer Berichtsjabloon'}
          </button>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-main)' }}>
          {reviewTemplate}
        </div>
      </div>
    </div>
  );
}
