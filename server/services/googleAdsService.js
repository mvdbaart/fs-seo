/**
 * Google Ads Service
 * Handles SQLite storing/fetching for Google Ads campaigns, groups, keywords & copy,
 * as well as handling Google Ads API settings and CSV exports.
 */

const db = require('../db');
const { generateCampaignFromBlueprint, generateGoogleAdsEditorCSV, CAMPAIGN_BLUEPRINTS } = require('./adCopyGenerator');

/**
 * Resolve a valid project_id from database if omitted or invalid
 */
function resolveProjectId(projectId) {
  if (projectId) {
    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (existing) return existing.id;
  }
  const first = db.prepare('SELECT id FROM projects ORDER BY id ASC LIMIT 1').get();
  if (first) return first.id;
  
  // Fallback: create default project if none exists
  const info = db.prepare('INSERT INTO projects (name, domain) VALUES (?, ?)').run('FrisseStart', 'https://frissestart.nl');
  return info.lastInsertRowid;
}

/**
 * Get all Google Ads campaigns in database
 */
function getAllCampaigns(projectId) {
  const pId = resolveProjectId(projectId);
  const campaigns = db.prepare('SELECT * FROM google_ads_campaigns WHERE project_id = ? ORDER BY id DESC').all(pId);
  
  return campaigns.map(c => {
    const groups = db.prepare('SELECT * FROM google_ads_groups WHERE campaign_id = ?').all(c.id);
    const negatives = db.prepare('SELECT * FROM google_ads_negatives WHERE campaign_id = ?').all(c.id);

    const fullGroups = groups.map(g => {
      const keywords = db.prepare('SELECT * FROM google_ads_keywords WHERE group_id = ?').all(g.id);
      const copy = db.prepare('SELECT * FROM google_ads_copies WHERE group_id = ?').get(g.id);
      return {
        ...g,
        keywords,
        copy: copy ? {
          headlines: JSON.parse(copy.headlines_json),
          descriptions: JSON.parse(copy.descriptions_json),
          finalUrl: copy.final_url
        } : null
      };
    });

    return {
      ...c,
      groups: fullGroups,
      negatives
    };
  });
}

/**
 * Save structured campaign object to database
 */
function saveCampaign(campaignData, projectId) {
  const pId = resolveProjectId(projectId);
  const insertCampaign = db.prepare(`
    INSERT INTO google_ads_campaigns (project_id, name, budget_daily_eur, target_locations, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  const info = insertCampaign.run(
    pId,
    campaignData.name,
    campaignData.budgetDailyEur || 15.0,
    campaignData.targetLocations || 'Eindhoven, Geldrop, Helmond',
    campaignData.status || 'PAUSED'
  );

  const campaignId = info.lastInsertRowid;

  // Insert Negatives
  if (campaignData.negatives && campaignData.negatives.length > 0) {
    const insertNeg = db.prepare('INSERT INTO google_ads_negatives (campaign_id, text, match_type) VALUES (?, ?, ?)');
    for (const neg of campaignData.negatives) {
      insertNeg.run(campaignId, neg.text, neg.matchType || 'PHRASE');
    }
  }

  // Insert Groups
  if (campaignData.groups && campaignData.groups.length > 0) {
    const insertGroup = db.prepare('INSERT INTO google_ads_groups (campaign_id, name, landing_page_url) VALUES (?, ?, ?)');
    const insertKw = db.prepare('INSERT INTO google_ads_keywords (group_id, text, match_type, cpc_bid_eur) VALUES (?, ?, ?, ?)');
    const insertCopy = db.prepare('INSERT INTO google_ads_copies (group_id, headlines_json, descriptions_json, final_url) VALUES (?, ?, ?, ?)');

    for (const g of campaignData.groups) {
      const gInfo = insertGroup.run(campaignId, g.name, g.landingPageUrl);
      const groupId = gInfo.lastInsertRowid;

      if (g.keywords) {
        for (const kw of g.keywords) {
          insertKw.run(groupId, kw.text, kw.matchType || 'EXACT', kw.bid || 2.50);
        }
      }

      if (g.copy) {
        insertCopy.run(
          groupId,
          JSON.stringify(g.copy.headlines || []),
          JSON.stringify(g.copy.descriptions || []),
          g.copy.finalUrl || g.landingPageUrl
        );
      }
    }
  }

  return getCampaignById(campaignId);
}

/**
 * Get single campaign by ID
 */
function getCampaignById(id) {
  const campaign = db.prepare('SELECT * FROM google_ads_campaigns WHERE id = ?').get(id);
  if (!campaign) return null;

  const groups = db.prepare('SELECT * FROM google_ads_groups WHERE campaign_id = ?').all(campaign.id);
  const negatives = db.prepare('SELECT * FROM google_ads_negatives WHERE campaign_id = ?').all(campaign.id);

  const fullGroups = groups.map(g => {
    const keywords = db.prepare('SELECT * FROM google_ads_keywords WHERE group_id = ?').all(g.id);
    const copy = db.prepare('SELECT * FROM google_ads_copies WHERE group_id = ?').get(g.id);
    return {
      ...g,
      keywords,
      copy: copy ? {
        headlines: JSON.parse(copy.headlines_json),
        descriptions: JSON.parse(copy.descriptions_json),
        finalUrl: copy.final_url
      } : null
    };
  });

  return {
    ...campaign,
    groups: fullGroups,
    negatives
  };
}

/**
 * Delete a campaign
 */
function deleteCampaign(id) {
  return db.prepare('DELETE FROM google_ads_campaigns WHERE id = ?').run(id);
}

/**
 * Generate blueprint campaign and save to DB
 */
function createFromBlueprint(blueprintKey, customSettings = {}, projectId) {
  const pId = resolveProjectId(projectId);
  const campaignData = generateCampaignFromBlueprint(blueprintKey, customSettings);
  return saveCampaign(campaignData, pId);
}

/**
 * Export campaign to CSV format for Google Ads Editor
 */
function exportCampaignCSV(id) {
  const campaign = getCampaignById(id);
  if (!campaign) throw new Error('Campagne niet gevonden');

  const formattedCampaign = {
    name: campaign.name,
    budgetDailyEur: campaign.budget_daily_eur,
    targetLocations: campaign.target_locations,
    negatives: campaign.negatives.map(n => ({ text: n.text, matchType: n.match_type })),
    groups: campaign.groups.map(g => ({
      name: g.name,
      landingPageUrl: g.landing_page_url,
      keywords: g.keywords.map(k => ({ text: k.text, matchType: k.match_type, bid: k.cpc_bid_eur })),
      copy: g.copy ? {
        headlines: g.copy.headlines,
        descriptions: g.copy.descriptions,
        finalUrl: g.copy.finalUrl
      } : { headlines: [], descriptions: [], finalUrl: g.landing_page_url }
    }))
  };

  return generateGoogleAdsEditorCSV(formattedCampaign);
}

module.exports = {
  getAllCampaigns,
  getCampaignById,
  saveCampaign,
  deleteCampaign,
  createFromBlueprint,
  exportCampaignCSV,
  CAMPAIGN_BLUEPRINTS
};
