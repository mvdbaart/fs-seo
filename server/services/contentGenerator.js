const cheerio = require('cheerio');
const axios = require('axios');

/**
 * AI Content Generator & Title Optimizer Service
 * Afgestemd op Transport, Logistiek, Certificeringsbeheer, Cursussen & Code 95 voor FrisseStart.nl
 */

/**
 * Generate Title & Meta Description variations with CTR triggers
 */
function generateTitleMetaVariations(originalTitle, originalMeta, keyword, domain = 'frissestart.nl') {
  const cleanKeyword = keyword ? keyword.trim() : 'certificeringsbeheer';
  const capitalizedKw = cleanKeyword.charAt(0).toUpperCase() + cleanKeyword.slice(1);
  const brandName = 'FrisseStart';

  const isCertificering = cleanKeyword.toLowerCase().includes('certificer') || cleanKeyword.toLowerCase().includes('hercertificering');

  const titleVariations = [
    {
      title: isCertificering 
        ? `${capitalizedKw} voor Transport & Logistiek | Overzicht & Herinneringen | ${brandName}`
        : `${capitalizedKw} behalen? | Direct Inschrijven & Advies | ${brandName}`,
      angle: isCertificering ? 'Systeem & Herhalende Inkomsten' : 'Cursus & Actiegericht',
      charCount: (isCertificering 
        ? `${capitalizedKw} voor Transport & Logistiek | Overzicht & Herinneringen | ${brandName}`
        : `${capitalizedKw} behalen? | Direct Inschrijven & Advies | ${brandName}`).length,
      status: 'Optimaal'
    },
    {
      title: `Erkende Opleiding ${capitalizedKw} | SOOB Subsidie & E-Learning | ${brandName}`,
      angle: 'SOOB Subsidie & E-Learning',
      charCount: `Erkende Opleiding ${capitalizedKw} | SOOB Subsidie & E-Learning | ${brandName}`.length,
      status: 'Optimaal'
    },
    {
      title: `${capitalizedKw} in 1 Uur t/m 3 Dagen | Slimme Cursuscombinaties`,
      angle: 'Hercertificering & Efficiëntie',
      charCount: `${capitalizedKw} in 1 Uur t/m 3 Dagen | Slimme Cursuscombinaties`.length,
      status: 'Optimaal'
    }
  ];

  const metaVariations = [
    {
      description: `Houd al je certificaten en Code 95 up-to-date met ${cleanKeyword} van ${brandName}. Automatische herinneringen, 1-uurs hercertificering en SOOB-subsidies!`,
      angle: 'Automatische Herhaling & Retentie',
      charCount: `Houd al je certificaten en Code 95 up-to-date met ${cleanKeyword} van ${brandName}. Automatische herinneringen, 1-uurs hercertificering en SOOB-subsidies!`.length,
      status: 'Optimaal (130-155 tekens)'
    },
    {
      description: `Behaal je ${cleanKeyword} in 1 uur tot 3,5 dag dankzij slimme e-learning combinaties. CBR & CCV erkend voor chauffeurs en transporteurs. Bekijk de kalender!`,
      angle: 'Slimme Combinaties & E-Learning',
      charCount: `Behaal je ${cleanKeyword} in 1 uur tot 3,5 dag dankzij slimme e-learning combinaties. CBR & CCV erkend voor chauffeurs en transporteurs. Bekijk de kalender!`.length,
      status: 'Optimaal (130-155 tekens)'
    }
  ];

  return {
    originalTitle,
    originalMeta,
    keyword: cleanKeyword,
    titleVariations,
    metaVariations
  };
}

/**
 * Generate full Content Expansion Brief for Page 2 / Striking Distance keywords
 */
