const db = require('../db');
const ga4Client = require('./ga4Client');
const { buildWindows } = require('./insightsEngine');

/**
 * GA4-cijfers per landingspagina, met conversie- en UX-advies dat volledig uit
 * de echte meetdata volgt.
 *
 * Microsoft Clarity heeft géén automatische koppeling in deze tool: de Data
 * Export API vraagt een token dat hier niet beheerd wordt. Rage clicks en dead
 * clicks worden daarom niet gerapporteerd — in plaats van verzonnen aantallen
 * krijg je een doorklik naar het Clarity dashboard zelf.
 */

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function getProject(projectId) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

function pct(value) {
  if (value === null || value === undefined) return null;
  return `${value.toFixed(1)}%`;
}

/**
 * Advies uitsluitend op basis van gemeten cijfers. Elke drempel is expliciet,
 * zodat een aanbeveling altijd te herleiden is tot de getallen in de tabel.
 */
function buildGa4Recommendations(landingPages, totals) {
  const recommendations = [];

  if (landingPages.length === 0) {
    recommendations.push({
      type: 'info',
      title: 'Nog geen Analytics-data',
      description: 'Er zijn nog geen landingspagina\'s met organisch verkeer gemeten in deze periode.',
      action: 'Controleer of het GA4 Property ID klopt en of het service account leesrechten heeft op de property'
    });
    return recommendations;
  }

  const siteConversionRate = totals.sessions > 0 && totals.keyEvents !== null
    ? (totals.keyEvents / totals.sessions) * 100
    : null;

  for (const page of landingPages) {
    // Veel verkeer, weinig conversie: het verlies zit op de pagina zelf.
    if (siteConversionRate !== null && page.sessions >= 100 && page.keyEvents !== null) {
      const pageRate = (page.keyEvents / page.sessions) * 100;
      if (pageRate < siteConversionRate * 0.5) {
        recommendations.push({
          type: 'conversion_boost',
          title: `Veel bezoek, weinig conversie op ${page.path}`,
          description: `Deze pagina trok ${page.sessions} organische bezoekers maar converteerde ${pageRate.toFixed(1)}%, tegenover ${siteConversionRate.toFixed(1)}% gemiddeld op de site.`,
          action: 'Zet een duidelijke call-to-action boven de vouw en haal afleiding rond het formulier weg'
        });
      }
    }

    // Hoge bounce bij substantieel verkeer: de pagina beantwoordt de zoekvraag niet.
    if (page.sessions >= 100 && page.bounceRate >= 70) {
      recommendations.push({
        type: 'conversion_boost',
        title: `${pct(page.bounceRate)} van de bezoekers haakt direct af op ${page.path}`,
        description: `Van de ${page.sessions} bezoekers vertrekt het grootste deel zonder iets te doen. Dat wijst erop dat de pagina niet het antwoord geeft waarop mensen zochten.`,
        action: 'Zet het antwoord op de zoekvraag in de eerste alinea, boven de vouw'
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'info',
      title: 'Geen conversieknelpunten gevonden',
      description: `Over ${landingPages.length} landingspagina's zijn geen pagina's met een opvallend lage conversie of hoge bounce gemeten.`,
      action: 'Bekijk de heatmaps in Clarity om te zien waar bezoekers vastlopen'
    });
  }

  return recommendations.slice(0, 8);
}

async function getGa4ClarityAnalytics(projectId, days = 28) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');

  const windows = buildWindows(days);
  const ga4 = await ga4Client.getGa4Summary(project, windows);

  const clarityProjectId = getSetting('clarity_project_id') || null;

  const landingPages = (ga4.landingPages || []).map((page) => ({
    url: page.path,
    path: page.path,
    sessions: page.sessions,
    engagedSessions: page.engagedSessions,
    bounceRate: pct(page.bounceRate),
    engagedDuration: fmtDuration(page.averageSessionDuration),
    keyEvents: page.keyEvents,
    conversionRate: (page.keyEvents !== null && page.sessions > 0)
      ? pct((page.keyEvents / page.sessions) * 100)
      : null
  }));

  const totals = ga4.connected
    ? {
      totalSessions: ga4.totals.sessions,
      totalEngagedSessions: ga4.totals.engagedSessions,
      averageEngagementTime: fmtDuration(ga4.totals.averageSessionDuration),
      bounceRate: pct(ga4.totals.bounceRate),
      keyEvents: ga4.totals.keyEvents,
      overallConversionRate: (ga4.totals.keyEvents !== null && ga4.totals.sessions > 0)
        ? pct((ga4.totals.keyEvents / ga4.totals.sessions) * 100)
        : null
    }
    : {
      totalSessions: null,
      totalEngagedSessions: null,
      averageEngagementTime: null,
      bounceRate: null,
      keyEvents: null,
      overallConversionRate: null
    };

  const previousTotals = ga4.connected && ga4.previousTotals
    ? {
      totalSessions: ga4.previousTotals.sessions,
      totalEngagedSessions: ga4.previousTotals.engagedSessions,
      bounceRate: pct(ga4.previousTotals.bounceRate),
      keyEvents: ga4.previousTotals.keyEvents
    }
    : null;

  return {
    isGa4Connected: ga4.connected,
    // Clarity kent geen automatische koppeling; het project-ID dient alleen
    // om vanuit deze tool naar het juiste dashboard te kunnen doorklikken.
    isClarityConnected: false,
    ga4PropertyId: ga4.propertyId,
    clarityProjectId,
    clarityUrl: clarityProjectId
      ? `https://clarity.microsoft.com/projects/view/${clarityProjectId}`
      : null,
    clarityMessage: clarityProjectId
      ? 'Microsoft Clarity heeft geen automatische koppeling in deze tool. Bekijk rage clicks, dead clicks en heatmaps in het Clarity dashboard zelf.'
      : 'Vul je Clarity Project ID in bij Instellingen om vanaf hier door te kunnen klikken naar je heatmaps en session replays.',
    period: windows,
    totals,
    previousTotals,
    landingPageInsights: landingPages,
    recommendations: ga4.connected ? buildGa4Recommendations(ga4.landingPages || [], ga4.totals) : [],
    serviceAccountEmail: ga4.serviceAccountEmail,
    channelWarning: ga4.channelWarning || null,
    message: ga4.connected ? null : ga4.message
  };
}

module.exports = {
  getGa4ClarityAnalytics
};
