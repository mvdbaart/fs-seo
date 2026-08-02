import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, TrendingUp, CheckCircle2, Globe } from 'lucide-react';

export default function CompetitorGapView({ projectId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchGapData();
  }, [projectId]);

  const fetchGapData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/competitor-gap`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  if (!data) return <div className="card">Laden van Concurrentie Gap Analyse...</div>;

  const { gaps, cannibalization } = data;

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <Target size={20} color="var(--primary)" /> Concurrentie Keyword Gap & Content Cannibalisatie Detector
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Berekend uit de echte Google.nl resultaten van je laatste ranking check: zoekwoorden waarop toegevoegde concurrenten beter scoren, en eigen pagina's die elkaar beconcurreren.
        </p>
      </div>

      {data.message && (
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{data.message}</p>
        </div>
      )}

      {/* Competitor Keyword Gaps Table */}
      <div className="card">
        <h3 className="card-title">
          <TrendingUp size={20} color="var(--primary)" /> Keyword Gaps t.o.v. Concurrenten op Pagina 1
        </h3>

        <div className="table-container" style={{ marginTop: '16px' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Zoekwoord</th>
                <th>Concurrent Positie</th>
                <th>Eigen Positie</th>
                <th>Aanbevolen Actie</th>
              </tr>
            </thead>
            <tbody>
              {gaps.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Geen keyword gaps gevonden in de laatste SERP-data.
                  </td>
                </tr>
              )}
              {gaps.map((g, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{g.keyword}</td>
                  <td>
                    <span className="badge badge-info">{g.competitorName} ({g.competitorRank})</span>
                  </td>
                  <td>
                    <span className={`badge badge-${g.ownRank.startsWith('#') ? 'warning' : 'danger'}`}>{g.ownRank}</span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{g.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keyword Cannibalization Detector */}
      <div className="card">
        <h3 className="card-title" style={{ color: 'var(--warning)' }}>
          <AlertTriangle size={20} /> Gedetecteerde Content Cannibalisatie (Interne Concurrentie)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Dit treedt op wanneer 2 of meer eigen pagina's concurreren om hetzelfde zoekwoord in Google.nl.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cannibalization.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Geen cannibalisatie gedetecteerd in de laatste SERP-data.
            </p>
          )}
          {cannibalization.map((c, i) => (
            <div key={i} className="rec-card type-warning" style={{ padding: '16px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
                Zoekwoord: "{c.keyword}"
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <strong>Concurrerende Eigen URL's:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '4px', color: 'var(--primary)' }}>
                  {c.competingUrls.map((u, idx) => <li key={idx}>{u}</li>)}
                </ul>
              </div>
              <div style={{ fontSize: '0.85rem', background: 'var(--bg-main)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <strong>Oplossing:</strong> {c.issue}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