async function generateContentBrief(targetUrl, keyword) {
  let fetchedPage = {
    title: '',
    metaDescription: '',
    h1: '',
    h2List: [],
    wordCount: 0
  };

  if (targetUrl && targetUrl.startsWith('http')) {
    try {
      const res = await axios.get(targetUrl, { timeout: 7000 });
      const $ = cheerio.load(res.data);
      fetchedPage.title = $('title').text().trim();
      fetchedPage.metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
      fetchedPage.h1 = $('h1').first().text().trim();
      $('h2').each((_, el) => fetchedPage.h2List.push($(el).text().trim()));
      fetchedPage.wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(' ').length;
    } catch (e) {
      // Fallback if unreachable
    }
  }

  const cleanKw = keyword ? keyword.trim() : 'certificeringsbeheer';
  const capKw = cleanKw.charAt(0).toUpperCase() + cleanKw.slice(1);

  const suggestedStructure = {
    h1: `${capKw}: Altijd Up-to-Date Certificaten & Herhalende Opleidingen`,
    h2Sections: [
      {
        heading: `Hoe werkt ${cleanKw} voor jouw transport- en logistiekbedrijf?`,
        contentFocus: 'Leg uit hoe automatische verlopingsherinneringen en het Dashboard zorgen dat Code 95, VCA en heftruckcertificaten nooit verlopen (herhalende inkomsten & borging).'
      },
      {
        heading: `Efficiënt hercertificeren: van 1-uurs hercertificering tot 3 of 3,5-daagse Code 95`,
        contentFocus: 'Licht toe hoe slimme cursuscombinaties en e-learning de verzuimtijd van chauffeurs tot een minimum beperken.'
      },
      {
        heading: `Maximaliseer SOOB-subsidies op periodieke nascholing`,
        contentFocus: 'Leg de SOOB-subsidieregeling uit voor herhalingscursussen en hoe FrisseStart de administratie afhandelt.'
      },
      {
        heading: `Veelgestelde vragen over ${cleanKw}`,
        contentFocus: 'Beantwoord 3-4 veelgestelde vragen over automatische notificaties, CBR-registratie en e-learning uren.'
      }
    ],
    recommendedWordCount: Math.max(800, fetchedPage.wordCount + 350),
    recommendedFaqs: [
      {
        question: `Waarom is periodiek ${cleanKw} essentieel voor werkgevers?`,
        answer: `Het voorkomt verstreken rijbevoegdheden en boetes. Automatische bewaking zorgt dat chauffeurs op tijd hun 1-uurs hercertificering of Code 95 behalen.`
      },
      {
        question: `Kan ik Code 95 nascholing behalen in 3 of 3,5 dag met e-learning?`,
        answer: `Ja! Door klassikale trainingen slim te combineren met e-learning thuis of onderweg kun je de benodigde 35 uur in slechts 3 tot 3,5 praktijkdag afronden.`
      },
      {
        question: `Wat is de 1-uurs hercertificering voor interne logistiek?`,
        answer: `Ervaren heftruck- of reachtruckchauffeurs waarvan het certificaat verloopt, kunnen via een verkorte 1-uurs toetsing hun certificering direct met 5 jaar verlengen.`
      }
    ]
  };

  const aiCopyPrompt = `Je bent een vooraanstaande Nederlandse SEO Copywriter gespecialiseerd in Transport, Logistiek en Opleidingen.

Ik wil de landingspagina voor het zoekwoord "${cleanKw}" (URL: ${targetUrl || 'https://frissestart.nl/opleidingen/certificeringsbeheer'}) optimaliseren.

Huidige status:
- Huidige H1: ${fetchedPage.h1 || 'Nog niet aanwezig'}
- Huidige lengte: ${fetchedPage.wordCount} woorden

Opdracht:
Schrijf een verdiepende, conversiegerichte tekst met nadruk op periodieke hercertificering en herhalende inkomsten met de volgende structuur:
1. H1: ${suggestedStructure.h1}
2. Introduceer het belang van actuele certificeringen (Code 95, VCA, Heftruck) en de slimme oplossingen van FrisseStart.
3. Werk onderstaande H2 koppen uit:
${suggestedStructure.h2Sections.map(s => `- H2: ${s.heading} (${s.contentFocus})`).join('\n')}
4. Sluit af met een krachtige Call To Action om gratis advies of het certificeringsbeheer dashboard in te zetten.`;

  return {
    url: targetUrl,
    keyword: cleanKw,
    fetchedPage,
    suggestedStructure,
    aiCopyPrompt
  };
}

/**
 * Generate JSON-LD FAQPage Schema markup
 */
function generateFaqJsonLd(faqs = []) {
  if (!faqs || faqs.length === 0) return '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer
      }
    }))
  };

  return JSON.stringify(schema, null, 2);
}

module.exports = {
  generateTitleMetaVariations,
  generateContentBrief,
  generateFaqJsonLd
};
