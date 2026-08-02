const { createClient } = require('@supabase/supabase-js');
const db = require('../db');

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return !!(url && key);
}

/**
 * Haal alle cursussen/opleidingen of SEO pagina's op uit Supabase
 */
async function fetchSupabasePages() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase URL of Key is niet geconfigureerd in .env.local');

  // Probeer bekende tabellen van fs-next (bijv. courses, pages, of seo_metadata)
  const { data: courses, error: err1 } = await supabase.from('courses').select('*');
  if (!err1 && courses) return courses;

  const { data: pages, error: err2 } = await supabase.from('pages').select('*');
  if (!err2 && pages) return pages;

  throw new Error('Kon geen pagina- of cursusdata ophalen uit Supabase tabellen.');
}

/**
 * Synchroniseer een gegenereerde SEO Title, Meta Description of AI Prompt naar Supabase
 */
async function syncSeoMetadataToSupabase({ pageUrl, keyword, title, metaDescription, aiPrompt, status = 'optimized' }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is niet geconfigureerd');

  const payload = {
    url: pageUrl,
    target_keyword: keyword,
    seo_title: title,
    meta_description: metaDescription,
    ai_prompt: aiPrompt,
    status: status,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('seo_metadata')
    .upsert(payload, { onConflict: 'url' });

  if (error) {
    throw new Error(`Supabase Upsert Fout: ${error.message}`);
  }

  return data;
}

module.exports = { isSupabaseConfigured, fetchSupabasePages, syncSeoMetadataToSupabase };
