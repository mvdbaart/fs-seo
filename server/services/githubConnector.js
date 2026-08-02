/**
 * GitHub Connector & Remote API Sync Service for FS SEO Prof.
 * Integrates with GitHub repository (github-fs) & remote Vercel deployment endpoints.
 */

const axios = require('axios');

class GithubConnector {
  constructor() {
    this.githubToken = process.env.GITHUB_PAT_FS_NEXT || process.env.GITHUB_TOKEN || process.env.GH_PAT || '';
    this.repoOwner = process.env.GITHUB_REPO_OWNER || 'FrisseStart';
    this.repoName = process.env.GITHUB_REPO_NAME || 'fs-next';
    this.remoteApiUrl = process.env.REMOTE_FS_NEXT_URL || process.env.VERCEL_URL || '';
  }

  /**
   * Status van GitHub-koppeling en remote Vercel-endpoint controleren
   */
  async getStatus() {
    const status = {
      githubConfigured: Boolean(this.githubToken),
      repoOwner: this.repoOwner,
      repoName: this.repoName,
      remoteApiUrl: this.remoteApiUrl || 'Niet ingesteld (gebruikt lokaal of GitHub fallback)',
      gitHubApiConnection: false,
      remoteVercelConnection: false
    };

    if (this.githubToken) {
      try {
        const ghRes = await axios.get(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'FS-SEO-Prof-App'
          },
          timeout: 4000
        });
        if (ghRes.status === 200) {
          status.gitHubApiConnection = true;
          status.defaultBranch = ghRes.data.default_branch;
          status.lastUpdated = ghRes.data.updated_at;
        }
      } catch (err) {
        status.gitHubError = err.message;
      }
    }

    if (this.remoteApiUrl) {
      try {
        const formattedUrl = this.remoteApiUrl.startsWith('http') ? this.remoteApiUrl : `https://${this.remoteApiUrl}`;
        const vercelRes = await axios.get(`${formattedUrl}/api/admin/seo-sitemap-urls`, {
          timeout: 4000
        });
        if (vercelRes.status === 200) {
          status.remoteVercelConnection = true;
        }
      } catch (err) {
        status.vercelError = err.message;
      }
    }

    return status;
  }

  /**
   * Ophalen van sitemap-urls direct via GitHub API (wanneer Vercel offline of lokaal niet draait)
   */
  async fetchSitemapFromGithub() {
    if (!this.githubToken) {
      throw new Error('GITHUB_TOKEN of GH_PAT is niet ingesteld. Vul je GitHub Personal Access Token in bij Instellingen.');
    }

    try {
      // Probeer sitemap.xml of app/sitemap.ts direct uit de GitHub repo te lezen
      const fileRes = await axios.get(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/public/sitemap.xml`,
        {
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: 'application/vnd.github.v3.raw',
            'User-Agent': 'FS-SEO-Prof-App'
          },
          timeout: 6000
        }
      );
      return fileRes.data;
    } catch (err) {
      throw new Error(`Fout bij ophalen sitemap van GitHub repo (${this.repoOwner}/${this.repoName}): ${err.message}`);
    }
  }

  /**
   * Commit en push automatisch SEO optimalisaties (titles/metas) rechtstreeks naar GitHub repo
   */
  async pushSeoFixToGithub({ filePath, commitMessage, fileContent }) {
    if (!this.githubToken) {
      throw new Error('GITHUB_TOKEN is verplicht voor het automatisch committen naar GitHub.');
    }

    try {
      // 1. Haal huidige file sha op
      const getFileRes = await axios.get(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'FS-SEO-Prof-App'
          }
        }
      );

      const sha = getFileRes.data.sha;

      // 2. Update bestand in repo
      const updateRes = await axios.put(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`,
        {
          message: commitMessage || `seo: update Title & Meta voor ${filePath}`,
          content: Buffer.from(fileContent).toString('base64'),
          sha
        },
        {
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'FS-SEO-Prof-App'
          }
        }
      );

      return updateRes.data;
    } catch (err) {
      throw new Error(`GitHub Commit Mislukt: ${err.message}`);
    }
  }
}

module.exports = new GithubConnector();
