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

/**
 * Push een AI-gegenereerd artikel direct als concept naar marketing_content_items in fs-next Supabase
 */
async function pushBlogPostToSupabase({ title, slug, metaDescription, content, targetKeywords, status = 'draft' }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is niet geconfigureerd in .env.local');

  const cleanSlug = slug || (title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `seo-article-${Date.now()}`);

  const payload = {
    title: title || 'Nieuw SEO Artikel',
    slug: cleanSlug,
    meta_description: metaDescription || '',
    content: content || '',
    target_keywords: targetKeywords || [],
    status: status,
    content_type: 'blog_post',
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Probeer marketing_content_items (de primaire tabel in fs-next)
  const { data: blogData, error: err1 } = await supabase
    .from('marketing_content_items')
    .upsert(payload, { onConflict: 'slug' })
    .select();

  if (!err1 && blogData) {
    return { success: true, table: 'marketing_content_items', slug: cleanSlug, data: blogData[0] };
  }

  // Fallback naar blog_posts tabel indien aanwezig
  const { data: altData, error: err2 } = await supabase
    .from('blog_posts')
    .upsert({
      title: payload.title,
      slug: payload.slug,
      meta_description: payload.meta_description,
      body: payload.content,
      is_published: false,
      created_at: payload.created_at
    }, { onConflict: 'slug' })
    .select();

  if (!err2 && altData) {
    return { success: true, table: 'blog_posts', slug: cleanSlug, data: altData[0] };
  }

  throw new Error(`Supabase Blog Push Fout: ${err1?.message || err2?.message || 'Onbekende fout'}`);
}

/**
 * Haal alle actieve cursuscategorieën & varianten op uit Supabase voor live keyword/URL sync
 */
async function fetchCourseCategoriesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is niet geconfigureerd in .env.local');

  const { data: categories, error: catErr } = await supabase
    .from('course_categories')
    .select('id, keyword, display_name, slug, categorie, soob_subsidie, soob_subsidie_bedrag, code95_hours, normale_prijs')
    .eq('is_active', true);

  if (catErr) {
    throw new Error(`Fout bij ophalen cursuscategorieën uit Supabase: ${catErr.message}`);
  }

  const { data: variants } = await supabase
    .from('course_category_variants')
    .select('id, category_id, title, keyword, seo_url, price, soob_subsidie_bedrag, code95_hours')
    .eq('is_active', true);

  const formattedCourses = (categories || []).map(cat => {
    const catVariants = (variants || []).filter(v => v.category_id === cat.id);
    const targetUrl = cat.slug ? `https://frissestart.nl/${cat.slug.replace(/^\//, '')}` : 'https://frissestart.nl/opleidingen';
    
    return {
      id: cat.id,
      keyword: cat.display_name || cat.keyword,
      categoryKeyword: cat.keyword,
      targetUrl,
      code95Hours: cat.code95_hours || 0,
      soobSubsidie: cat.soob_subsidie || false,
      soobBedrag: cat.soob_subsidie_bedrag || 0,
      normalePrijs: cat.normale_prijs || 0,
      variants: catVariants.map(v => ({
        title: v.title,
        keyword: v.keyword,
        seoUrl: v.seo_url ? `https://frissestart.nl/${v.seo_url.replace(/^\//, '')}` : targetUrl,
        price: v.price
      }))
    };
  });

  return formattedCourses;
}

module.exports = { 
  isSupabaseConfigured, 
  fetchSupabasePages, 
  syncSeoMetadataToSupabase,
  pushBlogPostToSupabase,
  fetchCourseCategoriesFromSupabase
};
