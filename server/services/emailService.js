const axios = require('axios');
const db = require('../db');

/**
 * Service voor het versturen van e-mails via de Resend API.
 * Gebruikt de RESEND_API_KEY (overgenomen uit het fs-next project).
 */

function getResendApiKey() {
  return process.env.RESEND_API_KEY || '';
}

async function sendReportEmail({ to, subject, html, text }) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error('Geen RESEND_API_KEY gevonden in de omgevingsvariabelen (.env.local).');
  }

  const recipients = Array.isArray(to) ? to : to.split(',').map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    throw new Error('Geen geldige ontvangers opgeven voor het e-mailrapport.');
  }

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: 'FrisseStart SEO <onboarding@resend.dev>', // Standaard Resend dev/verified adres
        to: recipients,
        subject: subject || 'Wekelijkse SEO Performance Rapportage',
        html: html,
        text: text || 'Bekijk de bijgevoegde HTML e-mail voor het SEO rapport.'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (err) {
    console.error('Fout bij versturen e-mail via Resend:', err.response?.data || err.message);
    throw new Error(err.response?.data?.message || err.message);
  }
}

/**
 * Genereert een HTML e-mail rapport voor een specifiek project
 */
function buildReportHtml(projectData) {
  const { project, rankStats, crawlStats, keywords } = projectData;

  const top3Count = rankStats?.top3 || 0;
  const top10Count = rankStats?.top10 || 0;
  const totalKw = rankStats?.totalKeywords || 0;
  const improved = rankStats?.improved || 0;
  const declined = rankStats?.declined || 0;

  const topKeywordsList = (keywords || [])
    .filter(k => k.position > 0)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const rowsHtml = topKeywordsList.map(k => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e4e4e7;">${k.keyword}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e4e4e7; font-weight: bold; color: #059669;">#${k.position}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e4e4e7; color: #71717a;">${k.region || 'Nederland'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fafaf8; color: #1a1a18; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #e4e4e7; }
        .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #059669; margin: 0; font-size: 24px; }
        .stat-grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
        .stat-card { flex: 1; background: #ecfdf5; padding: 15px; border-radius: 8px; text-align: center; margin: 0 5px; }
        .stat-number { font-size: 22px; font-weight: bold; color: #059669; }
        .stat-label { font-size: 12px; color: #52525b; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { text-align: left; background: #f5f4f1; padding: 8px 12px; font-size: 13px; color: #52525b; }
        .footer { font-size: 12px; color: #71717a; text-align: center; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>FS SEO Prof. — Wekelijks Rapport</h1>
          <p style="color: #52525b; margin-top: 5px;">Project: <strong>${project.name}</strong> (${project.domain})</p>
        </div>

        <p>Hier is het automatische weekoverzicht van je zoekwoord posities op Google.nl:</p>

        <table style="width:100%; margin-bottom: 20px;">
          <tr>
            <td style="width: 25%; background:#ecfdf5; padding:12px; text-align:center; border-radius:6px;">
              <div style="font-size:20px; font-weight:bold; color:#059669;">${top3Count}</div>
              <div style="font-size:11px; color:#52525b;">Top 3</div>
            </td>
            <td style="width: 25%; background:#f0f9ff; padding:12px; text-align:center; border-radius:6px;">
              <div style="font-size:20px; font-weight:bold; color:#026aa2;">${top10Count}</div>
              <div style="font-size:11px; color:#52525b;">Top 10</div>
            </td>
            <td style="width: 25%; background:#ecfdf3; padding:12px; text-align:center; border-radius:6px;">
              <div style="font-size:20px; font-weight:bold; color:#12b76a;">+${improved}</div>
              <div style="font-size:11px; color:#52525b;">Gestegen</div>
            </td>
            <td style="width: 25%; background:#fef3f2; padding:12px; text-align:center; border-radius:6px;">
              <div style="font-size:20px; font-weight:bold; color:#f04438;">-${declined}</div>
              <div style="font-size:11px; color:#52525b;">Gedaald</div>
            </td>
          </tr>
        </table>

        <h3>Belangrijkste Zoekwoorden (Top 10):</h3>
        ${rowsHtml.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Zoekwoord</th>
                <th>Positie (Google.nl)</th>
                <th>Regio</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        ` : '<p style="color:#71717a;">Nog geen actieve zoekwoord rank data beschikbaar.</p>'}

        <div class="footer">
          Dit is een geautomatiseerd SEO rapport gegeneerd door <strong>SEO Pulse NL</strong>.<br>
          Domein: <a href="${project.domain}" style="color:#059669;">${project.domain}</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  sendReportEmail,
  buildReportHtml
};
