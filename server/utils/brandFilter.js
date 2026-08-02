/**
 * Detects whether a search keyword is a brand query for the given project domain or business name.
 * Handles variations like spacing ("frisse start" vs "frissestart"), domain extensions ("frissestart.nl"), etc.
 */
function isBrandKeyword(keyword, domain = '', businessName = '') {
  if (!keyword || typeof keyword !== 'string') return false;
  
  const kw = keyword.toLowerCase().trim();
  const kwNoSpace = kw.replace(/[^a-z0-9]/g, '');
  if (!kwNoSpace) return false;

  // Extract domain stem (e.g., "https://frissestart.nl" or "frissestart.nl" -> "frissestart")
  const cleanDomain = (domain || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .split('.')[0]
    .toLowerCase();
  const domainStem = cleanDomain.replace(/[^a-z0-9]/g, '');

  if (domainStem && domainStem.length >= 3) {
    if (kwNoSpace.includes(domainStem)) return true;
  }

  // Extract business name stem (e.g. "FrisseStart", "FrisseStart Flex & Opleiden BV")
  if (businessName && typeof businessName === 'string') {
    const cleanBiz = businessName
      .toLowerCase()
      .replace(/\b(bv|vof|n\.v\.|inc|llc|flex|&|opleiden)\b/gi, '')
      .trim();
    const bizStem = cleanBiz.replace(/[^a-z0-9]/g, '');
    if (bizStem && bizStem.length >= 3 && kwNoSpace.includes(bizStem)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  isBrandKeyword
};
