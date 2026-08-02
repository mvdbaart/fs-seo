/**
 * Ad Copy & Campaign Generator service for Google Ads
 * Uses FrisseStart context, SEO rank data, and Google Ads policy rules (headlines <= 30 chars, descriptions <= 90 chars).
 */

const DEFAULT_NEGATIVE_KEYWORDS = [
  'schuldhulpverlening',
  'schuldhulp',
  'bewindvoering',
  'schulden',
  'gratis',
  'pdf download',
  'gratis cursus',
  'marktplaats',
  'forum',
  'wikipedia',
  'betekenis'
];

/**
 * Truncate string gracefully to max length
 */
function fitText(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).trim();
}

/**
 * Pre-configured campaign blueprints based on FrisseStart context & domain knowledge
 */
const CAMPAIGN_BLUEPRINTS = {
  'code-95-hercertificering': {
    name: 'SEA - Code 95 & Hercertificering - Regio ZO-Brabant',
    dailyBudget: 25.0,
    targetLocations: 'Eindhoven, Geldrop, Helmond, Veldhoven, Nuenen, Valkenswaard, Deurne',
    groups: [
      {
        name: '1-Uurs Hercertificering',
        landingPage: 'https://frissestart.nl/opleidingen/1-uurs-hercertificering',
        keywords: [
          { text: 'code 95 hercertificering 1 uur', matchType: 'EXACT', bid: 3.50 },
          { text: '1 uurs hercertificering code 95', matchType: 'EXACT', bid: 3.50 },
          { text: 'code 95 snel verlengen', matchType: 'PHRASE', bid: 3.00 },
          { text: 'hercertificering chauffeur 1 uur', matchType: 'PHRASE', bid: 2.80 }
        ],
        headlines: [
          'Code 95 Hercertificering 1 Uur',
          'Snel Verlengen Chauffeurs',
          'Ervaren Chauffeur? 1 Uur',
          'FrisseStart Opleidingen',
          'Regio Eindhoven & Geldrop',
          'Direct Offerte & Inschrijven',
          'Direct Geaccrediteerd',
          'Behaal Je Code 95 Snel',
          'Officiële Nascholing',
          'Flexibele Planning',
          'Bespaar Tijd & Kosten',
          'Code 95 Specialisme',
          'Certificaat Binnen 1 Uur',
          'Hercertificeren In 1 Uur',
          'FrisseStart Transport'
        ],
        descriptions: [
          'Verleng snel je Code 95 in slechts 1 uur voor ervaren chauffeurs. Officieel erkend.',
          'Flexibele 1-uurs hercertificering in regio Eindhoven & Geldrop. Meld je direct aan!',
          'Houd je certificaten up-to-date zonder tijdverlies. Bekijk de mogelijkheden.',
          'Profiteer van snelle nascholing op maat voor chauffeurs in Zuidoost-Brabant.'
        ]
      },
      {
        name: 'Code 95 Eindhoven & E-learning',
        landingPage: 'https://frissestart.nl/code-95-eindhoven',
        keywords: [
          { text: 'code 95 eindhoven', matchType: 'EXACT', bid: 3.20 },
          { text: 'code 95 nascholing nuenen', matchType: 'EXACT', bid: 3.00 },
          { text: 'code 95 in 3.5 dag behalen', matchType: 'PHRASE', bid: 3.10 },
          { text: 'soob subsidie code 95', matchType: 'PHRASE', bid: 2.90 }
        ],
        headlines: [
          'Code 95 Eindhoven Regio',
          'In 3 of 3.5 Dag Behalen',
          'Met E-Learning Combinatie',
          'SOOB Subsidie Mogelijk',
          'Nascholing Chauffeurs',
          'FrisseStart Opleidingen',
          'Geldrop, Nuenen & Eindhoven',
          'Snel Je Punten Behalen',
          'Gecertificeerde Cursussen',
          'Flexibel & Snel Geregeld',
          'Praktijk & Theorie',
          'Persoonlijk Advies',
          'Schrijf Je Direct In',
          'Top Beoordeeld In Brabant',
          'Code 95 VTS Certificering'
        ],
        descriptions: [
          'Behaal je Code 95 in 3 of 3,5 dag dankzij slimme e-learning combinaties. Regio Eindhoven.',
          'SOOB subsidieregeling toepasbaar op diverse nascholingscursussen. Bekijk alle data.',
          'Gecertificeerde nascholing voor vrachtwagenchauffeurs in Geldrop, Eindhoven en Nuenen.',
          'Flexibele planning en direct resultaat bij FrisseStart Opleidingen.'
        ]
      }
    ]
  },
  'certificeringsbeheer-b2b': {
    name: 'SEA - B2B Certificeringsbeheer Transport',
    dailyBudget: 20.0,
    targetLocations: 'Nederland',
    groups: [
      {
        name: 'Certificeringsbeheer Tool',
        landingPage: 'https://frissestart.nl/opleidingen/certificeringsbeheer',
        keywords: [
          { text: 'certificeringsbeheer transport', matchType: 'EXACT', bid: 4.50 },
          { text: 'certificaten beheer chauffeurs', matchType: 'PHRASE', bid: 4.00 },
          { text: 'code 95 beheer software', matchType: 'PHRASE', bid: 3.80 },
          { text: 'periodic retaining transport', matchType: 'PHRASE', bid: 3.50 }
        ],
        headlines: [
          'Certificeringsbeheer Transport',
          'Automatisch Verloop Bewaken',
          'Periodic Retaining Chauffeurs',
          'Geen Verlopen Certificaten',
          'FrisseStart B2B Opleidingen',
          'Overzicht Voor Transporteurs',
          'Voorkom Boetes & Downtime',
          'Chauffeurs Certificering',
          'Code 95 & Veiligheid',
          'Slim Bedrijfsbeheer',
          'Vraag Demonstratie Aan',
          'Continuïteit In Transport',
          'Volledig Ontzorgd',
          'Geldrop & Landelijke Service',
          'FrisseStart Certificering'
        ],
        descriptions: [
          'Houd alle certificaten en Code 95 van je chauffeurs automatisch actueel en up-to-date.',
          'Voorkom dat certificaten verlopen met periodiek beheer van FrisseStart Transport.',
          'Sluit een periodiek retaining abonnement af en ontzorg je hele wagenpark.',
          'Vraag direct advies aan voor jouw transport- of logistieke onderneming.'
        ]
      }
    ]
  },
  'heftruck-vca-cursussen': {
    name: 'SEA - Heftruck & VCA Cursussen',
    dailyBudget: 15.0,
    targetLocations: 'Eindhoven, Geldrop, Helmond, Veldhoven, Nuenen',
    groups: [
      {
        name: 'Heftruckcursus',
        landingPage: 'https://frissestart.nl/heftruck-cursus',
        keywords: [
          { text: 'heftruckcertificaat eindhoven', matchType: 'EXACT', bid: 2.80 },
          { text: 'heftruck cursus geldrop', matchType: 'EXACT', bid: 2.50 },
          { text: 'heftruckcertificaat behalen', matchType: 'PHRASE', bid: 2.70 }
        ],
        headlines: [
          'Heftruckcertificaat Halen',
          'Cursus Regio Eindhoven',
          'In 1 Dag Je Certificaat',
          'Veiligheid & Praktijk',
          'FrisseStart Opleidingen',
          'Geldrop & Eindhoven',
          'Certificaat 5 Jaar Geldig',
          'Erkende Veiligheidstraining',
          'Direct Inschrijven',
          'Snel & Voordelig',
          'Praktijkgericht',
          'Voor Bedrijven & Particulier',
          'Veilig Werken In Magazijn',
          'Ervaren Instructeurs',
          'FrisseStart Heftruck'
        ],
        descriptions: [
          'Haal snel je heftruckcertificaat in regio Eindhoven & Geldrop. 1-daagse praktijkcursus.',
          'Officieel erkend certificaat 5 jaar geldig. Schrijf je direct in bij FrisseStart.',
          'Voor beginners en ervaren machinisten. Scherpe tarieven en snel een plekje.'
        ]
      },
      {
        name: 'VCA Cursus',
        landingPage: 'https://frissestart.nl/vca-cursus',
        keywords: [
          { text: 'vca behalen regio geldrop', matchType: 'EXACT', bid: 2.90 },
          { text: 'vca cursus eindhoven', matchType: 'PHRASE', bid: 2.80 },
          { text: 'vca basis certificaat', matchType: 'PHRASE', bid: 2.60 }
        ],
        headlines: [
          'VCA Cursus Regio Geldrop',
          'VCA Basis & VOL Behalen',
          'Erkend VCA Examen',
          'Eindhoven & Geldrop',
          'FrisseStart Veiligheid',
          'Direct Geaccrediteerd',
          'Hoge Slaagkans',
          'Snel Je VCA Certificaat',
          'Dag- & Avondcursussen',
          'Inclusief Examen',
          'Voor Transport & Bouw',
          'Schrijf Je Nu In',
          'Scherp Tarief',
          'FrisseStart Training',
          'VCA Diplomeren'
        ],
        descriptions: [
          'Behaal je VCA diploma snel in regio Geldrop en Eindhoven met een hoge slaagkans.',
          'Inclusief officieel VCA examen en digitaal certificaat. Schrijf je direct in.',
          'Dagcursussen en e-learning opties beschikbaar voor VCA Basis en VOL.'
        ]
      }
    ]
  }
};

