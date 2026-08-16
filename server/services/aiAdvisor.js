const db = require('../db');

/**
 * SEO Advisory Engine: genereert aanbevelingen op basis van echte projectdata
 * (laatste crawl, live rankings, PageSpeed audits en GEO-resultaten).
 */
function generateSeoRecommendations(projectId) {
  const recommendations = [];

  // --- Crawl-gebaseerde technische aanbevelingen ---
  const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
  if (lastSession) {
    const pages = db.prepare('SELECT * FROM crawled_pages WHERE session_id = ?').all(lastSession.id);
    const errorPages = pages.filter(p => p.status_code >= 400);
    const missingTitles = pages.filter(p => p.status_code < 400 && (!p.title || p.title.trim() === ''));
    const missingMeta = pages.filter(p => p.status_code < 400 && (!p.meta_description || p.meta_description.trim() === ''));
    const missingH1 = pages.filter(p => p.status_code < 400 && p.h1_count === 0);
    const multipleH1 = pages.filter(p => p.h1_count > 1);
    const thinContent = pages.filter(p => p.status_code < 400 && p.word_count > 0 && p.word_count < 300);
    const missingAlt = pages.filter(p => p.images_missing_alt > 0);
    const slowPages = pages.filter(p => p.load_time_ms > 3000);

    if (errorPages.length > 0) {
      recommendations.push({
        type: 'critical',
        targetTab: 'crawler',
        targetFilter: 'errors',
        title: `${errorPages.length} pagina('s) met een foutstatus (4xx/5xx) gevonden`,
        description: `Bijvoorbeeld: ${errorPages.slice(0, 3).map(p => p.url).join(', ')}. Foutpagina's verspillen crawlbudget en verliezen linkwaarde.`,
        action: 'Herstel of redirect (301) deze URL\'s en werk interne links bij'
      });
    }

    if (missingTitles.length > 0 || missingMeta.length > 0) {
      recommendations.push({
        type: 'critical',
        targetTab: 'crawler',
        targetFilter: missingTitles.length > 0 ? 'missing_title' : 'missing_meta',
        title: `${missingTitles.length} pagina('s) zonder title en ${missingMeta.length} zonder meta description`,
        description: `Ontbrekende titles en descriptions kosten direct CTR in Google.nl. ${missingMeta.slice(0, 2).map(p => p.url).join(', ')}`,
        action: 'Schrijf unieke titles (45-58 tekens) en meta descriptions (135-155 tekens)'
      });
    }

    if (missingH1.length > 0 || multipleH1.length > 0) {
      recommendations.push({
        type: 'warning',
        targetTab: 'crawler',
        targetFilter: 'missing_h1',
        title: `H1-structuur niet op orde op ${missingH1.length + multipleH1.length} pagina('s)`,
        description: `${missingH1.length} pagina('s) zonder H1 en ${multipleH1.length} met meerdere H1's. Elke pagina hoort exact één H1 met het hoofdzoekwoord te hebben.`,
        action: 'Corrigeer de H1-structuur per pagina'
      });
    }

    if (thinContent.length > 0) {
      recommendations.push({
        type: 'warning',
        targetTab: 'crawler',
        targetFilter: 'all',
        title: `${thinContent.length} pagina('s) met dunne content (< 300 woorden)`,
        description: `Bijvoorbeeld: ${thinContent.slice(0, 3).map(p => p.url).join(', ')}. Dunne content rankt zelden op competitieve zoekwoorden.`,
        action: 'Breid deze pagina\'s uit met verdiepende content en FAQ-secties'
      });
    }

    if (missingAlt.length > 0) {
      const totalMissing = missingAlt.reduce((acc, p) => acc + p.images_missing_alt, 0);
      recommendations.push({
        type: 'opportunity',
        targetTab: 'crawler',
        targetFilter: 'missing_alt',
        title: `${totalMissing} afbeeldingen zonder alt-tekst op ${missingAlt.length} pagina('s)`,
        description: 'Alt-teksten helpen bij toegankelijkheid én bij ranken in Google Afbeeldingen.',
        action: 'Voeg beschrijvende alt-teksten met zoekwoorden toe'
      });
    }

    if (slowPages.length > 0) {
      recommendations.push({
        type: 'warning',
        targetTab: 'pagespeed',
        title: `${slowPages.length} pagina('s) laden langzamer dan 3 seconden`,
        description: `Traagste: ${slowPages.sort((a, b) => b.load_time_ms - a.load_time_ms).slice(0, 2).map(p => `${p.url} (${(p.load_time_ms / 1000).toFixed(1)}s)`).join(', ')}.`,
        action: 'Voer een PageSpeed audit uit voor concrete optimalisaties'
      });
    }

    // Checking orphan pages if internal link graph is present
    const hasLinkGraph = pages.some(p => p.internal_links);
    if (hasLinkGraph) {
      const normalize = (u) => (u || '').replace(/\/$/, '').split('#')[0];
      const inboundCount = new Map();
      pages.forEach(p => inboundCount.set(normalize(p.url), 0));
      pages.forEach(p => {
        let targets = [];
        try { targets = JSON.parse(p.internal_links || '[]'); } catch (e) {}
        const from = normalize(p.url);
        new Set(targets.map(normalize)).forEach(target => {
          if (target !== from && inboundCount.has(target)) {
            inboundCount.set(target, inboundCount.get(target) + 1);
          }
        });
      });
      const startUrl = normalize(lastSession.start_url);
      const isUtilityUrl = (url) => /\/(privacy|terms|voorwaarden|disclaimer|contact|login|admin)/i.test(url);
      const orphanPages = pages.filter(p => p.status_code < 400 && normalize(p.url) !== startUrl && !isUtilityUrl(p.url) && (inboundCount.get(normalize(p.url)) || 0) === 0);
      if (orphanPages.length > 0) {
        recommendations.push({
          type: 'warning',
          targetTab: 'internallinks',
          title: `${orphanPages.length} weespagina('s) (orphan pages) zonder inkomende links`,
          description: `Bijvoorbeeld: ${orphanPages.slice(0, 3).map(p => p.url).join(', ')}. Weespagina's worden slecht geïndexeerd doordat ze geen interne links ontvangen.`,
          action: 'Plaats interne links vanuit gerelateerde pagina\'s in de Interne Link Matrix'
        });
      }
    }
  } else {
    recommendations.push({
      type: 'opportunity',
      targetTab: 'crawler',
      targetFilter: 'all',
      title: 'Nog geen site crawl uitgevoerd',
      description: 'Zonder crawl-data kunnen technische SEO-problemen (ontbrekende titles, foutpagina\'s, dunne content) niet worden gedetecteerd.',
      action: 'Start een crawl via de Site Crawler tab'
    });
  }

  // --- Ranking-gebaseerde aanbevelingen ---
  const rankings = db.prepare(`
    SELECT k.keyword, k.target_url, r.position, r.url_found
    FROM keywords k
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
    AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
  `).all(projectId);

  const strikingDistance = rankings.filter(r => r.position >= 4 && r.position <= 20);
  const unranked = rankings.filter(r => r.position === 0 || r.position === null || r.position === undefined);

  if (strikingDistance.length > 0) {
    recommendations.push({
      type: 'opportunity',
      targetTab: 'rankings',
      targetFilter: 'top10',
      title: `${strikingDistance.length} zoekwoord(en) binnen striking distance (positie 4-20)`,
      description: `${strikingDistance.slice(0, 3).map(r => `"${r.keyword}" (#${r.position})`).join(', ')}. Tillen naar top 3 via de Hub & Spoke architectuur van fs-next.`,
      action: 'Verdiep de Spoke artikelen (/kennisbank/[hub]/[spoke]) en plaats interne tekstlinks naar de overkoepelende Pillar pagina (/kennisbank/[hub])'
    });
  }

  if (unranked.length > 0) {
    recommendations.push({
      type: 'critical',
      targetTab: 'rankings',
      targetFilter: 'unranked',
      title: `${unranked.length} zoekwoord(en) niet gevonden in de top 100`,
      description: `${unranked.slice(0, 3).map(r => `"${r.keyword}"`).join(', ')}. Geen specifieke Hub / Spoke landingsstructuur gevonden voor deze termen.`,
      action: 'Bouw nieuwe Hub / Spoke clusters in fs-next: maak per thema een centrale Pillar (/kennisbank/[hub]) met ondersteunende Spokes'
    });
  }

  // --- PageSpeed-gebaseerde aanbevelingen ---
  const lastAudit = db.prepare('SELECT * FROM pagespeed_audits WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
  if (lastAudit && lastAudit.performance_score < 70) {
    recommendations.push({
      type: lastAudit.performance_score < 50 ? 'critical' : 'warning',
      targetTab: 'pagespeed',
      title: `PageSpeed performance score is ${lastAudit.performance_score}/100 (${lastAudit.strategy})`,
      description: `Core Web Vitals: LCP ${lastAudit.lcp}, CLS ${lastAudit.cls}. Laadsnelheid is een rankingfactor voor Google.`,
      action: 'Bekijk de diagnostiek in de PageSpeed tab en los de grootste blokkades op'
    });
  }

  // --- GEO-gebaseerde aanbevelingen ---
  const geoRows = db.prepare('SELECT region, position, local_pack_present FROM geo_rankings WHERE project_id = ?').all(projectId);
  if (geoRows.length > 0) {
    const regions = [...new Set(geoRows.map(r => r.region))];
    const weakRegions = regions.filter(region => {
      const rows = geoRows.filter(r => r.region === region);
      return rows.length > 0 && rows.every(r => r.position === 0 || r.position > 10);
    });
    if (weakRegions.length > 0) {
      recommendations.push({
        type: 'opportunity',
        targetTab: 'geo',
        title: `Zwakke regionale zichtbaarheid in: ${weakRegions.join(', ')}`,
        description: 'In deze regio\'s staat geen enkel zoekwoord in de top 10. Regionale landingspagina\'s kunnen dit verbeteren.',
        action: 'Maak regiopagina\'s met lokale content en LocalBusiness schema'
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'opportunity',
      targetTab: 'crawler',
      targetFilter: 'all',
      title: 'Nog onvoldoende data voor aanbevelingen',
      description: 'Voer een crawl, ranking check en PageSpeed audit uit om concrete SEO-aanbevelingen te genereren.',
      action: 'Start met de Site Crawler en Rank Tracker tabs'
    });
  }

  // Kritieke punten eerst
  const order = { critical: 0, warning: 1, opportunity: 2 };
  recommendations.sort((a, b) => order[a.type] - order[b.type]);

  return recommendations;
}

module.exports = { generateSeoRecommendations };
