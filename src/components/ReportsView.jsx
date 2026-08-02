import React from 'react';
import { FileText, Download, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function ReportsView({ dashboardData }) {
  if (!dashboardData) return <div className="card">Laden van rapportage gegevens...</div>;

  const { project, crawlStats, rankStats, recommendations, keywords } = dashboardData;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(99, 102, 241);
    doc.text(`SEO & Keyword Rank Report: ${project.name}`, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Website: ${project.domain} | Datum: ${new Date().toLocaleDateString('nl-NL')}`, 14, 28);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("1. Samenvatting Crawl & Rank Statistieken", 14, 40);

    doc.setFontSize(10);
    doc.text(`- Gekrawlde Pagina's: ${crawlStats.pagesCrawled || 0}`, 16, 48);
    doc.text(`- HTTP Fouten (404/500): ${crawlStats.errorsCount || 0}`, 16, 54);
    doc.text(`- Totaal Bijgehouden Keywords: ${rankStats.totalKeywords || 0}`, 16, 60);
    doc.text(`- Top 3 Rankings (Google.nl): ${rankStats.top3 || 0}`, 16, 66);
    doc.text(`- Top 10 Rankings (Google.nl): ${rankStats.top10 || 0}`, 16, 72);

    doc.setFontSize(14);
    doc.text("2. Belangrijkste Nederlandse SEO Actiepunten", 14, 86);

    let y = 96;
    (recommendations || []).forEach((rec, idx) => {
      doc.setFontSize(11);
      doc.setTextColor(rec.type === 'critical' ? 220 : 0, rec.type === 'critical' ? 30 : 0, 0);
      doc.text(`${idx + 1}. ${rec.title}`, 16, y);
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`   Actie: ${rec.action}`, 16, y);
      y += 10;
    });

    doc.save(`SEO-Rapport-${project.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Zoekwoord,Regio,Positie,Gevonden URL\n";
    (keywords || []).forEach(kw => {
      csvContent += `"${kw.keyword}","${kw.region || 'Nederland'}","${kw.position || '-'}","${kw.url_found || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Keywords-Export-${project.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Header & Export Actions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ marginBottom: '4px' }}>
              <FileText size={20} color="var(--primary)" /> Rapporten & AI Verbeteradvies
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Genereer overzichtelijke management-rapporten en geautomatiseerde verbeterpunten voor {project.name}.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              <Download size={16} /> Exporteer CSV
            </button>
            <button className="btn btn-primary" onClick={handleExportPDF}>
              <FileText size={16} /> Download PDF Rapport
            </button>
          </div>
        </div>
      </div>

      {/* AI Recommendations List */}
      <div className="card">
        <h3 className="card-title">
          <Sparkles size={20} color="var(--accent)" /> Geautomatiseerde SEO Audit Resultaten
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {(recommendations || []).map((rec, index) => (
            <div key={index} className={`rec-card type-${rec.type}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="rec-title">
                    {rec.type === 'critical' && <AlertTriangle size={16} color="var(--danger)" />}
                    {rec.type === 'warning' && <AlertTriangle size={16} color="var(--warning)" />}
                    {rec.type === 'opportunity' && <TrendingUp size={16} color="var(--accent)" />}
                    {rec.title}
                  </div>
                  <div className="rec-desc">{rec.description}</div>
                  <div className="rec-action">💡 <strong>Aanbevolen actie:</strong> {rec.action}</div>
                </div>
                <span className={`badge badge-${rec.type === 'critical' ? 'danger' : rec.type === 'warning' ? 'warning' : 'info'}`}>
                  {rec.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
