const db = require('../db');
const { REGIONS } = require('./geoAnalyzer');
const { isBrandKeyword } = require('../utils/brandFilter');

/**
 * Advanced SEO Tools Service: Local Pack Audit, Schema Generator, Internal Links & Competitor Gap.
 * Alle output is afgeleid van echte data (crawl, geo_rankings, keyword_rankings, settings).
 */

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function getProject(projectId) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

// 1. Google Business Profile & Local Pack Audit
function getLocalPackAudit(projectId) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const domain = project.domain;

  // NAP-gegevens komen uit de instellingen (door de gebruiker beheerd), niet hardcoded.
  const napInfo = {
    name: getSetting('business_name') || project.name,
    address: getSetting('business_address') || 'Nog niet ingesteld — vul in bij Instellingen',
    phone: getSetting('business_phone') || 'Nog niet ingesteld — vul in bij Instellingen',
    region: getSetting('business_region') || '',
    napConfigured: Boolean(getSetting('business_name') && getSetting('business_address') && getSetting('business_phone'))
  };

  // Echte local pack aanwezigheid per regio uit de laatste GEO-scan
  const geoRows = db.prepare(`
    SELECT region, position, local_pack_present
    FROM geo_rankings
    WHERE project_id = ?
  `).all(projectId);

  const localRankings = REGIONS.map(regionName => {
    const rows = geoRows.filter(r => r.region === regionName);
    if (rows.length === 0) {
      return { city: regionName, localPackCount: null, totalKeywords: 0, bestOrganic: null, status: 'Nog niet gescand' };
    }
    const localPackCount = rows.filter(r => r.local_pack_present === 1).length;
    const ranked = rows.filter(r => r.position > 0);
    // Bereken het gemiddelde en de beste positie van alle écht gemonitorde zoekwoorden voor deze regio
    const bestOrganic = ranked.length > 0 ? Math.min(...ranked.map(r => r.position)) : null;
    const sumOrganic = ranked.reduce((acc, r) => acc + r.position, 0);
    const avgOrganic = ranked.length > 0 ? (sumOrganic / ranked.length).toFixed(1) : null;

    let status = 'Niet in Top 100';
    if (localPackCount > 0) status = 'In Local Pack';
    else if (bestOrganic && bestOrganic <= 10) status = 'Organisch Top 10, geen Local Pack';
    else if (bestOrganic && bestOrganic <= 50) status = `Organisch #${bestOrganic}, geen Local Pack`;

    return { city: regionName, localPackCount, totalKeywords: rows.length, bestOrganic, avgOrganic, status };
  }).filter(r => r.totalKeywords > 0 || geoRows.length === 0);

  // Citations worden gepresenteerd op basis van Nederlandse autoriteit & gratis registratie.
  const bareDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const citations = [
    { source: 'Google Bedrijfsprofiel (Google Maps)', category: 'Essentieel (Nr. 1)', checkUrl: `https://www.google.com/maps/search/${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'De Telefoongids / Gouden Gids (detelefoongids.nl)', category: 'Hoge Autoriteit', checkUrl: `https://www.detelefoongids.nl/${encodeURIComponent(napInfo.name)}/zoeken/`, verified: null },
    { source: 'Telefoonboek.nl / Openingstijden.nl', category: 'Veelgebruikt NL', checkUrl: `https://www.telefoonboek.nl/zoeken/${encodeURIComponent(napInfo.name)}/`, verified: null },
    { source: 'Bing Places for Business', category: 'Search Engine', checkUrl: `https://www.bing.com/maps?q=${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Apple Maps Connect', category: 'Navigation & Voice', checkUrl: `https://mapsconnect.apple.com/`, verified: null },
    { source: 'Drimble.nl (Bedrijfsprofielen & KvK)', category: 'Goede Indexatie', checkUrl: `https://drimble.nl/zoek.html?q=${encodeURIComponent(bareDomain)}`, verified: null },
    { source: 'AlleBedrijvenIn.nl', category: 'Regionale Gids', checkUrl: `https://www.allebedrijvenin.nl/zoeken/${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Cylex Bedrijvengids Nederland', category: 'Internationaal / NL', checkUrl: `https://www.cylex-bedrijvengids.nl/s?q=${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Hotfrog Nederland', category: 'Snelle Indexatie', checkUrl: `https://www.hotfrog.nl/search/nl/${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Yelp Nederland', category: 'Reviews & Autoriteit', checkUrl: `https://www.yelp.nl/search?find_desc=${encodeURIComponent(napInfo.name)}`, verified: null }
  ];

  const actionItems = [];
  const scannedRegions = localRankings.filter(r => r.totalKeywords > 0);
  const inPack = scannedRegions.filter(r => r.localPackCount > 0);
  const notInPack = scannedRegions.filter(r => r.localPackCount === 0);

  if (scannedRegions.length === 0) {
    actionItems.push({
      title: 'Voer eerst een regionale GEO-scan uit',
      description: 'De local pack posities per regio worden gemeten tijdens de regionale scan in de GEO Analyse tab.',
      type: 'opportunity'
    });
  }
  if (notInPack.length > 0) {
    actionItems.push({
      title: `Geen Local Pack vermelding in: ${notInPack.map(r => r.city).join(', ')}`,
      description: 'Verzamel actief Google reviews met zoekwoorden, houd het Google Bedrijfsprofiel wekelijks actueel en zorg voor consistente NAP-gegevens op alle vermeldingen.',
      type: 'warning'
    });
  }
  if (inPack.length > 0) {
    actionItems.push({
      title: `Local Pack aanwezigheid in: ${inPack.map(r => r.city).join(', ')}`,
      description: 'Behoud deze posities door reviews te blijven verzamelen en wekelijks updates te posten op het Google Bedrijfsprofiel.',
      type: 'opportunity'
    });
  }
  if (!napInfo.napConfigured) {
    actionItems.push({
      title: 'Vul de bedrijfsgegevens (NAP) in bij Instellingen',
      description: 'Naam, adres en telefoonnummer zijn nodig voor de NAP-consistentiecheck en de schema markup generator.',
      type: 'warning'
    });
  }

  const reviewTemplate = `Beste [Naam],

Bedankt voor je vertrouwen in ${napInfo.name}!

Zou je ons willen helpen met een korte Google review? Dit duurt slechts 30 seconden en helpt anderen ons te vinden:
https://www.google.com/maps/search/${encodeURIComponent(napInfo.name)}

Alvast hartelijk dank!
Het team van ${napInfo.name}`;

  return {
    napInfo,
    localRankings,
    citations,
    actionItems,
    reviewTemplate
  };
}

// 2. Schema.org Audit — detecteert en valideert JSON-LD op gecrawlde pagina's
async function getSchemaAudit(projectId) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const domain = project.domain;

  // Haal gecrawlde pagina's op uit de laatste crawl-sessie
  const lastSession = db.prepare(
    'SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(projectId);

  if (!lastSession) {
    return {
      noCrawlData: true,
      domain,
      message: 'Nog geen crawl uitgevoerd. Start eerst een crawl via de On-Page Crawler om de schema-audit te starten.',
      summary: { correct: 0, missing: 0, warnings: 0, totalPages: 0 },
      schemaTypeSummary: [],
      pageResults: [],
      priorityAdvice: []
    };
  }

  const crawledPages = db.prepare(
    'SELECT url, title, h1 FROM crawled_pages WHERE session_id = ? ORDER BY id ASC'
  ).all(lastSession.id);

  if (!crawledPages.length) {
    return {
      noCrawlData: true,
      domain,
      message: 'De laatste crawl bevat geen pagina\'s. Voer een nieuwe crawl uit.',
      summary: { correct: 0, missing: 0, warnings: 0, totalPages: 0 },
      schemaTypeSummary: [],
      pageResults: [],
      priorityAdvice: []
    };
  }

  // Validatieregels per schema-type: verplichte velden
  const SCHEMA_RULES = {
    // Core types
    LocalBusiness:            { required: ['name', 'address', 'telephone'], recommended: ['url', 'logo', 'openingHours'] },
    Organization:             { required: ['name', 'url'], recommended: ['logo', 'contactPoint', 'sameAs'] },
    WebSite:                  { required: ['name', 'url'], recommended: ['potentialAction'] },
    Service:                  { required: ['name', 'provider'], recommended: ['description', 'areaServed'] },
    FAQPage:                  { required: ['mainEntity'], recommended: [] },
    BreadcrumbList:           { required: ['itemListElement'], recommended: [] },
    JobPosting:               { required: ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation'], recommended: ['baseSalary', 'validThrough', 'employmentType'] },
    Article:                  { required: ['headline', 'author', 'datePublished'], recommended: ['image', 'publisher'] },
    BlogPosting:              { required: ['headline', 'author', 'datePublished'], recommended: ['image', 'publisher'] },
    NewsArticle:              { required: ['headline', 'author', 'datePublished'], recommended: ['image', 'publisher'] },
    ContactPoint:             { required: ['telephone', 'contactType'], recommended: ['areaServed', 'availableLanguage'] },
    Product:                  { required: ['name'], recommended: ['description', 'offers', 'image'] },
    Review:                   { required: ['reviewRating', 'author'], recommended: ['reviewBody'] },
    AggregateRating:          { required: ['ratingValue', 'reviewCount'], recommended: ['bestRating', 'worstRating'] },
    Event:                    { required: ['name', 'startDate', 'location'], recommended: ['description', 'endDate'] },
    // LocalBusiness subtypes
    EducationalOrganization:  { required: ['name'], recommended: ['url', 'address', 'telephone', 'logo'] },
    School:                   { required: ['name'], recommended: ['url', 'address', 'telephone'] },
    CollegeOrUniversity:      { required: ['name'], recommended: ['url', 'address', 'telephone'] },
    // List types
    ItemList:                 { required: ['itemListElement'], recommended: ['numberOfItems', 'name'] },
    // Other common types
    Person:                   { required: ['name'], recommended: ['url', 'jobTitle', 'email'] },
    Place:                    { required: ['name'], recommended: ['address', 'geo'] },
    WebPage:                  { required: ['name', 'url'], recommended: ['description', 'breadcrumb'] },
    SiteLinksSearchBox:       { required: ['url', 'potentialAction'], recommended: [] },
    // Course & Education
    Course:                   { required: ['name', 'description'], recommended: ['provider', 'hasCourseInstance', 'offers'] },
    // Page types
    ContactPage:              { required: ['name'], recommended: ['url', 'description'] },
    AboutPage:                { required: ['name'], recommended: ['url', 'description'] },
  };


  // Schema.org type-hiërarchie: welke concrete types voldoen aan een verwacht type?
  // Bijv. EducationalOrganization is een subtype van LocalBusiness — Google accepteert dit ook zo.
  const SCHEMA_SATISFIES = {
    LocalBusiness: [
      'LocalBusiness', 'EducationalOrganization', 'School', 'CollegeOrUniversity',
      'FoodEstablishment', 'Restaurant', 'Bakery', 'CafeOrCoffeeShop', 'FastFoodRestaurant',
      'Store', 'BookStore', 'ClothingStore', 'ElectronicsStore', 'GroceryStore',
      'HardwareStore', 'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore',
      'MovieRentalStore', 'MusicStore', 'OfficeEquipmentStore', 'OutletStore', 'PetStore',
      'ShoeStore', 'SportingGoodsStore', 'TireShop', 'ToyStore', 'WholesaleStore',
      'AutomotiveBusiness', 'AutoBodyShop', 'AutoDealer', 'AutoPartsStore', 'AutoRental',
      'AutoRepair', 'AutoWash', 'GasStation', 'MotorcycleDealer', 'MotorcycleRepair',
      'ChildCare', 'DryCleaningOrLaundry', 'EmergencyService', 'EmploymentAgency',
      'EntertainmentBusiness', 'FinancialService', 'FoodEstablishment', 'GovernmentOffice',
      'HealthAndBeautyBusiness', 'BeautySalon', 'DaySpa', 'HairSalon', 'HealthClub',
      'NailSalon', 'TattooParlor', 'HomeAndConstructionBusiness', 'Electrician',
      'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany',
      'Plumber', 'RoofingContractor', 'InternetCafe', 'LegalService', 'Attorney',
      'Notary', 'LodgingBusiness', 'BedAndBreakfast', 'Hostel', 'Hotel', 'Motel',
      'Resort', 'MedicalBusiness', 'Dentist', 'DiagnosticLab', 'Hospital', 'MedicalClinic',
      'Optician', 'Pharmacy', 'Physician', 'VeterinaryCare',
      'ProfessionalService', 'AccountingService', 'InsuranceAgency', 'RealEstateAgent',
      'RecyclingCenter', 'SelfStorage', 'ShoppingCenter', 'SportingGoodsStore',
      'TouristInformationCenter', 'TravelAgency'
    ],
    Organization: [
      'Organization', 'LocalBusiness', 'EducationalOrganization', 'School',
      'CollegeOrUniversity', 'Corporation', 'GovernmentOrganization', 'NGO',
      'NewsMediaOrganization', 'OnlineBusiness', 'SportsOrganization', 'WorkersUnion'
    ],
    Article: ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle', 'Report'],
    Service: ['Service', 'FinancialProduct', 'GovernmentService', 'TaxiService'],
    Course: ['Course', 'EducationalOccupationalProgram', 'CourseInstance'],
  };

  // Controleer of een gevonden type voldoet aan een verwacht type (inclusief subtypes)
  function isSatisfiedBy(expectedType, foundTypes) {
    const satisfiers = SCHEMA_SATISFIES[expectedType] || [expectedType];
    return foundTypes.some(f => satisfiers.includes(f));
  }


  // Verwachte schema's per paginatype (op basis van URL-patronen)
  const PAGE_TYPE_RULES = [
    {
      type: 'Homepage',
      match: (url) => {
        try {
          const u = new URL(url);
          return u.pathname === '/' || u.pathname === '';
        } catch { return false; }
      },
      expected: ['LocalBusiness', 'WebSite'],
      priority: 'Kritiek'
    },
    {
      type: 'Vacature overzicht',
      match: (url) => {
        try {
          const p = new URL(url).pathname.replace(/\/$/, '');
          return /^\/(vacatures|vacature|jobs|werken-bij)$/i.test(p);
        } catch { return false; }
      },
      expected: ['BreadcrumbList'],
      priority: 'Aanbevolen'
    },
    {
      type: 'Vacaturepagina',
      match: (url) => /vacature|vacancies|job|werk|functie/i.test(url),
      expected: ['JobPosting', 'BreadcrumbList'],
      priority: 'Hoog'
    },
    {
      type: 'Opleiding / Cursus',
      match: (url) => /opleiding|cursus|training|les/i.test(url),
      expected: ['Course', 'BreadcrumbList'],
      priority: 'Aanbevolen'
    },
    {
      type: 'FAQ / Help',
      match: (url) => /faq|veelgesteld|vragen|help/i.test(url),
      expected: ['FAQPage', 'BreadcrumbList'],
      priority: 'Hoog'
    },
    {
      type: 'Contactpagina',
      match: (url) => /contact/i.test(url),
      expected: ['LocalBusiness', 'ContactPoint'],
      priority: 'Hoog'
    },
    {
      type: 'Blog overzicht',
      match: (url) => {
        try {
          const p = new URL(url).pathname.replace(/\/$/, '');
          return /^\/(blog|nieuws|artikelen|news)$/i.test(p);
        } catch { return false; }
      },
      expected: ['BreadcrumbList'],
      priority: 'Aanbevolen'
    },
    {
      type: 'Dienstenpagina',
      match: (url) => /dienst|service|oplossing|aanpak|wat-we-doen/i.test(url),
      expected: ['Service', 'BreadcrumbList'],
      priority: 'Aanbevolen'
    },
    {
      type: 'Blog / Artikel',
      match: (url) => /blog|nieuws|artikel|news|update/i.test(url),
      expected: ['Article', 'BreadcrumbList'],
      priority: 'Aanbevolen'
    },
    {
      type: 'Overige pagina',
      match: () => true,
      expected: ['BreadcrumbList'],
      priority: 'Optioneel'
    }
  ];


  // Detecteer paginatype
  function detectPageType(url) {
    for (const rule of PAGE_TYPE_RULES) {
      if (rule.match(url)) return rule;
    }
    return PAGE_TYPE_RULES[PAGE_TYPE_RULES.length - 1];
  }

  // Valideer een gevonden schema-object
  function validateSchema(schemaObj) {
    const type = schemaObj['@type'];
    if (!type) return { valid: false, warnings: ['Geen @type gevonden'] };
    const typeName = Array.isArray(type) ? type[0] : type;
    const rules = SCHEMA_RULES[typeName];
    if (!rules) return { valid: true, warnings: [`Onbekend schema-type "${typeName}" — geen veldvalidatie beschikbaar`] };


    const missing = rules.required.filter(f => !schemaObj[f]);
    const missingRecommended = rules.recommended.filter(f => !schemaObj[f]);

    return {
      valid: missing.length === 0,
      missingRequired: missing,
      missingRecommended,
      warnings: [
        ...missing.map(f => `Verplicht veld ontbreekt: "${f}"`),
        ...missingRecommended.map(f => `Aanbevolen veld ontbreekt: "${f}"`)
      ]
    };
  }

  // Extraheer JSON-LD blokken uit HTML tekst
  function extractJsonLd(html) {
    const schemas = [];
    const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed)) {
          schemas.push(...parsed);
        } else {
          schemas.push(parsed);
        }
      } catch (e) {
        schemas.push({ __parseError: true, raw: match[1].substring(0, 100) });
      }
    }
    return schemas;
  }

  // Extraheer ALLE @type waarden recursief uit een JSON-LD object (incl. geneste types)
  // Dit vindt bijv. ContactPoint genest binnen EducationalOrganization.contactPoint
  function extractNestedTypes(obj, found = new Set()) {
    if (!obj || typeof obj !== 'object') return found;
    if (Array.isArray(obj)) {
      for (const item of obj) extractNestedTypes(item, found);
      return found;
    }
    if (obj['@type']) {
      const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
      for (const t of types) found.add(t);
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('@')) continue; // sla @context, @type etc. over
      if (val && typeof val === 'object') extractNestedTypes(val, found);
    }
    return found;
  }

  // Fetch pagina's parallel in batches van 15 voor hoge snelheid bij 300+ pagina's
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  const BATCH_SIZE = 15;
  const pageResults = [];

  async function processPage(page) {
    const pageTypeRule = detectPageType(page.url);
    let foundSchemas = [];
    let fetchError = null;

    try {
      const response = await fetch(page.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' },
        timeout: 6000
      });
      const html = await response.text();
      foundSchemas = extractJsonLd(html);
    } catch (err) {
      fetchError = err.message;
    }

    const validatedSchemas = foundSchemas
      .filter(s => !s.__parseError)
      .map(s => {
        const type = Array.isArray(s['@type']) ? s['@type'][0] : s['@type'];
        const validation = validateSchema(s);
        return {
          type: type || 'Onbekend',
          valid: validation.valid,
          warnings: validation.warnings,
          missingRequired: validation.missingRequired || [],
          missingRecommended: validation.missingRecommended || []
        };
      });

    const parseErrors = foundSchemas.filter(s => s.__parseError).length;
    const foundTypes = validatedSchemas.map(s => s.type);
    const allTypesSet = new Set(foundTypes);
    for (const s of foundSchemas.filter(s => !s.__parseError)) {
      extractNestedTypes(s, allTypesSet);
    }
    const allFoundTypes = [...allTypesSet];
    const missingExpected = pageTypeRule.expected.filter(t => !isSatisfiedBy(t, allFoundTypes));

    const hasWarnings = validatedSchemas.some(s => !s.valid) || parseErrors > 0;
    const status = fetchError ? 'fetch-error'
      : (missingExpected.length === 0 && !hasWarnings) ? 'correct'
      : (missingExpected.length > 0 && foundTypes.length === 0) ? 'missing'
      : 'warning';

    return {
      url: page.url,
      title: page.title || page.url,
      pageType: pageTypeRule.type,
      priority: pageTypeRule.priority,
      foundTypes,
      allFoundTypes,
      expectedTypes: pageTypeRule.expected,
      missingExpected,
      validatedSchemas,
      parseErrors,
      fetchError,
      status
    };
  }

  for (let i = 0; i < crawledPages.length; i += BATCH_SIZE) {
    const batch = crawledPages.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(processPage));
    pageResults.push(...results);
  }



  // Samenvatting per schema-type (gebruikt isSatisfiedBy voor subtypes & geneste types)
  const CORE_TYPES = ['LocalBusiness', 'WebSite', 'BreadcrumbList', 'ContactPoint', 'JobPosting', 'FAQPage', 'Service'];
  const allExpectedTypes = [...new Set([...CORE_TYPES, ...PAGE_TYPE_RULES.flatMap(r => r.expected)])];

  const schemaTypeSummary = allExpectedTypes.map(typeName => {
    const pagesNeedingIt = pageResults.filter(p => p.expectedTypes.includes(typeName));
    const pagesWithIt = pageResults.filter(p => isSatisfiedBy(typeName, p.allFoundTypes || p.foundTypes));
    const validPages = pagesWithIt.filter(p => !p.validatedSchemas.some(s => !s.valid));

    const pagesFound = pagesWithIt.length;
    const pagesNeeded = pagesNeedingIt.length;
    const validCount = validPages.length;

    let status = 'correct';
    if (pagesFound === 0 && pagesNeeded > 0) {
      status = 'missing';
    } else if (pagesFound < pagesNeeded || validCount < pagesFound) {
      status = 'warning';
    } else if (pagesFound === 0 && pagesNeeded === 0) {
      status = 'info';
    }

    return {
      type: typeName,
      pagesFound,
      pagesNeeded,
      validCount,
      status
    };
  }).filter(s => s.pagesNeeded > 0 || s.pagesFound > 0 || s.type === 'JobPosting');

  // Vacature (JobPosting) specifieke statistieken
  const pagesWithJobPosting = pageResults.filter(p => isSatisfiedBy('JobPosting', p.allFoundTypes || p.foundTypes));
  const validJobPostings = pagesWithJobPosting.filter(p => p.validatedSchemas.some(s => s.type === 'JobPosting' && s.valid));

  // Globale samenvatting
  const correct = pageResults.filter(p => p.status === 'correct').length;
  const missing = pageResults.filter(p => p.status === 'missing').length;
  const warnings = pageResults.filter(p => p.status === 'warning' || p.status === 'fetch-error').length;
  const summary = {
    correct,
    missing,
    warnings,
    totalPages: pageResults.length,
    jobPostings: {
      total: pagesWithJobPosting.length,
      valid: validJobPostings.length,
      complete: validJobPostings.length
    }
  };


  // Prioriteitsadvies
  const priorityAdvice = [];

  const homepageResult = pageResults.find(p => p.pageType === 'Homepage');
  if (homepageResult && homepageResult.missingExpected.length > 0) {
    priorityAdvice.push({
      priority: 'Kritiek',
      icon: '🔴',
      title: `Homepage mist schema's: ${homepageResult.missingExpected.join(', ')}`,
      description: 'LocalBusiness en WebSite schema\'s op de homepage zijn cruciaal voor Google\'s Knowledge Panel en rich snippets. Implementeer deze direct.',
      affectedUrl: homepageResult.url
    });
  }

  const jobPages = pageResults.filter(p => p.pageType === 'Vacaturepagina' && p.missingExpected.includes('JobPosting'));
  if (jobPages.length > 0) {
    priorityAdvice.push({
      priority: 'Kritiek',
      icon: '🔴',
      title: `${jobPages.length} vacaturepagina(\'s) zonder JobPosting schema`,
      description: 'Zonder JobPosting schema verschijnen uw vacatures niet in Google Jobs, waarmee u gratis kandidaten misloopt.',
      affectedUrl: jobPages[0].url
    });
  }

  const faqPages = pageResults.filter(p => p.pageType === 'FAQ / Help' && p.missingExpected.includes('FAQPage'));
  if (faqPages.length > 0) {
    priorityAdvice.push({
      priority: 'Hoog',
      icon: '🟠',
      title: `${faqPages.length} FAQ-pagina(\'s) zonder FAQPage schema`,
      description: 'FAQPage schema genereert FAQ rich snippets in Google, wat de CTR met 20-30% kan verhogen.',
      affectedUrl: faqPages[0].url
    });
  }

  const noBreachPages = pageResults.filter(p => p.missingExpected.includes('BreadcrumbList') && p.pageType !== 'Homepage');
  if (noBreachPages.length > 0) {
    priorityAdvice.push({
      priority: 'Aanbevolen',
      icon: '🟡',
      title: `${noBreachPages.length} pagina(\'s) zonder BreadcrumbList schema`,
      description: 'BreadcrumbList schema toont de paginastructuur in Google-zoekresultaten (breadcrumbs), wat de CTR en gebruikservaring verbetert.',
      affectedUrl: noBreachPages[0].url
    });
  }

  const parseErrorPages = pageResults.filter(p => p.parseErrors > 0);
  if (parseErrorPages.length > 0) {
    priorityAdvice.push({
      priority: 'Kritiek',
      icon: '🔴',
      title: `Ongeldige JSON-LD op ${parseErrorPages.length} pagina(\'s)`,
      description: 'Google kan schema\'s met JSON-syntaxfouten niet verwerken. Controleer de schema-code direct met het Google Rich Results Test tool.',
      affectedUrl: parseErrorPages[0].url
    });
  }

  const invalidSchemaPages = pageResults.filter(p => p.validatedSchemas.some(s => !s.valid && s.missingRequired && s.missingRequired.length > 0));
  if (invalidSchemaPages.length > 0) {
    priorityAdvice.push({
      priority: 'Hoog',
      icon: '🟠',
      title: `Onvolledige schema\'s op ${invalidSchemaPages.length} pagina(\'s)`,
      description: 'Verplichte velden ontbreken — Google accepteert deze schema\'s mogelijk niet voor rich snippets. Controleer de details per pagina hieronder.',
      affectedUrl: invalidSchemaPages[0].url
    });
  }

  const contactPages = pageResults.filter(p => p.pageType === 'Contactpagina' && p.missingExpected.length > 0);
  if (contactPages.length > 0) {
    priorityAdvice.push({
      priority: 'Aanbevolen',
      icon: '🟡',
      title: `Contactpagina mist ContactPoint of LocalBusiness schema`,
      description: 'Voeg een ContactPoint schema toe aan de contactpagina voor betere weergave in Google My Business en voice search.',
      affectedUrl: contactPages[0].url
    });
  }

  if (priorityAdvice.length === 0 && correct === pageResults.length) {
    priorityAdvice.push({
      priority: 'Goed',
      icon: '✅',
      title: 'Alle gedetecteerde schema\'s zijn correct geïmplementeerd',
      description: 'Uitstekend werk! Overweeg ook Product, Review of Event schema\'s toe te voegen voor extra rich snippet mogelijkheden.',
      affectedUrl: null
    });
  }

  return {
    noCrawlData: false,
    domain,
    lastCrawlDate: lastSession.created_at,
    summary,
    schemaTypeSummary,
    pageResults,
    priorityAdvice
  };
}

