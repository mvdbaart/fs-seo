/**
 * Helper to normalize and check if a given URL or path should be excluded
 * from SEO analytics, tracking, or internal link analysis.
 */

function normalizePathTerm(term) {
  return (term || '').trim().toLowerCase();
}

function parseExcludedPaths(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizePathTerm).filter(Boolean);
  return String(raw).split(',').map(normalizePathTerm).filter(Boolean);
}

function isPathExcluded(urlOrPath, excludedTerms) {
  if (!urlOrPath || !excludedTerms || excludedTerms.length === 0) return false;
  const p = urlOrPath.trim().toLowerCase();
  for (const rawTerm of excludedTerms) {
    const term = normalizePathTerm(rawTerm);
    if (!term) continue;
    if (p === term) return true;
    if (term === '(not set)' && p.includes('(not set)')) return true;
    if (term.startsWith('/')) {
      if (
        p === term ||
        p.startsWith(term + '/') ||
        p.startsWith(term + '?') ||
        p.startsWith(term + '#') ||
        p.includes(term) ||
        p.includes(encodeURIComponent(term).toLowerCase())
      ) {
        return true;
      }
    } else {
      if (
        p === '/' + term ||
        p.startsWith('/' + term + '/') ||
        p.startsWith('/' + term + '?') ||
        p.includes('/' + term) ||
        p.includes(term)
      ) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  normalizePathTerm,
  parseExcludedPaths,
  isPathExcluded
};
