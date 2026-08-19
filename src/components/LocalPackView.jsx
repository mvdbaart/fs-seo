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
  Navigation,
  Sparkles,
  Send
} from 'lucide-react';
import AiPromptCanvas from './AiPromptCanvas';
import GbpPostStudio from './GbpPostStudio';

export default function LocalPackView({ projectId, activeProject }) {
  const [subTab, setSubTab] = useState('audit'); // 'audit' | 'posts'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  // Places rekent per aanroep af; na een handmatige verversing gaat de knop
  // even op slot zodat er niet doorgeklikt wordt.
  const [refreshLocked, setRefreshLocked] = useState(false);

  useEffect(() => {
    fetchLocalPackData();
  }, [projectId]);

  const fetchLocalPackData = async (refreshPlaces = false) => {
    setLoading(true);
    const id = projectId || 1;
    const suffix = refreshPlaces ? '?refresh=1' : '';
    try {
      const [resPack, resGbp, resPerf, resPlaces] = await Promise.all([
        fetch(`/api/projects/${id}/local-pack`),
        fetch(`/api/projects/${id}/gbp`),
        fetch(`/api/projects/${id}/gbp-performance?days=28`),
        fetch(`/api/projects/${id}/places${suffix}`)
      ]);
      setData({
        ...(await resPack.json()),
        gbp: await resGbp.json(),
        performance: await resPerf.json(),
        places: await resPlaces.json()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPlaces = () => {
    if (refreshLocked) return;
    setRefreshLocked(true);
    fetchLocalPackData(true);
    setTimeout(() => setRefreshLocked(false), 60000);
  };

  const fmtNum = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('nl-NL'));
  const fmtRating = (value) => (value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  const deltaFor = (current, previous) => {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    const delta = current - previous;
    const pct = previous !== 0 ? Math.round((delta / Math.abs(previous)) * 1000) / 10 : null;
    return { delta, pct };
  };

  const MATCH_BADGES = {
    exact: { className: 'badge badge-success', text: 'Website komt overeen' },
    domain: { className: 'badge badge-success', text: 'Website komt overeen' },
    stored: { className: 'badge badge-success', text: 'Eerder gekoppeld' },
    name: { className: 'badge badge-warning', text: 'Naam-match — controleer' }
  };

  const handleCopyReview = () => {
    if (!data?.reviewTemplate) return;
    navigator.clipboard.writeText(data.reviewTemplate);
    setCopiedReview(true);
    setTimeout(() => setCopiedReview(false), 2500);
  };

  if (!data && subTab === 'audit') return <div className="card">Laden van Google Bedrijfsprofiel & Local Pack gegevens...</div>;

  const { napInfo, localRankings, citations, actionItems, reviewTemplate } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Subtab Bar */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn ${subTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setSubTab('audit')}
        >
          <MapPin size={16} /> Google Maps & Bedrijfsprofiel Audit
        </button>
        <button
          className={`btn ${subTab === 'posts' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setSubTab('posts')}
        >
          <Sparkles size={16} /> Google Posts Studio (AI & Publiceren)
        </button>
      </div>

      {subTab === 'posts' ? (
        <GbpPostStudio projectId={projectId} activeProject={activeProject} />
      ) : (
        <>
          {/* Header Banner */}
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
            <div className="card-title">
              <MapPin size={20} color="var(--primary)" /> Google Bedrijfsprofiel & Local Pack Audit (Google Maps Top 3)
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Local pack aanwezigheid per regio op basis van de laatste regionale scan, plus een checklist voor consistente bedrijfsvermeldingen.
            </p>
          </div>

          {/* Google Bedrijfsprofiel (My Business) API Live Status Card */}
          {data?.gbp && (
            <div className="card" style={{ border: data.gbp.connected ? '1px solid var(--primary-border)' : '1px solid #fef0c7', background: data.gbp.connected ? 'var(--primary-light)' : '#fffaeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                  <Building2 size={20} color={data.gbp.connected ? 'var(--primary)' : 'var(--warning)'} /> Live Google Mijn Bedrijf Connector & Analyse
                </h3>
                <span className={`badge ${data.gbp.connected ? 'badge-success' : 'badge-warning'}`}>
                  {data.gbp.connected ? 'Bedrijfsprofiel gekoppeld' : 'Bedrijfsprofiel nog niet gekoppeld'}
                </span>
              </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            {data.gbp.connected
              ? `Je Google Bedrijfsprofiel is gekoppeld. Gezondheidsscore: ${data.gbp.profileHealthScore === null ? 'nog niet te bepalen' : `${data.gbp.profileHealthScore}/100`}.`
              : 'Koppel je bedrijfsprofiel om live statistieken, openingstijden en categorieën automatisch uit te lezen.'}
          </p>

          {!data.gbp.connected && (
            <div style={{ background: '#ffffff', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '12px', fontSize: '0.85rem' }}>
              <strong>🔑 Zo koppel je het:</strong>
              <ol style={{ marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.82rem', paddingLeft: '18px', lineHeight: 1.8 }}>
                <li>Maak in de Google Cloud Console een <strong>OAuth client ID</strong> aan van het type &ldquo;Desktop app&rdquo; en vul client ID en secret in bij Instellingen.</li>
                <li>Draai eenmalig <code>node server/oauth-setup.js gbp</code> en log in met het account dat het bedrijfsprofiel beheert.</li>
                <li>Vraag bij Google toegang aan tot de Business Profile API (formulier <em>Application for Basic API Access</em>). Zonder die goedkeuring staat je quotum op nul.</li>
              </ol>
              <p style={{ marginTop: '8px', color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: 0 }}>
                Een service account werkt hier niet: de profielgegevens zijn jouw eigendom, dus Google vraagt om jouw eigen toestemming.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>📋 Live Aanbevelingen voor je Bedrijfsprofiel:</strong>
            {data.gbp.recommendations.map((rec, i) => (
              <div key={i} style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{rec.title}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rec.description}</div>
                </div>
                <span className="badge badge-info">{rec.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistieken van het bedrijfsprofiel (Business Profile Performance API) */}
      {data.performance && (
        <div className="card">
          <h3 className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={20} color="var(--primary)" /> Statistieken van je bedrijfsprofiel
              {data.performance.locationTitle && (
                <span className="badge badge-info">{data.performance.locationTitle}</span>
              )}
            </span>
            {data.performance.connected && data.performance.lastDataDay && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Cijfers t/m {data.performance.lastDataDay}
              </span>
            )}
          </h3>

          {!data.performance.connected || !data.performance.totals ? (
            <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={16} color="var(--warning)" />
                <span className="badge badge-warning">Statistieken nog niet beschikbaar</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {data.performance.message}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                {[
                  { key: 'impressions', label: 'Profielweergaven' },
                  { key: 'calls', label: 'Telefoontjes' },
                  { key: 'directions', label: 'Routeaanvragen' },
                  { key: 'websiteClicks', label: 'Websiteklikken' },
                  { key: 'conversations', label: 'Berichten' }
                ].map(({ key, label }) => {
                  const current = data.performance.totals[key];
                  const previous = data.performance.previousTotals?.[key];
                  const change = deltaFor(current, previous);
                  // Voor al deze metrieken is meer altijd beter.
                  const color = !change || change.delta === 0
                    ? 'var(--text-dim)'
                    : change.delta > 0 ? 'var(--primary)' : 'var(--danger)';
                  return (
                    <div key={key} className="stat-card">
                      <div className="stat-header"><span>{label}</span></div>
                      <div className="stat-value">{fmtNum(current)}</div>
                      <div className="stat-subtext" style={{ color }}>
                        {change === null
                          ? 'Geen vergelijking beschikbaar'
                          : `${change.delta > 0 ? '▲ +' : change.delta < 0 ? '▼ ' : '— '}${fmtNum(Math.abs(change.delta))}${change.pct !== null ? ` (${change.delta > 0 ? '+' : '−'}${Math.abs(change.pct).toLocaleString('nl-NL')}%)` : ''}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {data.performance.breakdown && (
                <div style={{ marginTop: '14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Uitsplitsing weergaven: Maps {fmtNum(data.performance.breakdown.mapsImpressions)} ·
                  {' '}Zoeken {fmtNum(data.performance.breakdown.searchImpressions)} ·
                  {' '}mobiel {fmtNum(data.performance.breakdown.mobileImpressions)} ·
                  {' '}desktop {fmtNum(data.performance.breakdown.desktopImpressions)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Beoordelingen in Google Maps, jij versus je concurrenten (Places API) */}
      {data.places && (
        <div className="card">
          <h3 className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={20} color="var(--primary)" /> Hoe scoor je in Google Maps?
            </span>
            {data.places.connected && (
              <button
                className="btn btn-secondary"
                onClick={handleRefreshPlaces}
                disabled={refreshLocked || loading}
                title="Haalt de cijfers opnieuw op bij Google (één keer per dag is genoeg)"
              >
                {refreshLocked ? 'Zojuist ververst' : 'Vernieuwen'}
              </button>
            )}
          </h3>

          {!data.places.connected || !data.places.own ? (
            <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{data.places.message}</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Bedrijf</th>
                      <th>Score</th>
                      <th>Reviews</th>
                      <th>Verschil</th>
                      <th>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: 'var(--primary-light)', fontWeight: 600 }}>
                      <td>
                        {data.places.own.mapsUri ? (
                          <a href={data.places.own.mapsUri} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                            {data.places.own.name}
                          </a>
                        ) : data.places.own.name}
                      </td>
                      <td>⭐ {fmtRating(data.places.own.rating)}</td>
                      <td>{fmtNum(data.places.own.reviewCount)}</td>
                      <td>—</td>
                      <td><span className="badge badge-info">Jij</span></td>
                    </tr>
                    {data.places.competitors.map((c) => {
                      const badge = MATCH_BADGES[c.confidence] || MATCH_BADGES.name;
                      const gap = (typeof data.places.own.rating === 'number' && typeof c.rating === 'number')
                        ? Math.round((data.places.own.rating - c.rating) * 10) / 10
                        : null;
                      return (
                        <tr key={c.id}>
                          <td>
                            {c.mapsUri ? (
                              <a href={c.mapsUri} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{c.name}</a>
                            ) : c.name}
                          </td>
                          <td>⭐ {fmtRating(c.rating)}</td>
                          <td>{fmtNum(c.reviewCount)}</td>
                          <td style={{ color: gap === null ? 'var(--text-dim)' : gap >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                            {gap === null ? '—' : `${gap >= 0 ? '+' : '−'}${fmtRating(Math.abs(gap))}`}
                          </td>
                          <td><span className={badge.className}>{badge.text}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {data.places.unmatched?.length > 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                  Niet teruggevonden in Google Maps: {data.places.unmatched.map((u) => u.name).join(', ')} — controleer de
                  bedrijfsnaam of het domein bij Concurrenten.
                </p>
              )}

              {data.places.fetchedDay && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                  Cijfers opgehaald op {data.places.fetchedDay}
                  {data.places.fromCache ? ' (uit de opgeslagen meting van vandaag)' : ''}.
                </p>
              )}
            </>
          )}
        </div>
      )}

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

      {/* Actieplan & AI Prompt Canvas voor Google Maps Top 3 */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 className="card-title" style={{ color: 'var(--primary)' }}>
          🚀 Stappenplan: Hoe kom je wél in de Google Maps Top 3 (Local Pack)?
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px' }}>
          Omdat je organisch al op #1 staat, is de stap naar het Google Maps kaartje heel dichtbij. Google gebruikt 4 specifieke pijlers om je bedrijf in de Maps Top 3 te plaatsen:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>1. Google Reviews met Zoekwoorden & Locatie</strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Vraag tevreden cursisten om in hun review expliciet de dienst + plaats te noemen (bijv. <em>"Top heftruckcursus gevolgd bij FrisseStart in Geldrop!"</em>). Google's algoritme leest de woorden in reviews om je te matchen.
            </p>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>2. Google Bedrijfsprofiel Categorieën & Posts</strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Zorg dat je hoofdcategorie in Google Bedrijfsprofiel staat op <strong>"Opleidingscentrum"</strong> of <strong>"Rijschool"</strong>, met secundaire categorieën zoals <em>"Veiligheidsadviseur"</em>. Plaats elke maand 1 korte update-post op je profiel.
            </p>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>3. Identieke NAP-gegevens op Top 10 Citations</strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Vul je Naam, Adres en Telefoonnummer (NAP) exact identiek in op <strong>De Telefoongids, Telefoonboek.nl, Drimble en Bing Places</strong>. Als adres/telefoonnummer overal matchen, stijgt het vertrouwen van Google.
            </p>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>4. LocalBusiness Schema Markup op de Website</strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Voeg de geautomatiseerde <code>LocalBusiness</code> JSON-LD code (uit de tab <strong>Schema.org Generator</strong>) toe aan de homepage van frissestart.nl om je fysieke adres direct te koppelen aan je domein.
            </p>
          </div>
        </div>
      </div>

      <AiPromptCanvas
        title="AI Prompt: Google Maps Top 3 & Local Pack Optimalisatie"
        promptText={`Je bent een Senior Local SEO & Google Maps Specialist. Ons bedrijf ${napInfo?.name || 'FrisseStart'} (${activeProject?.domain || 'frissestart.nl'}) staat organisch al op #1 in Google.nl, maar we verschijnen nog niet in de Google Maps 3-Pack (Local Pack) voor onze regio's (${(localRankings || []).map(r => r.city).join(', ')}).\n\nHuidige NAP Gegevens:\n- Bedrijfsnaam: ${napInfo?.name || 'FrisseStart'}\n- Adres: ${napInfo?.address || 'Nuenen'}\n- Telefoonnummer: ${napInfo?.phone || ''}\n\nOpdracht:\n1. Schrijf een strategie om het Google Bedrijfsprofiel (voormalig Google Mijn Bedrijf) optimaal in te richten met de juiste hoofdcategorie en secundaire categorieën voor heftruck-, reachtruck- en veiligheidscursussen.\n2. Schrijf 3 wervende updates/posts die we wekelijks kunnen plaatsen op ons Google Bedrijfsprofiel met lokale zoekwoorden.\n3. Schrijf 5 voorbeelden van reviews met lokale zoekwoorden die we als inspiratie naar cursisten kunnen sturen.`}
      />
        </>
      )}
    </div>
  );
}
