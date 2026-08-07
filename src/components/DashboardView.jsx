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
  ExternalLink
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function DashboardView({ data, onCrawlClick, onRankClick, onPageSpeedClick }) {
  const [trendData, setTrendData] = useState([]);
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
              ? `Core Web Vitals LCP: ${pageSpeed.lcp || 'onbekend'}`
              : 'Nog niet gemeten — draai een PageSpeed audit'}
          </div>
        </div>

        <div className="stat-card">
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
          <div className="card-title">
            <ShieldCheck size={20} color="var(--primary)" /> AI SEO Actiepunten
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className={`rec-card type-${rec.type}`} style={{ padding: '12px 14px' }}>
                <div className="rec-title" style={{ fontSize: '0.9rem' }}>
                  {rec.type === 'critical' && <AlertTriangle size={14} color="var(--danger)" />}
                  {rec.type === 'warning' && <AlertTriangle size={14} color="var(--warning)" />}
                  {rec.type === 'opportunity' && <TrendingUp size={14} color="var(--primary)" />}
                  {rec.title}
                </div>
                <div className="rec-desc" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                  {rec.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
