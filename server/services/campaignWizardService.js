const axios = require('axios');
const db = require('../db');

/**
 * AI Specialist Agent Personas
 */
const AGENT_PERSONAS = {
  campaign_lead: {
    id: 'campaign_lead',
    name: 'Campagne Strateeg & Lead Funnel Architect',
    badge: '👑 Lead Strateeg',
    description: 'Bouwt hoog-converterende landingspagina’s, lead magnets en funnelstructuren.',
    systemPrompt: `Je bent een top-tier Campagne Strateeg en Lead Funnel Architect voor FrisseStart.nl.
Je specialiseert je in het opzetten van complete lead-genererende landingspagina's en conversie-funnels voor de transport- en logistieksector (zoals Code 95, certificering, nascholing en veiligheid).
Je stijl is overtuigend, helder, professioneel, direct en no-nonsense.
Focus altijd op:
1. Pakkende Hero headline en subhead met directe waardepropositie.
2. Duidelijke urgentie/aanleiding (bijv. naderende deadline, urentekort).
3. Concreet aanbod & planning (de oplossing, bijv. speciale reparatieactie / extra opleidingsdagen).
4. Gesplitste invalshoek voor B2C (chauffeur/ZZP) én B2B (werkgever/transportbedrijf).
5. Onweerstaanbare Call to Action (CTA) en lead capture formulier opzet.
6. FAQ met bezwaren wegnemen.
Lever schone, gestructureerde Markdown met duidelijke koppen (H1, H2, H3), bulletpoints en actieknoppen.`
  },

  seo_writer: {
    id: 'seo_writer',
    name: 'Senior SEO Specialist & Content Auteur',
    badge: '🖋️ SEO Specialist',
    description: 'Schrijft diepgaande, zoekmachine-geoptimaliseerde blogconcepten die doorkoppelen naar de landingspagina.',
    systemPrompt: `Je bent een Senior SEO Copywriter en Content Specialist voor FrisseStart.nl.
Je taak is het schrijven van een diepgaand, informatief en converterend blog- en kennisbankartikel.
Belangrijke regels:
1. Schrijf een logische H1 en H2/H3 structuur met zoekwoorden (zoals Code 95, nascholing, reparatieactie, 35 uur).
2. Verwerk alle feiten, data, aanleiding en doelgroepen uit de briefing.
3. Behandel de gevolgen van het niet tijdig afronden van de nascholing.
4. Voeg minimaal 2 tot 3 prominente interne links en CTA-blokken toe die direct verwijzen naar de centrale Landingspagina van de campagne.
5. Sluit af met een beknopte FAQ (Veelgestelde Vragen) in Schema.org FAQ-stijl.
6. Schrijf in natuurlijk, vlot Nederlands (jij/je-vorm), deskundig en actiegericht.`
  },

  linkedin_b2b: {
    id: 'linkedin_b2b',
    name: 'B2B LinkedIn Marketing Specialist',
    badge: '👔 B2B LinkedIn',
    description: 'Creëert zakelijke, gezaghebbende LinkedIn posts voor werkgevers, transportmanagers en chauffeurs.',
    systemPrompt: `Je bent een B2B LinkedIn Marketing & Social Selling Expert voor FrisseStart.nl.
Je schrijft impactvolle LinkedIn posts gericht op transportbedrijven, logistiek managers, HR en professionele chauffeurs/ZZP'ers.
Formule voor succesvolle LinkedIn posts:
1. Sterke hook in de eerste 2 regels (voorkomt wegscrollen).
2. De zakelijke en wettelijke realiteit (urgentie rond deadlines, boetes, stilstaande vrachtwagens).
3. De praktische oplossing van FrisseStart (extra planning, SOOB subsidie, flexibiliteit).
4. Duidelijke call-to-action met de link naar de Campagne Landingspagina.
5. Relevante hashtags (#Code95 #TransportEnLogistiek #Chauffeurs #Nascholing #FrisseStart).
Lever 2 variaties: Variatie 1 gericht op Werkgevers/Transporteurs (B2B) en Variatie 2 gericht op Zelfstandige Chauffeurs/ZZP (B2C/Professioneel).`
  },

  social_community: {
    id: 'social_community',
    name: 'Social Media & Community Expert',
    badge: '👥 Social Expert',
    description: 'Schrijft herkenbare, interactieve posts voor Facebook en Instagram met hoge attentiewaarde.',
    systemPrompt: `Je bent een Social Media Copywriter voor FrisseStart.nl gespecialiseerd in Facebook en Instagram.
Je toon is vriendelijk, no-nonsense, herkenbaar en direct gericht op chauffeurs en planners.
Belangrijke elementen:
1. Korte, krachtige zinnen en herkenbare emoji's.
2. Directe herkenning: "Code 95 uren nog niet compleet voor september? Geen paniek!"
3. Duidelijke opsomming van beschikbare data en locaties.
4. Duidelijke link naar de Campagne Landingspagina om direct een plek te reserveren.
5. Voor Instagram: Inclusief visueel beeldconcept (wat staat er op de afbeelding/carousel) en swipe-suggesties.
Lever zowel een kant-en-klare Facebook post als een Instagram Carousel / Post script.`
  },

  email_conversion: {
    id: 'email_conversion',
    name: 'Conversie E-mail Marketeer',
    badge: '✉️ E-mail Specialist',
    description: 'Schrijft converterende e-mail flows en nieuwsbrieven voor zowel chauffeurs als zakelijke klanten.',
    systemPrompt: `Je bent een Direct-Response E-mail Marketeer voor FrisseStart.nl.
Je schrijft e-mails met hoge open-rates en doorklikratio's naar de Landingspagina.
Richtlijnen:
1. Bied per e-mail minimaal 3 prikkelende onderwerpregels (Subject Lines) + Preview Snippet.
2. Schrijf 2 complete e-mails:
   - E-mail A: Gericht aan Chauffeurs (B2C / ZZP) - focus op tijdig behouden van rijbewijs en snelle dataplanning.
   - E-mail B: Gericht aan Werkgevers & Transportbedrijven (B2B) - focus op ontzorgen van het wagenpark, SOOB-subsidies en groepsinplanning.
3. Elke e-mail heeft duidelijke knoppen/links naar de Campagne Landingspagina.
4. Schrijf ook een korte 'P.S.' en een 'E-mail Handtekening Banner Snippet' die het hele team onder uitgaande e-mails kan zetten.`
  },

  ad_copywriter: {
    id: 'ad_copywriter',
    name: 'Performance Ad Copywriter',
    badge: '🎯 Ads Specialist',
    description: 'Genereert pakkende Google Ads en Social Media Ad koppen en beschrijvingen.',
    systemPrompt: `Je bent een Performance Copywriter voor Google Ads en Meta Ads bij FrisseStart.nl.
Je levert strakke advertentieteksten die maximaal converteren naar de Landingspagina.
Output structuur:
1. Google Search Ads (10 pakkende Responsive Search Headlines van max 30 tekens, 4 Descriptions van max 90 tekens).
2. Meta/Facebook Ads (3 Primary texts: Korte variant, Urgentie variant, Verhaal variant + Koppen + CTA Knoppen).
3. Doellink: Verwijst altijd naar de centrale campagnepagina.`
  }
};

