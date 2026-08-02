const db = require('../db');

function getTopicClusters(projectId) {
  const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
  const pages = lastSession ? db.prepare('SELECT * FROM crawled_pages WHERE session_id = ?').all(lastSession.id) : [];
  const keywords = db.prepare(`
    SELECT k.keyword, k.target_url, r.position 
    FROM keywords k 
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id 
    WHERE k.project_id = ? 
    AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
  `).all(projectId);

  const normalize = (u) => (u || '').replace(/\/$/, '').split('#')[0];

  // Inkomende links tellen per pagina
  const inboundMap = new Map();
  const linkTargetsMap = new Map();

  for (const p of pages) {
    inboundMap.set(normalize(p.url), 0);
    try {
      linkTargetsMap.set(normalize(p.url), JSON.parse(p.internal_links || '[]').map(normalize));
    } catch (e) {
      linkTargetsMap.set(normalize(p.url), []);
    }
  }

  for (const p of pages) {
    const targets = linkTargetsMap.get(normalize(p.url)) || [];
    for (const t of new Set(targets)) {
      if (inboundMap.has(t)) {
        inboundMap.set(t, inboundMap.get(t) + 1);
      }
    }
  }

  // Filter uit nutteloze pagina's (vacatures, contact)
  const isUtility = (url) => {
    const lower = (url || '').toLowerCase();
    return lower.includes('/vacatures/') || lower.includes('/contact') || lower.includes('/aanmelden') || lower.includes('/privacy') || lower.includes('voorwaarden');
  };

  const validPages = pages.filter(p => !isUtility(p.url));

  // Definieer de hoofd-onderwerpen (Clusters)
  const clusterDefinitions = [
    {
      id: 'code-95',
      title: 'Code 95 & Nascholing Chauffeurs',
      icon: 'Truck',
      pillarMatch: ['/opleidingen/code-95-opleidingen', '/code-95', '/nascholing-35-uur'],
      keywords: ['code 95', 'nascholing', 'code95', '35 uur', 'rijoptimalisatie', 'chauffeursdag', 'ehbo onderweg']
    },
    {
      id: 'heftruck-logistiek',
      title: 'Heftruck & Interne Logistiek',
      icon: 'Package',
      pillarMatch: ['/opleidingen/interne-logistiek', '/heftruck-cursus', '/veilig-werken-met-de-heftruck'],
      keywords: ['heftruck', 'reachtruck', 'interne logistiek', 'bovenloopkraan', 'autolaadkraan', 'terminal-trekker', 'hoogwerker']
    },
    {
      id: 'transport-uitzend',
      title: 'Transport, Logistiek & Uitzenden',
      icon: 'Briefcase',
      pillarMatch: ['/transport-logistiek', '/rijopleiding-c-ce', '/vacatures'],
      keywords: ['transport', 'logistiek', 'uitzendbureau', 'vrachtwagen', 'rijopleiding', 'c ce']
    },
    {
      id: 'certificeringsbeheer',
      title: 'Certificeringsbeheer & Bedrijfsopleidingen',
      icon: 'Award',
      pillarMatch: ['/opleidingen/certificeringsbeheer', '/certificeringsbeheer'],
      keywords: ['certificeringsbeheer', 'certificering', 'soob', 'nascholing beheer', 'hercertificering', 'cursusbeheer', 'opleidingsbeheer']
    },
    {
      id: 'vca-veiligheid',
      title: 'VCA & Veiligheidscertificaten',
      icon: 'ShieldCheck',
      pillarMatch: ['/vca-cursus', '/vca-basis', '/vca-vol', '/opleidingen/vca'],
      keywords: ['vca', 'veiligheid', 'vca basis', 'vca vol', 'certificaat']
    }
  ];

  // Laad eventuele door de gebruiker toegevoegde custom pillar pagina's uit de database
  try {
    const customRows = db.prepare('SELECT * FROM custom_topic_clusters WHERE project_id = ?').all(projectId);
    for (const row of customRows) {
      const kwList = (row.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      clusterDefinitions.push({
        id: `custom-${row.id}`,
        dbId: row.id,
        isCustom: true,
        title: row.title,
        icon: 'Layers',
        pillarMatch: [row.pillar_url],
        keywords: kwList.length > 0 ? kwList : [row.title.toLowerCase()]
      });
    }
  } catch (e) {
    // Negeer als tabel nog niet bestaat
  }

  const clusters = clusterDefinitions.map(def => {
    // Vind de Pillar Page
    let pillarPage = validPages.find(p => def.pillarMatch.some(m => normalize(p.url).toLowerCase().endsWith(m))) ||
                     validPages.find(p => def.pillarMatch.some(m => normalize(p.url).toLowerCase().includes(m)));

    if (!pillarPage) {
      pillarPage = validPages.find(p => def.keywords.some(k => (p.url + ' ' + (p.title || '')).toLowerCase().includes(k))) || null;
    }

    const pillarNorm = pillarPage ? normalize(pillarPage.url) : '';

    // Vind alle Spoke Pages (cluster artikelen / regiopagina's / blogs)
    const spokes = validPages.filter(p => {
      const norm = normalize(p.url);
      if (norm === pillarNorm) return false;
      const text = (p.url + ' ' + (p.title || '') + ' ' + (p.keywords || '')).toLowerCase();
      return def.keywords.some(k => text.includes(k));
    }).map(p => {
      const norm = normalize(p.url);
      const pillarLinksToSpoke = pillarNorm ? (linkTargetsMap.get(pillarNorm) || []).includes(norm) : false;
      const spokeLinksToPillar = pillarNorm ? (linkTargetsMap.get(norm) || []).includes(pillarNorm) : false;

      return {
        url: p.url,
        title: p.title,
        wordCount: p.word_count || 0,
        inboundLinks: inboundMap.get(norm) || 0,
        pillarLinksToSpoke,
        spokeLinksToPillar
      };
    });

    // Keywords in dit cluster
    const clusterKeywords = keywords.filter(k => def.keywords.some(term => k.keyword.toLowerCase().includes(term)));

    // Bereken Cluster Health Score
    const totalSpokes = spokes.length;
    const spokesWithPillarLink = spokes.filter(s => s.spokeLinksToPillar).length;
    const interconnectedness = totalSpokes > 0 ? Math.round((spokesWithPillarLink / totalSpokes) * 100) : 100;

    return {
      id: def.id,
      dbId: def.dbId || null,
      isCustom: !!def.isCustom,
      title: def.title,
      pillarPage: pillarPage ? {
        url: pillarPage.url,
        title: pillarPage.title,
        wordCount: pillarPage.word_count || 0,
        inboundLinks: inboundMap.get(pillarNorm) || 0
      } : null,
      spokes,
      keywords: clusterKeywords,
      stats: {
        totalSpokes,
        interconnectedness,
        healthScore: Math.min(100, Math.round((interconnectedness * 0.6) + (pillarPage ? 40 : 0)))
      }
    };
  });

  return {
    clusters,
    totalContentPages: validPages.length,
    summary: {
      totalClusters: clusters.length,
      avgHealthScore: Math.round(clusters.reduce((acc, c) => acc + c.stats.healthScore, 0) / clusters.length)
    }
  };
}

module.exports = { getTopicClusters };