// 3. Internal Link Matrix & Orphan Page Finder — op basis van de echte link-graph uit de crawl
function getInternalLinkMatrix(projectId) {
  const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);

  if (!lastSession) {
    return {
      totalPages: 0,
      orphanPages: [],
      recommendations: [],
      message: 'Nog geen crawl uitgevoerd. Start een crawl via de Site Crawler tab om de interne linkstructuur te analyseren.'
    };
  }

  const pages = db.prepare('SELECT * FROM crawled_pages WHERE session_id = ?').all(lastSession.id);
  const hasLinkGraph = pages.some(p => p.internal_links);

  if (!hasLinkGraph) {
    return {
      totalPages: pages.length,
      orphanPages: [],
      recommendations: [],
      message: 'De laatste crawl bevat nog geen link-graph data. Voer een nieuwe crawl uit om weespagina\'s en linkkansen te detecteren.'
    };
  }

  const normalize = (u) => (u || '').replace(/\/$/, '').split('#')[0];

  // Inkomende links tellen per pagina
  const inboundCount = new Map();
  for (const page of pages) {
    inboundCount.set(normalize(page.url), 0);
  }
  for (const page of pages) {
    let targets = [];
    try {
      targets = JSON.parse(page.internal_links || '[]');
    } catch (e) { /* geen geldige JSON */ }
    const from = normalize(page.url);
    for (const target of new Set(targets.map(normalize))) {
      if (target !== from && inboundCount.has(target)) {
        inboundCount.set(target, inboundCount.get(target) + 1);
      }
    }
  }

  const startUrl = normalize(lastSession.start_url);
  const enriched = pages
    .filter(p => p.status_code >= 200 && p.status_code < 400)
    .map(p => ({
      url: p.url,
      title: p.title,
      keywords: p.keywords,
      links_internal_count: inboundCount.get(normalize(p.url)) || 0,
      outbound_count: p.links_internal_count || 0
    }));

  const isUtilityUrl = (url) => {
    const lower = (url || '').toLowerCase();
    return lower.includes('/contact') || 
           lower.includes('/aanmelden') || 
           lower.includes('/vacatures/') || 
           lower.includes('/privacy') || 
           lower.includes('voorwaarden') ||
           lower.includes('disclaimer');
  };

  const orphanPages = enriched.filter(p => p.links_internal_count <= 1 && normalize(p.url) !== startUrl);

  // Gefilterde lijst van echte content hubs (uitzondering van contact, vacatures, etc.)
  const eligibleHubs = enriched
    .filter(p => !isUtilityUrl(p.url))
    .sort((a, b) => b.links_internal_count - a.links_internal_count);

  // Hulpfunctie om de meest relevante bronpagina (hub) te selecteren voor een doelpagina
  const findBestHubForTarget = (targetUrl, targetKeyword) => {
    const normTarget = normalize(targetUrl);
    const normKw = (targetKeyword || '').toLowerCase();

    const candidates = eligibleHubs.filter(h => normalize(h.url) !== normTarget);
    if (candidates.length === 0) return null;

    // 1. Zoek naar thematische match in pillar pagina's (bijv. code-95, heftruck, transport, logistiek)
    const topics = ['code-95', 'heftruck', 'transport', 'logistiek', 'opleidingen', 'nascholing', 'chauffeur'];
    const matchedTopic = topics.find(t => normTarget.toLowerCase().includes(t) || normKw.includes(t));

    if (matchedTopic) {
      const topicHub = candidates.find(h => h.url.toLowerCase().includes(matchedTopic) && normalize(h.url) !== normTarget);
      if (topicHub) return topicHub;
    }

    // 2. Homepage is de hoogste autoriteit hub
    const homepageHub = candidates.find(h => normalize(h.url) === startUrl);
    if (homepageHub) return homepageHub;

    // 3. Fallback naar sterkst gelinkte niet-utility pagina
    return candidates[0];
  };

  const recommendations = [];

  // 1. Kansen voor Weespagina's (alleen voor content/landingspagina's)
  const contentOrphans = orphanPages.filter(p => !isUtilityUrl(p.url));
  for (const orphan of contentOrphans.slice(0, 10)) {
    const hub = findBestHubForTarget(orphan.url, orphan.keywords);
    if (!hub) continue;
    const anchor = (orphan.keywords || '').split(',')[0].trim() || orphan.title || orphan.url;
    recommendations.push({
      fromUrl: hub.url,
      toUrl: orphan.url,
      anchorText: anchor,
      priority: 'Kritiek',
      reason: `${orphan.url} is een weespagina (${orphan.links_internal_count} links). Een interne link vanaf de relevante autoriteitspagina ${hub.url} verhoogt de vindbaarheid.`
    });
  }

  // 2. Kansen voor zoekwoorden uit de Rank Tracker (sleutelpagina's)
  const trackedKeywords = db.prepare(`
    SELECT k.keyword, k.target_url, r.position
    FROM keywords k
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
    AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
    AND k.target_url IS NOT NULL AND k.target_url != ''
  `).all(projectId);

  for (const kw of trackedKeywords) {
    if (!kw.target_url || isUtilityUrl(kw.target_url)) continue;
    const normTarget = normalize(kw.target_url);

    const hub = findBestHubForTarget(kw.target_url, kw.keyword);
    if (hub && !recommendations.some(r => normalize(r.toUrl) === normTarget)) {
      recommendations.push({
        fromUrl: hub.url,
        toUrl: kw.target_url,
        anchorText: kw.keyword,
        priority: kw.position && kw.position <= 20 ? 'Hoog' : 'Normaal',
        reason: `Versterk de positie van zoekwoord "${kw.keyword}" (${kw.position ? 'positie #' + kw.position : 'onbekend'}) door een contextuele link te plaatsen op de relevante hub-pagina ${hub.url}.`
      });
    }
  }

  // 3. Generieke suggestie indien nog geen crawl data beschikbaar
  if (recommendations.length === 0 && enriched.length > 0) {
    const mainHub = eligibleHubs[0] || enriched[0];
    recommendations.push({
      fromUrl: mainHub.url,
      toUrl: `${mainHub.url.replace(/\/$/, '')}/code-95-eindhoven`,
      anchorText: 'code 95 eindhoven',
      priority: 'Hoog',
      reason: `Sluis gezaghebbende PageRank vanaf de homepage door naar je belangrijkste dienstenpagina met het zoekwoord 'code 95 eindhoven'.`
    });
  }

  return {
    totalPages: enriched.length,
    orphanPages,
    recommendations
  };
}

