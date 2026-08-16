import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ShieldCheck,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import AiPromptCanvas from './AiPromptCanvas';

const SOURCE_LABELS = {
  gsc: 'Search Console',
  ga4: 'Analytics',
  gbp: 'Bedrijfsprofiel',
  places: 'Google Maps',
  rankings: 'Rankings',
  pagespeed: 'PageSpeed',
  crawl: 'Crawl'
};

const TAB_LABELS = {
  crawler: 'On-Page Crawler',
  rankings: 'Rank Tracker',
  pagespeed: 'PageSpeed Insights',
  geo: 'Regio GEO Analyse',
  topicclusters: 'Topic Clusters & Pillars',
  internallinks: 'Interne Link Matrix',
  singlepage: 'Single Page Doctor',
  gsc: 'Search Console',
  ga4clarity: 'GA4 & Clarity Analytics',
  contentoptimizer: 'Content Optimizer'
};

export default function DashboardView({ data, onNavigateTab, onCrawlClick, onRankClick, onPageSpeedClick }) {
  const [trendData, setTrendData] = useState([]);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightDays, setInsightDays] = useState(28);
  const projectId = data?.project?.id;

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/rankings-history?days=30`)
      .then(res => res.json())
      .then(rows => {
        if (Array.isArray(rows)) {
          setTrendData(rows.map(r => ({
            day: r.day.slice(5), // 'MM-DD'
            top3: r.top3,
            top10: r.top10,
            avgPosition: r.avgPosition
          })));
        }
      })
      .catch(err => console.error('Fout bij ophalen ranking historie:', err));
  }, [projectId]);

  const loadInsights = (days, refresh = false) => {
    if (!projectId) return;
    setInsightsLoading(true);
    fetch(`/api/projects/${projectId}/insights?days=${days}${refresh ? '&refresh=1' : ''}`)
      .then(res => res.json())
      .then(result => {
        // Bij een fout niets tonen: liever geen verhaal dan een verzonnen verhaal.
        setInsights(result && !result.error ? result : null);
      })
      .catch(err => {
        console.error('Fout bij ophalen inzichten:', err);
        setInsights(null);
      })
      .finally(() => setInsightsLoading(false));
  };

  useEffect(() => {
    loadInsights(insightDays);
  }, [projectId, insightDays]);

  if (!data || !data.project) {
    return (
      <div className="card">
        <h3>Laden van dashboard gegevens...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
          Selecteer een geldig project of voeg een nieuw project toe in Instellingen.
        </p>
      </div>
    );
  }

  const { project, crawlStats = {}, rankStats = {}, pageSpeed, recommendations = [], keywords = [] } = data;

  const handleRecClick = (rec) => {
    const targetTab = rec.targetTab || 'crawler';
    const targetFilter = rec.targetFilter || 'all';
    if (onNavigateTab) {
      onNavigateTab(targetTab, targetFilter);
    } else if (targetTab === 'rankings' && onRankClick) {
      onRankClick();
    } else if (targetTab === 'pagespeed' && onPageSpeedClick) {
      onPageSpeedClick();
    } else if (onCrawlClick) {
      onCrawlClick();
    }
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-success">Google.nl</span>
              <span className="badge badge-info">Regio: Nederland</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Laatst bijgewerkt: zojuist</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{project.name}</h2>
            <a href={project.domain} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
              {project.domain} <ExternalLink size={14} />
            </a>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onCrawlClick}>
              <Globe size={16} /> Crawl Website
            </button>
            <button className="btn btn-primary" onClick={onRankClick}>
              <Search size={16} /> Check Rankings
            </button>
          </div>
        </div>
      </div>

      {/* Inzichten & Advies: wat ging beter, wat ging minder */}
      {insights && (
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
          <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lightbulb size={20} color="var(--primary)" /> Hoe staat je website ervoor?
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="filter-tabs" style={{ margin: 0 }}>
                {[7, 28, 90].map(d => (
                  <button
                    key={d}
                    className={`tab-btn ${insightDays === d ? 'active' : ''}`}
                    onClick={() => setInsightDays(d)}
                  >
                    {d} dagen
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => loadInsights(insightDays, true)}
                disabled={insightsLoading}
                title="Opnieuw ophalen bij Google"
              >
                <RefreshCw size={14} style={insightsLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                Vernieuwen
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {Object.entries(insights.sources || {}).map(([key, source]) => (
              <span
                key={key}
                className={`badge ${source.connected && source.comparable ? 'badge-success' : source.connected ? 'badge-info' : 'badge-warning'}`}
                title={source.message || ''}
              >
                {SOURCE_LABELS[key] || key}: {source.connected ? (source.comparable ? 'gekoppeld' : 'nog geen vergelijking') : 'niet gekoppeld'}
              </span>
            ))}
          </div>

          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
            {insights.headline}
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Periode: {insights.period?.label} — {insights.period?.comparisonLabel}
          </div>
        </div>
      )}

      {insights && (insights.good?.length > 0 || insights.bad?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="card">
            <div className="card-title">
              <TrendingUp size={20} color="var(--primary)" /> Wat gaat goed
            </div>
            {insights.good.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Geen noemenswaardige verbeteringen in deze periode.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {insights.good.map((item, i) => (
                  <div key={i} className="rec-card type-opportunity" style={{ padding: '12px 14px' }}>
                    <div className="rec-desc" style={{ fontSize: '0.85rem', margin: 0 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <TrendingDown size={20} color="var(--danger)" /> Wat gaat minder
            </div>
            {insights.bad.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Geen achteruitgang gemeten in deze periode.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {insights.bad.map((item, i) => (
                  <div key={i} className="rec-card type-critical" style={{ padding: '12px 14px' }}>
                    <div className="rec-desc" style={{ fontSize: '0.85rem', margin: 0 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card" onClick={onCrawlClick} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span>Pagina's Gekrawld</span>
            <div className="stat-icon-wrapper" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Globe size={20} />
            </div>
          </div>
          <div className="stat-value">{crawlStats.pagesCrawled || 0}</div>
          <div className="stat-subtext">
            {crawlStats.errorsCount > 0 ? (
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {crawlStats.errorsCount} fouten gevonden</span>
            ) : (
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>✓ Geen 404/500 fouten</span>
            )}
          </div>
        </div>

        <div className="stat-card" onClick={onRankClick} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span>Google.nl Top 3 Rankings</span>
            <div className="stat-icon-wrapper" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-value">{rankStats.top3 || 0}</div>
          <div className="stat-subtext">
            <span style={{ color: 'var(--primary)' }}>{rankStats.improved || 0} gestegen</span> · Top 10: {rankStats.top10 || 0} keywords
          </div>
        </div>

        <div className="stat-card" onClick={onPageSpeedClick} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span>Mobiele PageSpeed</span>
            <div className="stat-icon-wrapper" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <Zap size={20} />
            </div>
          </div>
          <div className="stat-value">
            {pageSpeed ? `${pageSpeed.performance_score}/100` : '—'}
          </div>
          <div className="stat-subtext">
            {pageSpeed
              ? `Core Web Vitals LCP: ${pageSpeed.lcp || '—'}`
              : 'Nog geen audit uitgevoerd'}
          </div>
        </div>

        <div className="stat-card" onClick={() => onNavigateTab ? onNavigateTab('reports') : null} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span>Kritieke SEO Punten</span>
            <div className="stat-icon-wrapper" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: recommendations.filter(r => r.type === 'critical').length > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {recommendations.filter(r => r.type === 'critical').length}
          </div>
          <div className="stat-subtext">
            {recommendations.length} totaal adviezen
          </div>
        </div>
      </div>

      {/* Grid: Charts & AI Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column: Ranking Trend */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={20} color="var(--primary)" /> Ranking Verloop (Google.nl)
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Afgelopen 30 Dagen</span>
          </div>

          {trendData.length < 2 ? (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '0 24px' }}>
              Nog onvoldoende historie voor een trendlijn. Voer dagelijks een ranking check uit — of zet de automatische dagelijkse check aan bij Instellingen.
            </div>
          ) : (
          <div style={{ height: '260px', width: '100%', marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorTop3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTop10" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f18b1a" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f18b1a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#71717a" />
                <YAxis stroke="#71717a" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="top3" stroke="#059669" fillOpacity={1} fill="url(#colorTop3)" name="Top 3 Keywords" />
                <Area type="monotone" dataKey="top10" stroke="#f18b1a" fillOpacity={1} fill="url(#colorTop10)" name="Top 10 Keywords" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        {/* Right Column: AI Action List */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="var(--primary)" /> AI SEO Actiepunten
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Direct Koppelbaar</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recommendations.map((rec, i) => {
              const targetTab = rec.targetTab || 'crawler';
              const targetLabel = TAB_LABELS[targetTab] || 'Bekijk details';

              return (
                <div 
                  key={i} 
                  className={`rec-card type-${rec.type} rec-card-interactive`} 
                  style={{ padding: '12px 14px', marginBottom: 0 }}
                  onClick={() => handleRecClick(rec)}
                  title={`Klik om direct naar de ${targetLabel} pagina te gaan voor deze bevinding`}
                >
                  <div className="rec-title" style={{ fontSize: '0.9rem', marginBottom: '6px' }}>
                    {rec.type === 'critical' && <AlertTriangle size={14} color="var(--danger)" />}
                    {rec.type === 'warning' && <AlertTriangle size={14} color="var(--warning)" />}
                    {rec.type === 'opportunity' && <TrendingUp size={14} color="var(--primary)" />}
                    {rec.title}
                  </div>
                  <div className="rec-desc" style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
                    {rec.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: '4px' }}>
                      📍 {targetLabel}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Bekijk bevindingen <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              );
            })}

            {recommendations.length > 3 && (
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '4px', fontSize: '0.82rem' }}
                onClick={() => onNavigateTab ? onNavigateTab('reports') : null}
              >
                Bekijk Alle {recommendations.length} Rapporten & Adviezen <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grootste stijgers & dalers uit Search Console */}
      {insights && hasMovers(insights.movers) && (
        <div className="card">
          <div className="card-title">
            <BarChart2 size={20} color="var(--primary)" /> Grootste stijgers &amp; dalers
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Zoekwoord / pagina</th>
                  <th>Klikken</th>
                  <th>Positie</th>
                  <th>Verschil</th>
                </tr>
              </thead>
              <tbody>
                {collectMovers(insights.movers).map((m, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: '320px', wordBreak: 'break-word' }}>{m.key}</td>
                    <td>{m.prevClicks} → {m.clicks}</td>
                    <td>{m.prevPosition !== null && m.position !== null ? `${m.prevPosition} → ${m.position}` : '—'}</td>
                    <td>
                      <span className={`badge ${m.clicksDelta >= 0 ? 'badge-success' : 'badge-danger'}`}>
                        {m.clicksDelta >= 0 ? '+' : ''}{m.clicksDelta} klikken
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advies op basis van wat er veranderde */}
      {insights && insights.advice?.length > 0 && (
        <div className="card">
          <div className="card-title">
            <ShieldCheck size={20} color="var(--primary)" /> Wat je nu het beste kunt doen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.advice.map((item, i) => (
              <div key={i} className={`rec-card type-${item.type}`}>
                <div className="rec-title">
                  {item.type === 'critical' && <AlertTriangle size={14} color="var(--danger)" />}
                  {item.type === 'warning' && <AlertTriangle size={14} color="var(--warning)" />}
                  {item.type === 'opportunity' && <TrendingUp size={14} color="var(--primary)" />}
                  {item.title}
                </div>
                <div className="rec-desc">{item.description}</div>
                <div className="rec-action">🚀 Actie: {item.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wat we (nog) niet kunnen meten */}
      {insights && insights.watch?.length > 0 && (
        <div className="card">
          <div className="card-title">
            <AlertTriangle size={20} color="var(--warning)" /> Wat we nog niet kunnen meten
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {insights.watch.map((item, i) => (
              <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-main)' }}>{item.title}:</strong> {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {insights && insights.aiPrompt && (
        <AiPromptCanvas
          title="AI: leg dit uit in gewone taal"
          promptId="insights_narrative"
          subtitle="Laat een AI dit verhaal herschrijven in jouw communicatiestijl — of kopieer de opdracht naar ChatGPT / Claude / Gemini."
          promptText={insights.aiPrompt}
        />
      )}
    </div>
  );
}

function collectMovers(movers = {}) {
  const groups = [movers.gscQueries, movers.gscPages];
  const rows = [];
  for (const group of groups) {
    if (!group) continue;
    rows.push(...(group.winners || []), ...(group.losers || []));
  }
  return rows
    .sort((a, b) => Math.abs(b.clicksDelta) - Math.abs(a.clicksDelta))
    .slice(0, 10);
}

function hasMovers(movers) {
  return collectMovers(movers).length > 0;
}
