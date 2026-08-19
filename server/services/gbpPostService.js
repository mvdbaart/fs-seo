const axios = require('axios');
const db = require('../db');
const googleOAuth = require('./googleOAuth');
const gbpService = require('./gbpService');
const { generateAiContent } = require('./aiGenerator');

/**
 * Google Bedrijfsprofiel Posts (localPosts) Service
 * - AI Generator voor Google Posts (Heftruck, Reachtruck, VCA, Acties, etc.)
 * - Opslaan en beheren van concepten in SQLite
 * - Direct publiceren naar Google Bedrijfsprofiel zodra Basic API Access actief is
 */

const PRESET_TOPICS = {
  heftruck: {
    title: 'Heftruck Certificaat in 1 Dag',
    courseType: 'Heftruckcursus & Certificering',
    defaultUrl: 'https://frissestart.nl/cursussen/heftruck-certificaat',
    defaultCta: 'LEARN_MORE',
    keyBenefits: '1-daagse praktijkcursus, officieel erkend certificaat, SOOB subsidie mogelijk, ervaren instructeurs'
  },
  reachtruck: {
    title: 'Reachtruck Certificaat Snel Behalen',
    courseType: 'Reachtruckcursus & Certificering',
    defaultUrl: 'https://frissestart.nl/cursussen/reachtruck-certificaat',
    defaultCta: 'LEARN_MORE',
    keyBenefits: 'Werken op grote hoogte, smalle gangen, veiligheid, snel certificaat voor magazijn en logistiek'
  },
  vca: {
    title: 'VCA Basis & VCA VOL Certificering',
    courseType: 'VCA Cursus & Examen',
    defaultUrl: 'https://frissestart.nl/cursussen/vca-basis',
    defaultCta: 'SIGN_UP',
    keyBenefits: 'Klassikaal of e-learning, officieel SSVV examen, hoge slagingskans, voor zzp en bedrijven'
  },
  hoogwerker: {
    title: 'Hoogwerker Certificaat Cursus',
    courseType: 'Hoogwerker Opleiding',
    defaultUrl: 'https://frissestart.nl/cursussen/hoogwerker-certificaat',
    defaultCta: 'LEARN_MORE',
    keyBenefits: 'Veilig werken op hoogte (schaarhoogwerker & telescoophoogwerker), ARBO wetgeving'
  },
  lastminute: {
    title: 'Last-minute Plekken Beschikbaar!',
    courseType: 'Direct Starten Cursus',
    defaultUrl: 'https://frissestart.nl/cursussen',
    defaultCta: 'BOOK',
    keyBenefits: 'Komende week direct plaats voor heftruck- of reachtruckopleiding in Nuenen/Eindhoven'
  },
  bedrijven: {
    title: 'Incompany & Maatwerk Cursussen voor Bedrijven',
    courseType: 'Zakelijke Trainingen',
    defaultUrl: 'https://frissestart.nl/zakelijk',
    defaultCta: 'LEARN_MORE',
    keyBenefits: 'Op eigen locatie of bij FrisseStart, groepskortingen, certificaatbeheer en SOOB subsidie'
  }
};

function resolveProjectId(projectId) {
  if (projectId) {
    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (existing) return existing.id;
  }
  const first = db.prepare('SELECT id FROM projects ORDER BY id ASC LIMIT 1').get();
  return first ? first.id : 1;
}

/**
 * Genereer een wervende Google Bedrijfsprofiel post met AI
 */
