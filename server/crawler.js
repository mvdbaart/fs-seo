const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class Crawler {
  constructor(startUrl, maxPages = 30) {
    this.startUrl = startUrl;
    this.maxPages = maxPages;
    this.visited = new Set();
    this.queue = [startUrl];
    this.baseUrl = new URL(startUrl).origin;
    this.results = [];
  }

  async run(onProgress) {
    const startTime = Date.now();
    
    while (this.queue.length > 0 && this.visited.size < this.maxPages) {
      const currentUrl = this.queue.shift();
      if (this.visited.has(currentUrl)) continue;

      this.visited.add(currentUrl);

      try {
        const pageData = await this.crawlPage(currentUrl);
        this.results.push(pageData);

        if (onProgress) {
          onProgress({
            crawled: this.visited.size,
            max: this.maxPages,
            currentUrl,
            pageData
          });
        }

        if (pageData.internalLinks) {
          for (const link of pageData.internalLinks) {
            if (!this.visited.has(link) && !this.queue.includes(link) && this.visited.size + this.queue.length < this.maxPages * 3) {
              this.queue.push(link);
            }
          }
        }
      } catch (err) {
        this.results.push({
          url: currentUrl,
          status_code: err.response ? err.response.status : 500,
          title: 'Fout bij laden',
          title_length: 0,
          meta_description: '',
          meta_description_length: 0,
          h1: '',
          h1_count: 0,
          h2_count: 0,
          canonical: '',
          robots: '',
          images_total: 0,
          images_missing_alt: 0,
          word_count: 0,
          keywords: '',
          links_internal_count: 0,
          links_external_count: 0,
          broken_links: JSON.stringify([]),
          load_time_ms: 0
        });
      }
    }

    return {
      duration_ms: Date.now() - startTime,
      pagesCrawled: this.results.length,
      pages: this.results
    };
  }

  extractTopKeywords(text) {
    if (!text) return '';
    const stopWords = new Set([
      'de', 'het', 'een', 'en', 'van', 'in', 'op', 'voor', 'met', 'is', 'om', 'te', 'aan', 'er', 'zijn', 'bij', 'ook', 'als', 'door', 'over', 'of', 'naar', 'je', 'uw', 'ons', 'onszelf', 'dit', 'dat', 'die', 'deze', 'meer', 'niet', 'wel',
      'beter', 'beste', 'goed', 'onze', 'geen', 'alle', 'wordt', 'kunnen', 'wilt', 'gaat', 'moet', 'hebben', 'heel', 'zo'
    ]);
    const words = text.toLowerCase().replace(/[^a-z0-9áéíóúäëïöüñ\s]/gi, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    const freq = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(item => item[0]).join(', ');
  }

  async crawlPage(url) {
    const pageStartTime = Date.now();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravitySEOCrawler/1.0'
      },
      timeout: 8000
    });

    const loadTimeMs = Date.now() - pageStartTime;
    const statusCode = response.status;
    const html = response.data;

    if (typeof html !== 'string') {
      return {
        url,
        status_code: statusCode,
        title: 'Non-HTML Content',
        title_length: 0,
        meta_description: '',
        meta_description_length: 0,
        h1: '',
        h1_count: 0,
        h2_count: 0,
        canonical: '',
        robots: '',
        images_total: 0,
        images_missing_alt: 0,
        word_count: 0,
        keywords: '',
        links_internal_count: 0,
        links_external_count: 0,
        broken_links: JSON.stringify([]),
        load_time_ms: loadTimeMs
      };
    }

    const $ = cheerio.load(html);

    const titleText = $('title').text().trim() || '';
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
    const h1Elements = $('h1');
    const h1Count = h1Elements.length;
    const h1Text = h1Elements.first().text().trim() || '';
    const h2Count = $('h2').length;

    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const robots = $('meta[name="robots"]').attr('content') || '';

    const images = $('img');
    const imagesTotal = images.length;
    let imagesMissingAlt = 0;
    images.each((_, el) => {
      const alt = $(el).attr('alt');
      if (alt === undefined || alt.trim() === '') {
        imagesMissingAlt++;
      }
    });

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(' ').length : 0;

    // Extract page keywords
    const combinedText = `${titleText} ${h1Text} ${metaDesc}`;
    const topKeywords = this.extractTopKeywords(combinedText || bodyText);

    const internalLinks = new Set();
    const externalLinks = new Set();

    $('a[href]').each((_, el) => {
      let href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      try {
        const absoluteUrl = new URL(href, url).href;
        const cleanUrl = absoluteUrl.split('#')[0];
        
        if (cleanUrl.startsWith(this.baseUrl)) {
          internalLinks.add(cleanUrl);
        } else if (cleanUrl.startsWith('http')) {
          externalLinks.add(cleanUrl);
        }
      } catch (e) {
        // Invalid URL
      }
    });

    return {
      url,
      status_code: statusCode,
      title: titleText,
      title_length: titleText.length,
      meta_description: metaDesc,
      meta_description_length: metaDesc.length,
      h1: h1Text,
      h1_count: h1Count,
      h2_count: h2Count,
      canonical,
      robots,
      images_total: imagesTotal,
      images_missing_alt: imagesMissingAlt,
      word_count: wordCount,
      keywords: topKeywords,
      links_internal_count: internalLinks.size,
      links_external_count: externalLinks.size,
      internalLinks: Array.from(internalLinks),
      broken_links: JSON.stringify([]),
      load_time_ms: loadTimeMs
    };
  }
}

module.exports = Crawler;