/**
 * Supported AI Models
 */
const SUPPORTED_MODELS = [
  { id: 'auto', name: 'Auto (Beste Beschikbare Model)', provider: 'auto' },
  { id: 'openai_gpt4o_mini', name: 'OpenAI GPT-4o-mini (Snel & Scherp)', provider: 'openai', modelName: 'gpt-4o-mini' },
  { id: 'openai_gpt4o', name: 'OpenAI GPT-4o (Maximaal Creatief)', provider: 'openai', modelName: 'gpt-4o' },
  { id: 'gemini_flash', name: 'Google Gemini Flash (Ultra Snel)', provider: 'gemini', modelName: 'gemini-2.5-flash' },
  { id: 'gemini_pro', name: 'Google Gemini Pro (Diepgaand)', provider: 'gemini', modelName: 'gemini-2.5-pro' },
  { id: 'openrouter_llama', name: 'OpenRouter Llama 3.3 70B (Open Source)', provider: 'openrouter', modelName: 'meta-llama/llama-3.3-70b-instruct' }
];

/**
 * Execute AI Completion via OpenAI / Gemini / OpenRouter with multi-key fallback
 */
async function callAiModel({ systemPrompt, userPrompt, modelId = 'auto' }) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  const modelConfig = SUPPORTED_MODELS.find(m => m.id === modelId) || SUPPORTED_MODELS[0];
  let targetProvider = modelConfig.provider;

  if (targetProvider === 'auto') {
    if (geminiKey) targetProvider = 'gemini';
    else if (openaiKey) targetProvider = 'openai';
    else if (openrouterKey) targetProvider = 'openrouter';
    else targetProvider = 'fallback';
  }

  // 1. Google Gemini
  if (targetProvider === 'gemini' && geminiKey) {
    try {
      const geminiModel = modelConfig.modelName || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
      const res = await axios.post(url, {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n--- INSTRUCTIE EN CONTEXT ---\n${userPrompt}` }
            ]
          }
        ]
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 90000 });

      const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { success: true, text, providerUsed: `Google Gemini (${geminiModel})` };
      }
    } catch (err) {
      console.warn('[campaignWizard] Gemini call failed, trying OpenAI fallback:', err.message);
      if (openaiKey) targetProvider = 'openai';
      else if (openrouterKey) targetProvider = 'openrouter';
    }
  }

  // 2. OpenAI
  if (targetProvider === 'openai' && openaiKey) {
    try {
      const openaiModel = modelConfig.modelName || 'gpt-4o-mini';
      const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000
      });

      const text = res.data.choices?.[0]?.message?.content;
      if (text) {
        return { success: true, text, providerUsed: `OpenAI (${openaiModel})` };
      }
    } catch (err) {
      console.warn('[campaignWizard] OpenAI call failed, trying OpenRouter fallback:', err.message);
      if (openrouterKey) targetProvider = 'openrouter';
    }
  }

  // 3. OpenRouter
  if (targetProvider === 'openrouter' && openrouterKey) {
    try {
      const orModel = modelConfig.modelName || 'meta-llama/llama-3.3-70b-instruct';
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: orModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000
      });

      const text = res.data.choices?.[0]?.message?.content;
      if (text) {
        return { success: true, text, providerUsed: `OpenRouter (${orModel})` };
      }
    } catch (err) {
      console.warn('[campaignWizard] OpenRouter call failed:', err.message);
    }
  }

  // Smart Synthesizer Fallback if API keys fail or offline
  return {
    success: true,
    text: synthesizeOfflineFallback(systemPrompt, userPrompt),
    providerUsed: 'FrisseStart AI Assistant (Offline Synthesizer)'
  };
}

/**
 * Smart Offline Synthesizer Fallback (Safety net if APIs are down)
 */
function synthesizeOfflineFallback(systemPrompt, userPrompt) {
  return `### Gegenereerde Campagne Content\n\n*Op basis van de ingevoerde context en briefing:*\n\n${userPrompt.substring(0, 300)}...\n\n**Actieplan & Kernboodschap:**\n- Centrale landingspagina lead capture actief\n- Urgentie benadrukt met directe inschrijf-CTA\n- Inhoud afgestemd op zowel chauffeurs (B2C) als transportbedrijven (B2B).\n\n*(Tip: Controleer uw OpenAI of Gemini API sleutels in de instellingen voor realtime live modelgeneratie)*`;
}

/**
 * Generate Channel Content Prompt
 */
function buildChannelPrompt({ channelKey, campaignTitle, briefingText, targetLandingUrl, customInstructions, targetAudience }) {
  const landingUrl = targetLandingUrl || 'https://frissestart.nl/campagne/code95-reparatieactie';
  
  let channelSpecificTask = '';
  switch (channelKey) {
    case 'landing_page':
      channelSpecificTask = `
TAAK: Schrijf de complete opzet en teksten voor de centrale Landingspagina / Lead Funnel.
De Landingspagina URL wordt: ${landingUrl}
Zorg dat de pagina bevat:
1. Bovenkant (Hero): Krachtige H1, H2, Subkop en directe CTA knop ("Bekijk Reparatieplanning / Meld je direct aan").
2. Urgentie & Aanleiding: Waarom dit nú actueel is (bijv. verlopende uren / termijn) en wat de risico's zijn als je niets doet.
3. De Oplossing: Wat houdt de FrisseStart actie / opleiding in, hoe flexibel is het en wanneer vindt het plaats.
4. Twee Duidelijke Invalshoeken:
   - Voor Chauffeurs & ZZP (B2C): Snel certificaat behouden, weekend/avond opties, SOOB subsidie.
   - Voor Werkgevers & Transporteurs (B2B): Meerdere chauffeurs in één keer inplannen, wagenpark compliant, ontzorging.
5. Overzicht van Cursussen & Data met duidelijke actie-knoppen.
6. Lead Capture Formulier Specificatie (welke velden: Naam, Bedrijf/ZZP, Aantal uren nodig, Telefoon, E-mail).
7. FAQ Sectie (4-5 veelgestelde vragen met heldere antwoorden).
`;
      break;

    case 'blog':
      channelSpecificTask = `
TAAK: Schrijf een compleet, diepgaand SEO Blog & Kennisbank Artikel.
BELANGRIJKSTE VEREISTE: Dit blog dient als SEO-anker en MOET minimaal 3 keer doorkoppelen naar de centrale landingspagina: ${landingUrl}
Structuur:
1. SEO Titel & Meta Description (met hoog doorklikpercentage).
2. H1 Titel en inleiding met de actuele aanleiding.
3. H2: Wat betekent het als je nascholingsuren niet compleet zijn? (Boetes, ongeldig rijbewijs, gevolgen).
4. H2: De Oplossing: Wat is de actie en hoe haal je alsnog je uren in?
5. Callout / CTA Box (Prominent kader met link naar: ${landingUrl}).
6. H2: Wat zijn de voordelen voor werkgevers en chauffeurs? (SOOB subsidie, flexibele e-learning, snelle certificering).
7. H2: Hoe ziet de planning en aanmelding eruit?
8. Slotconclusie + Grote Eind-CTA die verwijst naar ${landingUrl}.
9. Veelgestelde vragen (FAQ) in Schema-structuur.
`;
      break;

    case 'linkedin':
      channelSpecificTask = `
TAAK: Schrijf 2 professionele, converterende LinkedIn posts gericht op het zakelijke transportnetwerk.
Elke post MOET eindigen met een duidelijke link naar de centrale landingspagina: ${landingUrl}

Post 1 (Focus op Werkgevers, Transporteurs & Planners - B2B):
- Open met een sterke hook over wagenpark-compliance, chauffeurs en de naderende deadline.
- Leg uit hoe FrisseStart helpt met extra planning en SOOB-subsidies.
- CTA: Link naar ${landingUrl} om chauffeurs aan te melden of planning te bekijken.
- Relevante zakelijke hashtags.

Post 2 (Focus op Zelfstandige Chauffeurs / ZZP'ers - B2C/Pro):
- Open met herkenbare situatie voor chauffeurs (uren nog niet compleet).
- Benadruk dat er direct extra opleidingsdagen zijn ingepland.
- CTA: Link naar ${landingUrl} om je plek veilig te stellen.
- Relevante hashtags.
`;
      break;

    case 'facebook':
      channelSpecificTask = `
TAAK: Schrijf 2 toegankelijke, herkenbare Facebook posts voor chauffeurs, logistiek medewerkers en hun netwerk.
Toon: Direct, oplossingsgericht, vriendelijk en met passende emoji's.
Elke post MOET direct linken naar: ${landingUrl}

Post 1: Urgentie & Oplossing ("Nog nascholingsuren nodig? We hebben extra planning geopend!")
Post 2: Laatste kans / Praktische tip ("Voorkom dat je rijbewijs verloopt — haal je laatste uren snel in").
Voeg duidelijke call-to-action knoppen toe zoals: 👉 Bekijk de data en schrijf je in: ${landingUrl}
`;
      break;

    case 'instagram':
      channelSpecificTask = `
TAAK: Maak een Instagram Content Concept (Carousel + Caption + Story Script).
Doel: Chauffeurs en volgers visueel triggeren en via de 'Link in bio' of Story-sticker sturen naar: ${landingUrl}
Structuur:
1. Carousel Opzet (Slide 1 t/m 5: Visuele tekst per slide met stop-scroll hook).
2. Instagram Caption (Inclusief pakkende eerste zin, heldere uitleg, CTA naar Link in Bio en hashtags).
3. Instagram Story Tekst & Sticker-suggestie (Korte 15-seconden story tekst met 'Link Sticker' naar ${landingUrl}).
`;
      break;

    case 'email':
      channelSpecificTask = `
TAAK: Schrijf 2 complete e-mailcampagnes (B2C & B2B) inclusief onderwerpregels en preview teksten.
Elke e-mail MOET meerdere actieknoppen / links bevatten naar de centrale landingspagina: ${landingUrl}

E-mail 1: Voor Chauffeurs & ZZP'ers (B2C)
- 3 Onderwerpregels (A/B test opties) + Preview tekst.
- Persoonlijke, no-nonsense aanhef en herkenbare urgentie.
- Concreet aanbod (extra data, snelle cursus, SOOB).
- Grote opvallende CTA knop naar ${landingUrl}.

E-mail 2: Voor Werkgevers, Transportbedrijven & Planners (B2B)
- 3 Onderwerpregels + Preview tekst.
- Focus op continuïteit van de chauffeurs, subsidie en groepsaanmelding.
- Duidelijke CTA naar ${landingUrl} + optie voor direct telefonisch overleg.
`;
      break;

    case 'email_signature':
      channelSpecificTask = `
TAAK: Schrijf 3 varianten voor een E-mail Handtekening Banner / P.S.-tekst die het hele FrisseStart-team onder hun dagelijkse e-mails kan plaatsen tijdens de campagne.
Elke variant moet kort, krachtig en klikbaar zijn en verwijzen naar: ${landingUrl}
- Variant 1: Urgentie & Deadline focus (1 regel tekst + link)
- Variant 2: Oplossing & Planning focus (2 regels met bullet/emoji + link)
- Variant 3: Werkgevers & Chauffeurs combi (korte P.S. snippet)
`;
      break;

    case 'ad_copy':
      channelSpecificTask = `
TAAK: Schrijf hoog-converterende advertentieteksten voor Google Search Ads en Social Media Ads.
Doel URL: ${landingUrl}
1. Google Responsive Search Ads:
   - 10 Koppen (Headlines, max 30 tekens per stuk)
   - 4 Beschrijvingen (Descriptions, max 90 tekens per stuk)
2. Meta Ads (Facebook & Instagram):
   - 2 Primaire teksten (Kort & Verhalend)
   - 2 Koppen
   - Aanbevolen CTA button
`;
      break;

    default:
      channelSpecificTask = `TAAK: Schrijf marketingcontent voor ${channelKey} en zorg voor duidelijke links naar ${landingUrl}.`;
  }

  return `
CAMPAGNE TITEL: ${campaignTitle}
DOELGROEP: ${targetAudience || 'B2C Chauffeurs & B2B Werkgevers/Transportbedrijven'}
CENTRALE LANDINGSPAGINA URL: ${landingUrl}

--- VOLLEDIGE BRIEFING & CONTEXT ---
${briefingText}

--- EXTRA AANGEPASTE INSTRUCTIES ---
${customInstructions || 'Geen extra instructies. Pas de bewezen FrisseStart standaarden toe.'}

--- OPDRACHT VOOR DIT KANAAL ---
${channelSpecificTask}
`;
}

/**
 * Generate Single Channel Content
 */
async function generateCampaignChannel({
  campaignTitle,
  briefingText,
  targetLandingUrl,
  targetAudience,
  channelKey,
  agentRoleId = 'campaign_lead',
  modelId = 'auto',
  customInstructions = ''
}) {
  const agent = AGENT_PERSONAS[agentRoleId] || AGENT_PERSONAS.campaign_lead;
  const userPrompt = buildChannelPrompt({
    channelKey,
    campaignTitle,
    briefingText,
    targetLandingUrl,
    customInstructions,
    targetAudience
  });

  const aiResult = await callAiModel({
    systemPrompt: agent.systemPrompt,
    userPrompt,
    modelId
  });

  return {
    channelKey,
    agentRole: agent.name,
    agentBadge: agent.badge,
    modelUsed: aiResult.providerUsed,
    content: aiResult.text,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Resolve valid project ID
 */
function resolveProjectId(projectId) {
  if (projectId) {
    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (existing) return existing.id;
  }
  const first = db.prepare('SELECT id FROM projects ORDER BY id ASC LIMIT 1').get();
  if (first) return first.id;
  
  const info = db.prepare('INSERT INTO projects (name, domain) VALUES (?, ?)').run('FrisseStart', 'https://frissestart.nl');
  return info.lastInsertRowid;
}

/**
 * Save or Update Campaign in Database
 */
function saveCampaign({ id, projectId, title, targetUrl, briefingText, targetAudience, channels, generatedContent, status = 'draft' }) {
  const pId = resolveProjectId(projectId);
  const channelsJson = JSON.stringify(channels || []);
  const contentJson = JSON.stringify(generatedContent || {});

  if (id) {
    const stmt = db.prepare(`
      UPDATE campaign_wizards 
      SET title = ?, target_url = ?, briefing_text = ?, target_audience = ?, channels_json = ?, generated_content_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND project_id = ?
    `);
    stmt.run(title, targetUrl, briefingText, targetAudience, channelsJson, contentJson, status, id, pId);
    return getCampaignById(id);
  } else {
    const stmt = db.prepare(`
      INSERT INTO campaign_wizards (project_id, title, target_url, briefing_text, target_audience, channels_json, generated_content_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(pId, title, targetUrl, briefingText, targetAudience, channelsJson, contentJson, status);
    return getCampaignById(info.lastInsertRowid);
  }
}

/**
 * Get all campaigns for a project
 */
function getAllCampaigns(projectId) {
  const pId = resolveProjectId(projectId);
  const rows = db.prepare('SELECT * FROM campaign_wizards WHERE project_id = ? ORDER BY id DESC').all(pId);
  return rows.map(r => ({
    ...r,
    channels: r.channels_json ? JSON.parse(r.channels_json) : [],
    generatedContent: r.generated_content_json ? JSON.parse(r.generated_content_json) : {}
  }));
}

/**
 * Get campaign by ID
 */
function getCampaignById(id) {
  const row = db.prepare('SELECT * FROM campaign_wizards WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    channels: row.channels_json ? JSON.parse(row.channels_json) : [],
    generatedContent: row.generated_content_json ? JSON.parse(row.generated_content_json) : {}
  };
}

/**
 * Delete campaign by ID
 */
function deleteCampaign(id) {
  return db.prepare('DELETE FROM campaign_wizards WHERE id = ?').run(id);
}

module.exports = {
  AGENT_PERSONAS,
  SUPPORTED_MODELS,
  generateCampaignChannel,
  saveCampaign,
  getAllCampaigns,
  getCampaignById,
  deleteCampaign
};