async function generatePostWithAi({
  presetKey,
  topic,
  location = 'Nuenen & Regio Eindhoven',
  ctaType = 'LEARN_MORE',
  ctaUrl,
  customInstructions = '',
  style = 'opleidingen'
}) {
  const preset = PRESET_TOPICS[presetKey] || {};
  const effectiveTopic = topic || preset.title || 'Professionele Cursussen bij FrisseStart';
  const effectiveCourseType = preset.courseType || 'Opleidingen & Veiligheidscertificaten';
  const effectiveUrl = ctaUrl || preset.defaultUrl || 'https://frissestart.nl';
  const effectiveCta = ctaType || preset.defaultCta || 'LEARN_MORE';
  const keyBenefits = preset.keyBenefits || 'Erkend certificaat, snelle planning, praktijkgericht';

  const promptText = `
Schrijf een wervende en actuele Google Bedrijfsprofiel Update (Google Post / Local Post) voor FrisseStart Opleidingen.

Gegevens:
- Onderwerp: ${effectiveTopic}
- Cursustype: ${effectiveCourseType}
- Locatie/Regio: ${location} (FrisseStart trainingscentrum in Nuenen, vlakbij Eindhoven, Helmond en Geldrop)
- Belangrijkste voordelen: ${keyBenefits}
- Doel Call to Action knop: ${effectiveCta} (Verwijst naar: ${effectiveUrl})
${customInstructions ? `- Aanvullende instructies: ${customInstructions}` : ''}

Richtlijnen voor een perfecte Google Bedrijfsprofiel Post:
1. Open met een krachtige, aandachttrekkende openingszin met 1-2 passende emoji's.
2. Schrijf vlot en direct in de jij-vorm (to-the-point, no-nonsense FrisseStart stijl).
3. Benadruk de snelheid (in 1 dag je certificaat), erkenning en flexibele planning.
4. Verwerk natuurlijke lokale zoekwoorden (${location}).
5. Sluit af met een motiverende oproep tot actie.
6. Lengte: tussen de 120 en 200 woorden (optimaal voor Google Zoeken en Google Maps).

Geef ALLEEN de uiteindelijke post-tekst terug in het Nederlands, zonder metadata of aanhalingstekens.
`.trim();

  const aiResult = await generateAiContent({
    promptText,
    style
  });

  const generatedSummary = aiResult.generatedText?.trim() || '';

  return {
    title: effectiveTopic,
    summary: generatedSummary,
    topicType: 'STANDARD',
    ctaType: effectiveCta,
    ctaUrl: effectiveUrl,
    location,
    provider: aiResult.provider
  };
}

/**
 * Haal alle posts op uit de database
 */
function listPosts(projectId) {
  const pId = resolveProjectId(projectId);
  return db.prepare('SELECT * FROM gbp_posts WHERE project_id = ? ORDER BY id DESC').all(pId);
}

/**
 * Haal een specifieke post op
 */
function getPostById(id) {
  return db.prepare('SELECT * FROM gbp_posts WHERE id = ?').get(id);
}

/**
 * Bewaar of update een post
 */