/**
 * Generate structured Google Ads campaign object
 */
function generateCampaignFromBlueprint(blueprintKey, customSettings = {}) {
  const blueprint = CAMPAIGN_BLUEPRINTS[blueprintKey] || CAMPAIGN_BLUEPRINTS['code-95-hercertificering'];
  
  const campaign = {
    name: customSettings.name || blueprint.name,
    budgetDailyEur: customSettings.dailyBudget || blueprint.dailyBudget,
    targetLocations: customSettings.targetLocations || blueprint.targetLocations,
    status: 'PAUSED',
    negatives: DEFAULT_NEGATIVE_KEYWORDS.map(kw => ({ text: kw, matchType: 'PHRASE' })),
    groups: blueprint.groups.map(g => ({
      name: g.name,
      landingPageUrl: g.landingPage,
      keywords: g.keywords,
      copy: {
        headlines: g.headlines.map(h => fitText(h, 30)),
        descriptions: g.descriptions.map(d => fitText(d, 90)),
        finalUrl: g.landingPage
      }
    }))
  };

  return campaign;
}

/**
 * Generate Google Ads Editor compatible CSV string
 */
function generateGoogleAdsEditorCSV(campaign) {
  const rows = [];
  rows.push([
    'Campaign',
    'Ad Group',
    'Keyword',
    'Criterion Type',
    'Headline 1',
    'Headline 2',
    'Headline 3',
    'Headline 4',
    'Headline 5',
    'Headline 6',
    'Headline 7',
    'Headline 8',
    'Headline 9',
    'Headline 10',
    'Headline 11',
    'Headline 12',
    'Headline 13',
    'Headline 14',
    'Headline 15',
    'Description 1',
    'Description 2',
    'Description 3',
    'Description 4',
    'Final URL',
    'Max CPC',
    'Campaign Daily Budget',
    'Location'
  ].join(','));

  for (const neg of campaign.negatives) {
    rows.push([
      `"${campaign.name}"`,
      '""',
      `"${neg.text}"`,
      `"Negative ${neg.matchType.toLowerCase()}"`,
      '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""',
      '""', '""', '""', '""',
      '""',
      '""',
      `"${campaign.budgetDailyEur}"`,
      `"${campaign.targetLocations}"`
    ].join(','));
  }

  for (const group of campaign.groups) {
    for (const kw of group.keywords) {
      rows.push([
        `"${campaign.name}"`,
        `"${group.name}"`,
        `"${kw.text}"`,
        `"${kw.matchType}"`,
        '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""',
        '""', '""', '""', '""',
        `"${group.landingPageUrl}"`,
        `"${kw.bid}"`,
        `"${campaign.budgetDailyEur}"`,
        '""'
      ].join(','));
    }

    const h = group.copy.headlines || [];
    const d = group.copy.descriptions || [];
    rows.push([
      `"${campaign.name}"`,
      `"${group.name}"`,
      '""',
      '"Responsive search ad"',
      `"${h[0] || ''}"`, `"${h[1] || ''}"`, `"${h[2] || ''}"`, `"${h[3] || ''}"`, `"${h[4] || ''}"`,
      `"${h[5] || ''}"`, `"${h[6] || ''}"`, `"${h[7] || ''}"`, `"${h[8] || ''}"`, `"${h[9] || ''}"`,
      `"${h[10] || ''}"`, `"${h[11] || ''}"`, `"${h[12] || ''}"`, `"${h[13] || ''}"`, `"${h[14] || ''}"`,
      `"${d[0] || ''}"`, `"${d[1] || ''}"`, `"${d[2] || ''}"`, `"${d[3] || ''}"`,
      `"${group.landingPageUrl}"`,
      '""',
      '""',
      '""'
    ].join(','));
  }

  return rows.join('\n');
}

module.exports = {
  CAMPAIGN_BLUEPRINTS,
  DEFAULT_NEGATIVE_KEYWORDS,
  generateCampaignFromBlueprint,
  generateGoogleAdsEditorCSV
};
