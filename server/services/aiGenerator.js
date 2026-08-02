const axios = require('axios');
const db = require('../db');

/**
 * Geanalyseerde communicatiestijlen overgenomen uit fs-next COMMUNICATION_STYLES.md
 */
const COMMUNICATION_STYLES = {
  default: `Je bent een meesterlijke SEO Copywriter en Technical Performance Specialist voor FrisseStart.nl.
Schrijf altijd in helder Nederlands met een directe, professionele en oplossingsgerichte toon. Antwoord direct in schone Markdown zonder onnodige inleiding of blabla.`,

  sander: `Je communiceert in de stijl van Sander van den Baart (Directeur / Eigenaar FrisseStart.nl).
Communicatiestijl: Direct, pragmatisch, doelgericht en to-the-point. Korte, bondige zinnen. Geen omwegen of vulling. Consequent de jij/je-vorm. Actiegericht, helder en no-nonsense.`,

  kirsten: `Je communiceert in de stijl van Kirsten Opperman (FrisseStart.nl).
Communicatiestijl: Een harmonieuze mix van professionaliteit, directheid en persoonlijke betrokkenheid. Helder, vriendelijk, empathisch en oplossingsgericht. Korte, goed leesbare alinea's in de jij/je-vorm.`,

  opleidingen: `Je communiceert vanuit het Opleidingen & Certificeringsteam van FrisseStart.nl.
Communicatiestijl: Professioneel, efficiënt, direct en vriendelijk. Schrijf to-the-point over cursussen (Heftruck, VCA, Code 95, 1-uurs hercertificering) en certificeringsbeheer.`,

  vacatures: `Je communiceert vanuit de Recruitment & Vacatures afdeling van FrisseStart.nl.
Communicatiestijl: Motiverend, direct en praktisch in de jij-vorm. Open met een retorische vraag ("Ben jij...?", "Wil jij...?"). Benadruk de sfeer van een klein, hecht team, nauwkeurigheid en betrouwbaarheid.`
};

/**
 * Genereer direct AI content via OpenAI, Gemini of OpenRouter met FrisseStart communicatiestijl
 */
async function generateAiContent({ promptText, provider = 'auto', style = 'default' }) {
  if (!promptText) throw new Error('Geen prompttekst opgegeven');

  const systemPrompt = COMMUNICATION_STYLES[style] || COMMUNICATION_STYLES.default;

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  let selectedProvider = provider;
  if (selectedProvider === 'auto') {
    if (openaiKey) selectedProvider = 'openai';
    else if (geminiKey) selectedProvider = 'gemini';
    else if (openrouterKey) selectedProvider = 'openrouter';
    else throw new Error('Geen AI API keys (OpenAI, Gemini of OpenRouter) gevonden in .env.local');
  }

  if (selectedProvider === 'openai') {
    if (!openaiKey) throw new Error('OPENAI_API_KEY is niet ingesteld in .env.local');
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const generatedText = res.data.choices?.[0]?.message?.content || '';
    return {
      success: true,
      provider: 'OpenAI (GPT-4o-mini)',
      style,
      generatedText
    };
  }

  if (selectedProvider === 'gemini') {
    if (!geminiKey) throw new Error('GEMINI_API_KEY is niet ingesteld in .env.local');
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\nOpdracht:\n${promptText}` }
          ]
        }
      ]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    const generatedText = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      success: true,
      provider: 'Google Gemini (1.5 Flash)',
      style,
      generatedText
    };
  }

  if (selectedProvider === 'openrouter') {
    if (!openrouterKey) throw new Error('OPENROUTER_API_KEY is niet ingesteld in .env.local');
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const generatedText = res.data.choices?.[0]?.message?.content || '';
    return {
      success: true,
      provider: 'OpenRouter (Llama 3.3)',
      style,
      generatedText
    };
  }

  throw new Error(`Onbekende AI provider: ${selectedProvider}`);
}

module.exports = { generateAiContent, COMMUNICATION_STYLES };