function savePost(postData, projectId) {
  const pId = resolveProjectId(projectId);
  
  if (postData.id) {
    db.prepare(`
      UPDATE gbp_posts 
      SET title = ?, summary = ?, topic_type = ?, cta_type = ?, cta_url = ?, media_url = ?, status = ?, error_message = ?
      WHERE id = ?
    `).run(
      postData.title || '',
      postData.summary,
      postData.topicType || postData.topic_type || 'STANDARD',
      postData.ctaType || postData.cta_type || 'LEARN_MORE',
      postData.ctaUrl || postData.cta_url || '',
      postData.mediaUrl || postData.media_url || '',
      postData.status || 'draft',
      postData.errorMessage || postData.error_message || null,
      postData.id
    );
    return getPostById(postData.id);
  }

  const info = db.prepare(`
    INSERT INTO gbp_posts (project_id, title, summary, topic_type, cta_type, cta_url, media_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pId,
    postData.title || 'Google Bedrijfsprofiel Update',
    postData.summary,
    postData.topicType || postData.topic_type || 'STANDARD',
    postData.ctaType || postData.cta_type || 'LEARN_MORE',
    postData.ctaUrl || postData.cta_url || '',
    postData.mediaUrl || postData.media_url || '',
    postData.status || 'draft'
  );

  return getPostById(info.lastInsertRowid);
}

/**
 * Verwijder een post
 */
function deletePost(id) {
  return db.prepare('DELETE FROM gbp_posts WHERE id = ?').run(id);
}

/**
 * Publiceren naar Google Bedrijfsprofiel via de My Business API
 */
async function publishPostToGbp(postId) {
  const post = getPostById(postId);
  if (!post) throw new Error('Post niet gevonden');

  if (!googleOAuth.isConfigured('gbp')) {
    throw new Error('Google Bedrijfsprofiel OAuth is nog niet gekoppeld. Voer eerst node server/oauth-setup.js gbp uit.');
  }

  let token;
  try {
    token = await googleOAuth.getOAuthToken('gbp');
  } catch (err) {
    const msg = `Authenticatie mislukt: ${err.message}`;
    db.prepare('UPDATE gbp_posts SET status = ?, error_message = ? WHERE id = ?').run('failed', msg, postId);
    return { success: false, status: 'failed', message: msg };
  }

  // Haal locaties op
  let locationsData;
  try {
    locationsData = await gbpService.listLocations();
  } catch (err) {
    const reason = gbpService.classifyGoogleError(err);
    let msg = 'Ophalen van bedrijfslocatie mislukte.';
    if (reason === 'no_quota') {
      msg = 'Je Google Cloud project heeft nog 0 QPM quotum voor de Business Profile API (goedkeuring van formulier "Application for Basic API Access" is onderweg). Zodra goedgekeurd werkt 1-klik publicatie direct!';
    } else {
      msg = `Google API melding: ${err.message}`;
    }
    db.prepare('UPDATE gbp_posts SET status = ?, error_message = ? WHERE id = ?').run('pending_approval', msg, postId);
    return { success: false, status: 'pending_approval', message: msg, quotaPending: reason === 'no_quota' };
  }

  const locations = locationsData.locations || [];
  if (locations.length === 0) {
    const msg = 'Geen actieve bedrijfslocaties gevonden in het gekoppelde Google-account.';
    db.prepare('UPDATE gbp_posts SET status = ?, error_message = ? WHERE id = ?').run('failed', msg, postId);
    return { success: false, status: 'failed', message: msg };
  }

  const locationResourceName = gbpService.resolveLocationName(locations) || locations[0].name;

  // Google localPosts payload
  const payload = {
    languageCode: 'nl',
    summary: post.summary,
    topicType: post.topic_type || 'STANDARD'
  };

  if (post.cta_type && post.cta_type !== 'ACTION_TYPE_UNSPECIFIED') {
    payload.callToAction = {
      actionType: post.cta_type,
      url: post.cta_url || 'https://frissestart.nl'
    };
  }

  if (post.media_url && post.media_url.startsWith('http')) {
    payload.media = [
      {
        mediaFormat: 'PHOTO',
        sourceUrl: post.media_url
      }
    ];
  }

  try {
    // Google Business Profile Local Posts endpoint
    // https://mybusiness.googleapis.com/v4/{name=accounts/*/locations/*}/localPosts
    const postUrl = `https://mybusiness.googleapis.com/v4/${locationResourceName}/localPosts`;
    const response = await axios.post(postUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const publishedPostId = response.data?.name || 'published';
    db.prepare(`
      UPDATE gbp_posts 
      SET status = 'published', google_post_id = ?, published_at = CURRENT_TIMESTAMP, error_message = NULL 
      WHERE id = ?
    `).run(publishedPostId, postId);

    return {
      success: true,
      status: 'published',
      googlePostId: publishedPostId,
      message: 'Post is succesvol live gepubliceerd op je Google Bedrijfsprofiel!'
    };
  } catch (err) {
    const reason = gbpService.classifyGoogleError(err);
    let msg = '';
    if (reason === 'no_quota' || err.response?.status === 429) {
      msg = 'Wachten op Basic API Access goedkeuring van Google (0 QPM). Zodra Google je aanvraag heeft verwerkt, plaatst deze knop de post direct live. Gebruik in de tussentijd de kopieerknop om de post direct op Google te plakken.';
    } else {
      msg = `Google API fout (${err.response?.status || 'network'}): ${err.response?.data?.error?.message || err.message}`;
    }

    db.prepare('UPDATE gbp_posts SET status = ?, error_message = ? WHERE id = ?').run('pending_approval', msg, postId);
    return {
      success: false,
      status: 'pending_approval',
      message: msg,
      quotaPending: reason === 'no_quota' || err.response?.status === 429
    };
  }
}

module.exports = {
  PRESET_TOPICS,
  generatePostWithAi,
  listPosts,
  getPostById,
  savePost,
  deletePost,
  publishPostToGbp
};
