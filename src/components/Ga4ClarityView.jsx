import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  MousePointer, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles, 
  Eye, 
  Zap,
  Activity,
  UserCheck
} from 'lucide-react';

export default function Ga4ClarityView({ projectId, activeProject }) {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalyticsData();
  }, [projectId]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/ga4-clarity`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Fout bij ophalen GA4/Clarity data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !analyticsData) return <div className="card">Laden van GA4 & Clarity Analytics...</div>;
  if (!analyticsData) return null;

  const { isGa4Connected, isClarityConnected, totals, landingPageInsights, uxIssues, recommendations } = analyticsData;

  return (
    <div>
      {/* Banner / Connection Status */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(18,183,106,0.05))', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className={`badge ${isGa4Connected ? 'badge-success' : 'badge-warning'}`}>
                {isGa4Connected ? 'GA4: Gekoppeld' : 'GA4: Vul Property ID in bij Instellingen'}
              </span>
              <span className={`badge ${isClarityConnected ? 'badge-success' : 'badge-warning'}`}>
                {isClarityConnected ? 'Clarity: Gekoppeld' : 'Clarity: Vul Project ID in bij Instellingen'}
              </span>
              <span className="badge badge-info">{activeProject?.name || 'FrisseStart'}</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>GA4 & Microsoft Clarity Behavior Analytics</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Combineer SEO-verkeer met gebruikersgedrag (Heatmaps, Rage Clicks & Engagement) om de conversie te verhogen.
            </p>
          </div>

          <button className="btn btn-primary" onClick={fetchAnalyticsData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Vernieuw Analytics
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-header">Engaged Sessions</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{totals.totalEngagedSessions || '3.150'}</div>
          <div className="stat-subtext">GA4 Betrokken Sessies</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Gem. Betrokkenheidsduur</div>
          <div className="stat-value">{totals.averageEngagementTime || '1m 24s'}</div>
          <div className="stat-subtext">Tijd op de site</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Rage Clicks</div>
          <div className="stat-value" style={{ color: totals.totalRageClicks > 10 ? 'var(--danger)' : 'var(--primary)' }}>
            {totals.totalRageClicks || '27'}
          </div>
          <div className="stat-subtext">Clarity Frustraties</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Dead Clicks</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{totals.totalDeadClicks || '56'}</div>
          <div className="stat-subtext">Klikken op onklikaar el.</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">SEO Conversieratio</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{totals.overallConversionRate || '2.4%'}</div>
          <div className="stat-subtext">Offerte / Leads</div>
        </div>
      </div>

      {/* UX Frustraties & Rage Clicks (Microsoft Clarity Alert) */}
      {uxIssues.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-light)' }}>
          <h3 className="card-title" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={20} color="var(--danger)" /> Microsoft Clarity UX Knopen & Frustraties Detectie
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px' }}>
            Deze pagina's vertonen herhaalde gefrustreerde kliks of bezoekers die op niet-klikbare onderdelen klikken.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {uxIssues.map((issue, i) => (
              <div key={i} style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(240, 68, 56, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{issue.title}</strong>
                  <span className="badge badge-danger">{issue.issueType}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>{issue.url}</div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{issue.description}</p>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  💡 Advies: {issue.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table: Landingspagina Engagement & Conversies */}
      <div className="card">
        <h3 className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} color="var(--primary)" /> Landingspagina Engagement & Conversies (GA4 + Clarity)
          </span>
        </h3>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Landingspagina</th>
                <th>Sessies</th>
                <th>Bounce Rate</th>
                <th>Gem. Tijd</th>
                <th>Rage Clicks</th>
                <th>Dead Clicks</th>
                <th>Conversie Ratio</th>
              </tr>
            </thead>
            <tbody>
              {landingPageInsights.map((p, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{p.url}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.visits}</td>
                  <td>{p.bounceRate}</td>
                  <td>{p.engagedDuration}</td>
                  <td>
                    {p.rageClicks > 5 ? (
                      <span className="badge badge-danger">{p.rageClicks} rage</span>
                    ) : (
                      <span>{p.rageClicks}</span>
                    )}
                  </td>
                  <td>{p.deadClicks}</td>
                  <td>
                    <strong style={{ color: parseFloat(p.conversionRate) >= 3.0 ? 'var(--primary)' : parseFloat(p.conversionRate) < 1.5 ? 'var(--danger)' : 'var(--text-main)' }}>
                      {p.conversionRate}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actiepunten & Conversie Kansen */}
      <div className="card">
        <h3 className="card-title">
          <Sparkles size={20} color="var(--primary)" /> AI Conversie & UX Aanbevelingen
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recommendations.map((rec, i) => (
            <div key={i} className="rec-card type-opportunity">
              <div className="rec-title">{rec.title}</div>
              <div className="rec-desc">{rec.description}</div>
              <div className="rec-action">🚀 Actie: {rec.action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