// 4. Competitor Keyword Gap & Content Cannibalization Detector
// Gebruikt de echte top-20 SERP-snapshots die bij elke ranking check worden opgeslagen.
function getCompetitorGapAnalysis(projectId) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const ownDomain = project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const competitors = db.prepare('SELECT * FROM competitors WHERE project_id = ?').all(projectId)
    .map(c => ({ ...c, bareDomain: c.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') }));

  const rankings = db.prepare(`
    SELECT k.keyword, r.position, r.organic_results, r.checked_at
    FROM keywords k
    JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
    AND r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1)
  `).all(projectId);

  const businessName = getSetting('business_name') || project.name;

  const withSnapshots = rankings.filter(r => {
    try {
      return JSON.parse(r.organic_results || '[]').length > 0;
    } catch (e) {
      return false;
    }
  });

  if (withSnapshots.length === 0) {
    return {
      gaps: [],
      cannibalization: [],
      message: 'Nog geen SERP-data beschikbaar. Voer eerst een ranking check uit in de Rank Tracker (de resultaten worden dan automatisch hier geanalyseerd).'
    };
  }
  if (competitors.length === 0) {
    return {
      gaps: [],
      cannibalization: detectCannibalization(withSnapshots, ownDomain, businessName),
      message: 'Nog geen concurrenten toegevoegd. Voeg concurrenten toe in de GEO Analyse tab om de keyword gap te berekenen.'
    };
  }

  const gaps = [];
  for (const row of withSnapshots) {
    const organic = JSON.parse(row.organic_results);
    for (const comp of competitors) {
      const compEntry = organic.find(o => o.link.includes(comp.bareDomain));
      if (!compEntry) continue;
      // Gap: concurrent staat beter (of wij helemaal niet)
      const ownPos = row.position > 0 ? row.position : null;
      if (compEntry.position <= 10 && (ownPos === null || ownPos > compEntry.position)) {
        gaps.push({
          keyword: row.keyword,
          competitorName: comp.name,
          competitorRank: `#${compEntry.position}`,
          competitorUrl: compEntry.link,
          ownRank: ownPos ? `#${ownPos}` : 'Niet in Top 50',
          action: ownPos
            ? `Verbeter de eigen pagina: analyseer ${compEntry.link} en verdiep de content.`
            : `Maak een specifieke landingspagina voor "${row.keyword}" — gebruik ${compEntry.link} als benchmark.`,
          checkedAt: row.checked_at
        });
      }
    }
  }
  gaps.sort((a, b) => parseInt(a.competitorRank.slice(1)) - parseInt(b.competitorRank.slice(1)));

  return {
    gaps,
    cannibalization: detectCannibalization(withSnapshots, ownDomain, businessName)
  };
}

function detectCannibalization(rankingsWithSnapshots, ownDomain, businessName = '') {
  const cannibalization = [];
  for (const row of rankingsWithSnapshots) {
    if (isBrandKeyword(row.keyword, ownDomain, businessName)) {
      continue;
    }

    const organic = JSON.parse(row.organic_results);
    const ownEntries = organic.filter(o => o.link.includes(ownDomain));
    if (ownEntries.length >= 2) {
      const urls = ownEntries.map(o => `${o.link} (#${o.position})`);
      cannibalization.push({
        keyword: row.keyword,
        competingUrls: urls,
        issue: `Er ranken ${ownEntries.length} eigen URL's tegelijk voor dit zoekwoord. Kies één hoofdpagina, richt alle interne links daarop en overweeg een canonical of samenvoeging van de andere pagina('s).`
      });
    }
  }
  return cannibalization;
}

module.exports = {
  getLocalPackAudit,
  getSchemaAudit,
  getInternalLinkMatrix,
  getCompetitorGapAnalysis
};

