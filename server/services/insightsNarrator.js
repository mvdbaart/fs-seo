/**
 * Zet de signalen uit insightsEngine om in gewoon Nederlands.
 *
 * Volledig deterministisch en synchroon: geen netwerk, geen LLM. Het scherm
 * toont dus altijd iets waars, ook zonder AI-key. De AI-knop in de UI gebruikt
 * buildInsightsPrompt() en krijgt uitsluitend de hier al berekende getallen
 * mee, zodat het model niets kan verzinnen.
 *
 * Huisgrammatica voor advies (zelfde als aiAdvisor.js):
 *   title       = aantal + conditie
 *   description = concrete getallen + één zin waarom het uitmaakt
 *   action      = gebiedende wijs vooraan
 */

const nf = new Intl.NumberFormat('nl-NL');

function fmtCount(value) {
  if (value === null || value === undefined) return '—';
  return nf.format(Math.round(value));
}

function fmtPct(value) {
  if (value === null || value === undefined) return '—';
  return `${nf.format(Math.abs(Math.round(value * 10) / 10))}%`;
}

function fmtPos(value) {
  if (value === null || value === undefined) return '—';
  return nf.format(Math.round(value * 10) / 10);
}

function fmtDur(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

function fmtSeconds(value) {
  if (value === null || value === undefined) return '—';
  return `${nf.format(Math.round(value * 10) / 10)} s`;
}

/**
 * Beoordelingen mogen niet worden afgerond zoals fmtCount doet: 4,6 sterren is
 * geen 5. Elk rating-signaal heeft daarom een eigen template met deze opmaak.
 */
function fmtRating(value) {
  if (value === null || value === undefined) return '—';
  return nf.format(Math.round(value * 10) / 10);
}

/**
 * "23% meer" of, als de vorige periode nul was, "van niets naar 40".
 * Voorkomt Infinity% en NaN in de lopende tekst.
 */
function changePhrase(signal, { unit = 'count' } = {}) {
  const richting = signal.direction === 'up' ? 'meer' : 'minder';
  if (signal.deltaPct === null) {
    return signal.previous === 0 ? 'terwijl dat er in de vorige periode nog geen waren' : `${richting}`;
  }
  return `${fmtPct(signal.deltaPct)} ${richting}`;
}

const TEMPLATES = {
  'gsc.clicks': (s) => s.deltaPct === null
    ? `Je kreeg ${fmtCount(s.current)} klikken uit Google, terwijl dat er in de vorige periode nog geen waren.`
    : `Je kreeg ${fmtCount(s.current)} klikken uit Google, ${changePhrase(s)} dan de periode ervoor (${fmtCount(s.previous)}).`,

  'gsc.impressions': (s) => `Je website werd ${fmtCount(s.current)} keer getoond in Google, ${changePhrase(s)} dan de periode ervoor (${fmtCount(s.previous)}).`,

  'gsc.ctr': (s) => s.sentiment === 'positive'
    ? `Van de mensen die je zagen staan klikte ${fmtPct(s.current)} door — dat was ${fmtPct(s.previous)}.`
    : `Van de mensen die je zagen staan klikt nog maar ${fmtPct(s.current)} door — dat was ${fmtPct(s.previous)}.`,

  'gsc.position': (s) => s.sentiment === 'positive'
    ? `Je gemiddelde plek in Google verbeterde van ${fmtPos(s.previous)} naar ${fmtPos(s.current)}.`
    : `Je gemiddelde plek in Google zakte van ${fmtPos(s.previous)} naar ${fmtPos(s.current)}.`,

  'ga4.sessions': (s) => `${fmtCount(s.current)} bezoeken via organisch zoeken, ${changePhrase(s)} dan de periode ervoor (${fmtCount(s.previous)}).`,

  'ga4.engagedSessions': (s) => `${fmtCount(s.current)} bezoekers bleven daadwerkelijk hangen op je site (was ${fmtCount(s.previous)}).`,

  'ga4.keyEvents': (s) => `${fmtCount(s.current)} conversies uit organisch verkeer, tegenover ${fmtCount(s.previous)} in de vorige periode.`,

  'ga4.avgDuration': (s) => s.sentiment === 'positive'
    ? `Bezoekers blijven langer: gemiddeld ${fmtDur(s.current)} per bezoek (was ${fmtDur(s.previous)}).`
    : `Bezoekers blijven korter: gemiddeld ${fmtDur(s.current)} per bezoek (was ${fmtDur(s.previous)}).`,

  'ga4.bounceRate': (s) => s.sentiment === 'positive'
    ? `Minder mensen haken direct af: ${fmtPct(s.current)} tegenover ${fmtPct(s.previous)}.`
    : `${fmtPct(s.current)} van de bezoekers haakt direct af — dat was ${fmtPct(s.previous)}.`,

  'rankings.top3': (s) => `${fmtCount(s.current)} zoekwoorden staan in de top 3 van Google (was ${fmtCount(s.previous)}).`,

  'rankings.top10': (s) => `${fmtCount(s.current)} zoekwoorden staan op de eerste pagina van Google (was ${fmtCount(s.previous)}).`,

  'rankings.avgPosition': (s) => s.sentiment === 'positive'
    ? `Je zoekwoorden staan gemiddeld hoger: plek ${fmtPos(s.current)} tegenover ${fmtPos(s.previous)}.`
    : `Je zoekwoorden zakten gemiddeld van plek ${fmtPos(s.previous)} naar ${fmtPos(s.current)}.`,

  'pagespeed.performance': (s) => s.sentiment === 'positive'
    ? `Je site werd sneller op mobiel: score ${fmtCount(s.current)} van de 100 (was ${fmtCount(s.previous)}).`
    : `Je site werd trager op mobiel: score ${fmtCount(s.current)} van de 100 (was ${fmtCount(s.previous)}).`,

  'pagespeed.lcp': (s) => s.sentiment === 'positive'
    ? `De pagina is eerder zichtbaar voor bezoekers: ${fmtSeconds(s.current)} in plaats van ${fmtSeconds(s.previous)}.`
    : `Bezoekers wachten langer voordat de pagina zichtbaar is: ${fmtSeconds(s.current)} in plaats van ${fmtSeconds(s.previous)}.`,

  'pagespeed.cls': (s) => s.sentiment === 'positive'
    ? `De pagina springt minder tijdens het laden (${fmtPos(s.current)} tegenover ${fmtPos(s.previous)}).`
    : `De pagina springt meer tijdens het laden (${fmtPos(s.current)} tegenover ${fmtPos(s.previous)}).`,

  'crawl.errors': (s) => s.sentiment === 'positive'
    ? `Het aantal foutpagina's op je site daalde van ${fmtCount(s.previous)} naar ${fmtCount(s.current)}.`
    : `Er staan nu ${fmtCount(s.current)} foutpagina's op je site, ${fmtCount(Math.abs(s.delta))} meer dan bij de vorige crawl.`,

  'crawl.pages': (s) => s.direction === 'up'
    ? `Je site telt ${fmtCount(s.current)} vindbare pagina's, ${fmtCount(Math.abs(s.delta))} meer dan bij de vorige crawl.`
    : `Je site telt ${fmtCount(s.current)} vindbare pagina's, ${fmtCount(Math.abs(s.delta))} minder dan bij de vorige crawl.`,

  'gbp.impressions': (s) => `Je bedrijfsprofiel werd ${fmtCount(s.current)} keer bekeken in Google Zoeken en Maps, ${changePhrase(s)} dan de periode ervoor (${fmtCount(s.previous)}).`,

  'gbp.calls': (s) => s.direction === 'up'
    ? `${fmtCount(s.current)} mensen belden je rechtstreeks vanuit Google, ${fmtCount(Math.abs(s.delta))} meer dan de periode ervoor.`
    : `${fmtCount(s.current)} mensen belden je rechtstreeks vanuit Google, ${fmtCount(Math.abs(s.delta))} minder dan de periode ervoor.`,

  'gbp.directions': (s) => `${fmtCount(s.current)} keer vroeg iemand een routebeschrijving naar je vestiging aan (was ${fmtCount(s.previous)}).`,

  'gbp.websiteClicks': (s) => `Vanuit je bedrijfsprofiel klikten ${fmtCount(s.current)} mensen door naar je website, ${changePhrase(s)} dan de periode ervoor (${fmtCount(s.previous)}).`,

  'gbp.conversations': (s) => `Je ontving ${fmtCount(s.current)} berichten via je bedrijfsprofiel (was ${fmtCount(s.previous)}).`,

  'places.rating': (s) => s.sentiment === 'positive'
    ? `Je beoordeling in Google Maps steeg van ${fmtRating(s.previous)} naar ${fmtRating(s.current)} sterren.`
    : `Je beoordeling in Google Maps zakte van ${fmtRating(s.previous)} naar ${fmtRating(s.current)} sterren.`,

  'places.reviewCount': (s) => s.direction === 'up'
    ? `Er kwamen ${fmtCount(Math.abs(s.delta))} Google-reviews bij; je staat nu op ${fmtCount(s.current)} reviews.`
    : `Je aantal Google-reviews daalde naar ${fmtCount(s.current)} (was ${fmtCount(s.previous)}).`,

  'places.ratingGap': (s) => s.current >= 0
    ? `Je staat ${fmtRating(Math.abs(s.current))} ster hoger beoordeeld dan je best beoordeelde concurrent.`
    : `Je best beoordeelde concurrent staat ${fmtRating(Math.abs(s.current))} ster hoger dan jij.`
};

function describe(signal) {
  const template = TEMPLATES[signal.id];
  if (template) return template(signal);
  return `${signal.label}: ${fmtCount(signal.previous)} → ${fmtCount(signal.current)}.`;
}

function findSignal(report, id) {
  return report.signals.find((s) => s.id === id) || null;
}

// ----------------------------------------------------
// Headline
// ----------------------------------------------------

function buildHeadline(report) {
  const positive = report.highlights.positive;
  const negative = report.highlights.negative;
  const anyComparable = Object.values(report.sources).some((s) => s.connected && s.comparable);

  if (!anyComparable || (positive.length === 0 && negative.length === 0 && report.signals.length === 0)) {
    return 'Er is nog te weinig historie om te vergelijken. Koppel Search Console en Analytics, en voer een ranking check en een crawl uit — vanaf de tweede meting laat dit scherm zien wat er beter en slechter gaat.';
  }

  const parts = [];

  const periode = `${report.period.label} (${report.period.comparisonLabel})`;

  if (positive.length === 0 && negative.length === 0) {
    parts.push(`In de periode ${periode} bleven de cijfers stabiel: er zijn geen noemenswaardige stijgingen of dalingen gemeten.`);
  } else {
    const verdict = positive.length > negative.length
      ? 'ging het over de hele linie de goede kant op'
      : positive.length === negative.length
        ? 'bleef het beeld gemengd'
        : 'liep een aantal cijfers terug';
    parts.push(`In de periode ${periode} ${verdict}.`);

    const biggest = [...positive, ...negative].sort((a, b) => b.magnitude - a.magnitude)[0];
    if (biggest) parts.push(describe(biggest));

    // De tegenbeweging: het sterkste signaal met het andere sentiment.
    const counter = biggest.sentiment === 'positive' ? negative[0] : positive[0];
    if (counter) parts.push(`Tegelijk: ${lowerFirst(describe(counter))}`);
  }

  const missing = Object.entries(report.sources)
    .filter(([, s]) => !s.connected)
    .map(([name]) => SOURCE_LABELS[name])
    .filter(Boolean);

  if (missing.length === 1) {
    parts.push(`Let op: ${missing[0]} is nog niet gekoppeld, dus die cijfers ontbreken in dit beeld.`);
  } else if (missing.length > 1) {
    parts.push(`Let op: ${missing.slice(0, -1).join(', ')} en ${missing[missing.length - 1]} zijn nog niet gekoppeld, dus die cijfers ontbreken in dit beeld.`);
  }

  return parts.join(' ');
}

const SOURCE_LABELS = {
  gsc: 'Search Console',
  ga4: 'Google Analytics',
  gbp: 'het Google Bedrijfsprofiel',
  places: 'de Google Maps-vergelijking',
  rankings: 'de rank tracker',
  pagespeed: 'PageSpeed',
  crawl: 'de site crawler'
};

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * De bronlabels dragen een lidwoord omdat ze midden in een zin staan
 * ("Let op: de rank tracker is nog niet gekoppeld"). In een kop moet dat eraf.
 */
function sourceTitle(name) {
  const label = SOURCE_LABELS[name] || name;
  const stripped = label.replace(/^(de|het)\s+/i, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

// ----------------------------------------------------
// Advies
// ----------------------------------------------------

function buildAdvice(report) {
  const advice = [];
  const s = (id) => findSignal(report, id);
  const isNeg = (signal) => signal && signal.significant && signal.sentiment === 'negative';
  const isPos = (signal) => signal && signal.significant && signal.sentiment === 'positive';

  const clicks = s('gsc.clicks');
  const impressions = s('gsc.impressions');
  const ctr = s('gsc.ctr');
  const position = s('gsc.position');
  const sessions = s('ga4.sessions');
  const keyEvents = s('ga4.keyEvents');
  const bounceRate = s('ga4.bounceRate');
  const avgPosition = s('rankings.avgPosition');
  const errors = s('crawl.errors');
  const performance = s('pagespeed.performance');

  const gscLosers = report.movers.gscQueries?.losers || [];
  const gscWinners = report.movers.gscQueries?.winners || [];
  const pageLosers = report.movers.gscPages?.losers || [];
  const ga4Losers = report.movers.ga4LandingPages?.losers || [];

  // Meer vertoningen, minder klikken: het sterkste signaal dat de teksten niet werken.
  if (isNeg(clicks) && isPos(impressions)) {
    advice.push({
      type: 'critical',
      title: 'Meer mensen zien je staan, minder mensen klikken',
      description: `Je vertoningen stegen naar ${fmtCount(impressions.current)}, maar de klikken daalden naar ${fmtCount(clicks.current)}. Je staat dus vaker in de resultaten, maar je titel en omschrijving overtuigen niet genoeg om te klikken.`,
      action: pageLosers.length > 0
        ? `Herschrijf de title en meta description van ${pageLosers.slice(0, 3).map((p) => p.key).join(', ')}`
        : 'Herschrijf de titles en meta descriptions van je best bekeken pagina\'s',
      priority: 1
    });
  } else if (isNeg(clicks)) {
    advice.push({
      type: 'critical',
      title: `Klikken uit Google daalden met ${fmtPct(clicks.deltaPct)}`,
      description: `Je ging van ${fmtCount(clicks.previous)} naar ${fmtCount(clicks.current)} klikken. Minder klikken betekent direct minder aanvragen via je website.`,
      action: gscLosers.length > 0
        ? `Werk de landingspagina bij van "${gscLosers[0].key}" — daar verloor je de meeste klikken`
        : 'Controleer welke pagina\'s klikken verloren in Search Console',
      priority: 1
    });
  }

  // CTR omlaag terwijl de positie niet verslechterde: puur een tekstprobleem.
  if (isNeg(ctr) && !isNeg(position)) {
    advice.push({
      type: 'warning',
      title: `Doorklikpercentage daalde naar ${fmtPct(ctr.current)}`,
      description: `De CTR zakte van ${fmtPct(ctr.previous)} naar ${fmtPct(ctr.current)} terwijl je positie niet verslechterde. Dat wijst op zoekresultaten die minder aantrekkelijk zijn geworden dan die van de concurrentie.`,
      action: 'Herschrijf de meta description met een concrete USP (prijs, doorlooptijd of certificering)',
      priority: 2
    });
  }

  if (isNeg(position)) {
    advice.push({
      type: 'warning',
      title: `Gemiddelde positie zakte van ${fmtPos(position.previous)} naar ${fmtPos(position.current)}`,
      description: 'Je zakt gemiddeld in de zoekresultaten. Dat gaat bijna altijd vooraf aan een daling in bezoekers en aanvragen.',
      action: pageLosers.length > 0
        ? `Controleer ${pageLosers.slice(0, 2).map((p) => p.key).join(' en ')} op verwijderde of ingekorte content`
        : 'Controleer de grootste dalers op verwijderde of ingekorte content',
      priority: 2
    });
  }

  // Evenveel bezoek maar minder conversies: het probleem zit op de pagina zelf.
  if (isNeg(keyEvents) && sessions && sessions.sentiment !== 'negative') {
    advice.push({
      type: 'critical',
      title: 'Evenveel bezoek, minder conversies',
      description: `Het aantal bezoeken bleef op peil (${fmtCount(sessions.current)}), maar de conversies daalden van ${fmtCount(keyEvents.previous)} naar ${fmtCount(keyEvents.current)}. Het verlies zit dus niet in je vindbaarheid maar op de pagina zelf.`,
      action: ga4Losers.length > 0
        ? `Test het aanvraagformulier op ${ga4Losers.slice(0, 2).map((p) => p.key).join(' en ')} en controleer of de doelen in GA4 nog vuren`
        : 'Test het aanvraagformulier en controleer of de doelen in GA4 nog vuren',
      priority: 1
    });
  }

  if (isNeg(bounceRate)) {
    advice.push({
      type: 'warning',
      title: `Bouncepercentage steeg naar ${fmtPct(bounceRate.current)}`,
      description: `${fmtPct(bounceRate.current)} van de bezoekers vertrekt zonder iets te doen, tegenover ${fmtPct(bounceRate.previous)} eerder. Bezoekers vinden niet snel genoeg wat ze zochten.`,
      action: 'Zet het antwoord op de zoekvraag direct bovenaan de pagina, boven de vouw',
      priority: 2
    });
  }

  if (isNeg(avgPosition)) {
    advice.push({
      type: 'warning',
      title: 'Je zoekwoorden zakten gemiddeld in de ranking',
      description: `De gemiddelde positie ging van ${fmtPos(avgPosition.previous)} naar ${fmtPos(avgPosition.current)}. ${report.movers.keywords?.losers?.length ? `De grootste dalers: ${report.movers.keywords.losers.slice(0, 3).map((k) => `"${k.key}"`).join(', ')}.` : ''}`,
      action: 'Bekijk de dalers in de Rank Tracker en verdiep de bijbehorende pagina\'s',
      priority: 2
    });
  }

  if (isNeg(errors)) {
    const newUrls = errors.detail?.newErrorUrls || [];
    advice.push({
      type: 'critical',
      title: `${fmtCount(Math.abs(errors.delta))} nieuwe foutpagina's sinds de vorige crawl`,
      description: `Je site heeft nu ${fmtCount(errors.current)} pagina's met een foutmelding.${newUrls.length ? ` Bijvoorbeeld: ${newUrls.slice(0, 3).join(', ')}.` : ''} Foutpagina's verspillen crawlbudget en verliezen linkwaarde.`,
      action: 'Herstel of redirect (301) deze URL\'s en werk de interne links bij',
      priority: 1
    });
  }

  if (isNeg(performance)) {
    advice.push({
      type: performance.current < 50 ? 'critical' : 'warning',
      title: `Mobiele snelheidsscore daalde naar ${fmtCount(performance.current)}/100`,
      description: `De score ging van ${fmtCount(performance.previous)} naar ${fmtCount(performance.current)}. Laadsnelheid is een rankingfactor voor Google en kost je bezoekers op mobiel.`,
      action: 'Los de grootste blokkade op uit de diagnostiek in de PageSpeed tab',
      priority: performance.current < 50 ? 1 : 2
    });
  }

  const gbpImpressions = s('gbp.impressions');
  const gbpCalls = s('gbp.calls');
  const ratingGap = s('places.ratingGap');
  const ownRating = s('places.rating');
  const reviewCount = s('places.reviewCount');

  // Zichtbaar in Maps, maar niemand onderneemt actie: het profiel overtuigt niet.
  if (isPos(gbpImpressions) && isNeg(gbpCalls)) {
    advice.push({
      type: 'critical',
      title: 'Meer mensen vinden je in Maps, minder mensen bellen',
      description: `Je profiel werd ${fmtCount(gbpImpressions.current)} keer bekeken — meer dan de vorige periode — maar de telefoontjes daalden naar ${fmtCount(gbpCalls.current)}. Bezoekers zien je wel staan, maar worden niet overtuigd om contact op te nemen.`,
      action: 'Zet actuele foto\'s, kloppende openingstijden en een korte dienstenlijst op je bedrijfsprofiel',
      priority: 1
    });
  }

  // Achterstand in Maps: de beoordeling weegt zwaar in de lokale top 3.
  if (ratingGap && ratingGap.current !== null && ratingGap.current < 0) {
    const leader = report.movers.placesCompetitors?.losers?.[0];
    advice.push({
      type: 'warning',
      title: 'Een concurrent staat hoger beoordeeld in Google Maps',
      description: `Jij staat op ${fmtRating(ownRating?.current)} sterren${leader ? `, "${leader.key}" op ${fmtRating(leader.rating)} sterren met ${fmtCount(leader.reviewCount)} reviews` : ''}. In de lokale top 3 van Maps weegt de beoordeling zwaar mee.`,
      action: 'Vraag de komende maand actief om reviews bij tevreden klanten',
      priority: 2
    });
  }

  // Onder de 25 reviews telt elke nieuwe review nog zwaar mee.
  if (reviewCount && reviewCount.current !== null && reviewCount.current < 25) {
    advice.push({
      type: 'opportunity',
      title: `Nog maar ${fmtCount(reviewCount.current)} Google-reviews`,
      description: 'Onder de 25 reviews weegt elke nieuwe review zwaar mee in je gemiddelde én in je positie in de Maps-resultaten.',
      action: 'Stuur het reviewsjabloon uit de Local Pack-tab naar je laatste tien klanten',
      priority: 3
    });
  }

  // Niets negatiefs gevonden: doorpakken op wat wel werkt.
  if (advice.length === 0 && report.highlights.positive.length > 0) {
    const winner = gscWinners[0];
    advice.push({
      type: 'opportunity',
      title: 'Geen achteruitgang gevonden in deze periode',
      description: winner
        ? `De cijfers gingen vooruit of bleven gelijk. De grootste stijger is "${winner.key}" met ${fmtCount(winner.clicksDelta)} klikken erbij.`
        : 'De cijfers gingen vooruit of bleven gelijk. Dit is het moment om door te pakken op wat werkt.',
      action: winner
        ? `Breid de pagina achter "${winner.key}" uit met een FAQ-sectie en interne links`
        : 'Breid je best presterende pagina\'s uit met een FAQ-sectie en interne links',
      priority: 3
    });
  }

  // Ontbrekende koppelingen zijn zelf een actiepunt.
  for (const [name, source] of Object.entries(report.sources)) {
    if (!source.connected && source.message) {
      advice.push({
        type: 'opportunity',
        title: `${sourceTitle(name)} nog niet gekoppeld`,
        description: source.message,
        action: ['ga4', 'gsc', 'places'].includes(name)
          ? 'Vul de koppeling aan bij Instellingen'
          : 'Voer de genoemde actie uit om deze data te verzamelen',
        priority: 4
      });
    }
  }

  const order = { critical: 0, warning: 1, opportunity: 2 };
  advice.sort((a, b) => (order[a.type] - order[b.type]) || (a.priority - b.priority));
  return advice.slice(0, 8);
}

// ----------------------------------------------------
// AI-prompt (opt-in, via AiPromptCanvas)
// ----------------------------------------------------

function buildInsightsPrompt(report, narrative) {
  const lines = [];
  lines.push('Je bent een SEO-adviseur die aan een niet-technische ondernemer uitlegt hoe zijn website ervoor staat.');
  lines.push('');
  lines.push(`Website: ${report.project.domain}`);
  lines.push(`Periode: ${report.period.label} (${report.period.comparisonLabel})`);
  lines.push('');

  lines.push('Wat er beter ging:');
  if (narrative.good.length === 0) lines.push('- (niets noemenswaardigs)');
  for (const item of narrative.good) lines.push(`- ${item.text}`);
  lines.push('');

  lines.push('Wat er slechter ging:');
  if (narrative.bad.length === 0) lines.push('- (niets noemenswaardigs)');
  for (const item of narrative.bad) lines.push(`- ${item.text}`);
  lines.push('');

  const winners = report.movers.gscQueries?.winners || [];
  const losers = report.movers.gscQueries?.losers || [];
  if (winners.length) {
    lines.push('Grootste stijgers (zoekwoord: klikken vorige periode -> nu):');
    for (const w of winners) lines.push(`- ${w.key}: ${w.prevClicks} -> ${w.clicks}`);
    lines.push('');
  }
  if (losers.length) {
    lines.push('Grootste dalers (zoekwoord: klikken vorige periode -> nu):');
    for (const l of losers) lines.push(`- ${l.key}: ${l.prevClicks} -> ${l.clicks}`);
    lines.push('');
  }

  if (report.dataGaps.length) {
    lines.push('Niet beschikbaar in deze periode:');
    for (const gap of report.dataGaps) lines.push(`- ${gap.message}`);
    lines.push('');
  }

  lines.push('Opdracht:');
  lines.push('1. Schrijf één alinea van maximaal 120 woorden in gewoon Nederlands: hoe staat de site ervoor?');
  lines.push('2. Schrijf daarna 3 tot 5 concrete adviezen. Noem per advies: wat je moet doen, waarom, en wat het oplevert.');
  lines.push('3. Gebruik UITSLUITEND de cijfers hierboven. Verzin niets. Noem geen cijfer dat er niet staat.');
  lines.push('4. Geen jargon: schrijf "hoe hoog je in Google staat" in plaats van "gemiddelde positie", en "bezoekers die meteen weggaan" in plaats van "bounce rate".');

  return lines.join('\n');
}

// ----------------------------------------------------
// Publieke API
// ----------------------------------------------------

function buildNarrative(report) {
  const good = report.highlights.positive.map((s) => ({
    signalId: s.id,
    title: s.label,
    text: describe(s)
  }));

  const bad = report.highlights.negative.map((s) => ({
    signalId: s.id,
    title: s.label,
    text: describe(s)
  }));

  const watch = report.dataGaps.map((gap) => ({
    title: sourceTitle(gap.source),
    text: gap.message
  }));

  const narrative = {
    headline: buildHeadline(report),
    good,
    bad,
    watch,
    advice: buildAdvice(report)
  };

  narrative.aiPrompt = buildInsightsPrompt(report, narrative);
  return narrative;
}

module.exports = { buildNarrative, buildInsightsPrompt, describe };
