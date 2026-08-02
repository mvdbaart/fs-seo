import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  Search, 
  Zap, 
  FileText, 
  Settings, 
  SearchCheck,
  MapPin,
  FileSearch,
  BarChart3,
  Code,
  Network,
  Target,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Wrench,
  TrendingUp,
  Activity,
  Layers,
  Megaphone
} from 'lucide-react';

import DashboardView from './components/DashboardView';
import CrawlerView from './components/CrawlerView';
import RankTrackerView from './components/RankTrackerView';
import PageSpeedView from './components/PageSpeedView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import GeoAnalysisView from './components/GeoAnalysisView';
import SinglePageView from './components/SinglePageView';
import GscView from './components/GscView';
import LocalPackView from './components/LocalPackView';
import SchemaGeneratorView from './components/SchemaGeneratorView';
import InternalLinkView from './components/InternalLinkView';
import CompetitorGapView from './components/CompetitorGapView';
import ContentOptimizerView from './components/ContentOptimizerView';
import Ga4ClarityView from './components/Ga4ClarityView';
import PillarClusterView from './components/PillarClusterView';
import GoogleAdsStudio from './components/GoogleAdsStudio';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeProject, setActiveProject] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);

  // Group collapsible state
  const [openGroups, setOpenGroups] = useState({
    analysis: true,
    tools: true
  });

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const fetchDashboardData = async (targetProjectId) => {
    try {
      const projRes = await fetch('/api/projects');
      if (!projRes.ok) {
        console.error('Server error bij ophalen projecten:', projRes.statusText);
        return;
      }
      const projectsList = await projRes.json();
      setAllProjects(projectsList);

      if (projectsList.length === 0) {
        const newRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'FrisseStart', domain: 'https://frissestart.nl' })
        });
        const created = await newRes.json();
        setActiveProject(created);
        fetchDashboardData(created.id);
        return;
      }

      let validProject = projectsList.find(p => p.id === parseInt(targetProjectId, 10));
      if (!validProject) {
        validProject = projectsList[0];
      }

      setActiveProject(validProject);

      const dashRes = await fetch(`/api/projects/${validProject.id}/dashboard`);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Fout bij ophalen dashboard data:', err);
    }
  };

  const [presetOptimizerData, setPresetOptimizerData] = useState(null);

  useEffect(() => {
    fetchDashboardData(activeProject?.id);

    const handleOpenOptimizer = (e) => {
      if (e.detail) {
        setPresetOptimizerData(e.detail);
      }
      setActiveTab('contentoptimizer');
    };

    window.addEventListener('open-content-optimizer', handleOpenOptimizer);
    return () => window.removeEventListener('open-content-optimizer', handleOpenOptimizer);
  }, []);

  const handleSwitchProject = (e) => {
    const projId = parseInt(e.target.value, 10);
    const found = allProjects.find(p => p.id === projId);
    if (found) {
      setActiveProject(found);
      fetchDashboardData(found.id);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <SearchCheck size={22} />
          </div>
          <div>
            <div className="brand-title">FS SEO Prof.</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>GEO & Multi-Domain Tool</div>
          </div>
          <span className="brand-badge">PRO</span>
        </div>

        <ul className="nav-list">
          {/* Main Links */}
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard className="nav-item-icon" /> Overzicht
          </li>

          {/* Group 1: Rankings & Prestaties */}
          <li className="nav-group-header" onClick={() => toggleGroup('analysis')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} /> <span>Analyse & Rankings</span>
            </div>
            {openGroups.analysis ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </li>
          {openGroups.analysis && (
            <div className="nav-sub-list">
              <li className={`nav-item ${activeTab === 'rankings' ? 'active' : ''}`} onClick={() => setActiveTab('rankings')}>
                <Search className="nav-item-icon" /> Rank Tracker (NL)
              </li>
              <li className={`nav-item ${activeTab === 'gsc' ? 'active' : ''}`} onClick={() => setActiveTab('gsc')}>
                <BarChart3 className="nav-item-icon" /> Search Console
              </li>
              <li className={`nav-item ${activeTab === 'ga4clarity' ? 'active' : ''}`} onClick={() => setActiveTab('ga4clarity')}>
                <Activity className="nav-item-icon" /> GA4 & Clarity Analytics
              </li>
              <li className={`nav-item ${activeTab === 'localpack' ? 'active' : ''}`} onClick={() => setActiveTab('localpack')}>
                <MapPin className="nav-item-icon" /> Local Pack (Maps)
              </li>
              <li className={`nav-item ${activeTab === 'geo' ? 'active' : ''}`} onClick={() => setActiveTab('geo')}>
                <MapPin className="nav-item-icon" /> Regio GEO Analyse
              </li>
              <li className={`nav-item ${activeTab === 'competitorgap' ? 'active' : ''}`} onClick={() => setActiveTab('competitorgap')}>
                <Target className="nav-item-icon" /> Concurrentie Gap
              </li>
            </div>
          )}

          {/* Group 2: Optimalisatie Tools */}
          <li className="nav-group-header" onClick={() => toggleGroup('tools')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={16} /> <span>Optimization Tools</span>
            </div>
            {openGroups.tools ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </li>
          {openGroups.tools && (
            <div className="nav-sub-list">
              <li className={`nav-item ${activeTab === 'googleads' ? 'active' : ''}`} onClick={() => setActiveTab('googleads')}>
                <Megaphone className="nav-item-icon" /> Google Ads Studio
              </li>
              <li className={`nav-item ${activeTab === 'contentoptimizer' ? 'active' : ''}`} onClick={() => setActiveTab('contentoptimizer')}>
                <Sparkles className="nav-item-icon" /> Content Optimizer
              </li>
              <li className={`nav-item ${activeTab === 'singlepage' ? 'active' : ''}`} onClick={() => setActiveTab('singlepage')}>
                <FileSearch className="nav-item-icon" /> Single Page Doctor
              </li>
              <li className={`nav-item ${activeTab === 'crawler' ? 'active' : ''}`} onClick={() => setActiveTab('crawler')}>
                <Globe className="nav-item-icon" /> On-Page Crawler
              </li>
              <li className={`nav-item ${activeTab === 'topicclusters' ? 'active' : ''}`} onClick={() => setActiveTab('topicclusters')}>
                <Layers className="nav-item-icon" /> Topic Clusters & Pillars
              </li>
              <li className={`nav-item ${activeTab === 'internallinks' ? 'active' : ''}`} onClick={() => setActiveTab('internallinks')}>
                <Network className="nav-item-icon" /> Interne Link Matrix
              </li>
              <li className={`nav-item ${activeTab === 'schemagen' ? 'active' : ''}`} onClick={() => setActiveTab('schemagen')}>
                <Code className="nav-item-icon" /> Schema.org Generator
              </li>
              <li className={`nav-item ${activeTab === 'pagespeed' ? 'active' : ''}`} onClick={() => setActiveTab('pagespeed')}>
                <Zap className="nav-item-icon" /> PageSpeed Insights
              </li>
            </div>
          )}

          {/* Management Links */}
          <li className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <FileText className="nav-item-icon" /> Rapporten & AI Advies
          </li>
          <li className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings className="nav-item-icon" /> Instellingen
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Dashboard Overzicht'}
              {activeTab === 'googleads' && 'Google Ads Campaign Studio & Directe Export'}
              {activeTab === 'contentoptimizer' && 'AI Content Generator & Title Tag Optimizer'}
              {activeTab === 'localpack' && 'Google Maps & Local Pack Audit (Google Top 3 D-pack)'}
              {activeTab === 'gsc' && 'Google Search Console Audit & Plan van Aanpak'}
              {activeTab === 'schemagen' && 'AI Schema.org JSON-LD Rich Snippet Generator'}
              {activeTab === 'singlepage' && 'Single Page SEO Doctor & AI Prompt Generator'}
              {activeTab === 'topicclusters' && 'Topic Clusters & Pillar Page Analyzer'}
              {activeTab === 'internallinks' && 'Interne Link Matrix & Weespagina Detector'}
              {activeTab === 'competitorgap' && 'Concurrentie Keyword Gap & Content Cannibalisatie'}
              {activeTab === 'geo' && 'GEO & Regionale Zichtbaarheid'}
              {activeTab === 'crawler' && 'Website Krawler'}
              {activeTab === 'rankings' && 'Keyword Rank Tracker (Google.nl)'}
              {activeTab === 'pagespeed' && 'Google PageSpeed & Core Web Vitals'}
              {activeTab === 'reports' && 'SEO Management Rapporten & AI Advies'}
              {activeTab === 'settings' && 'Instellingen & API Sleutels'}
            </h1>
            <p className="page-subtitle">
              Multi-Domein & Regionale SEO Tool geoptimaliseerd voor de Nederlandse Markt
            </p>
          </div>

          {/* Quick Multi-Domain Switcher */}
          {allProjects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Domein:</span>
                <select 
                  value={activeProject?.id || (allProjects[0]?.id)} 
                  onChange={handleSwitchProject}
                  style={{ 
                    background: 'transparent', 
                    color: 'var(--primary)', 
                    border: 'none', 
                    fontWeight: 700, 
                    fontSize: '0.9rem', 
                    outline: 'none',
                    cursor: 'pointer' 
                  }}
                >
                  {allProjects.map(p => (
                    <option key={p.id} value={p.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                      {p.name} ({p.domain.replace(/^https?:\/\//, '')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </header>

        {/* View Switcher */}
        {activeTab === 'dashboard' && (
          <DashboardView 
            data={dashboardData}
            onCrawlClick={() => setActiveTab('crawler')}
            onRankClick={() => setActiveTab('rankings')}
            onPageSpeedClick={() => setActiveTab('pagespeed')}
          />
        )}

        {activeTab === 'contentoptimizer' && (
          <ContentOptimizerView 
            projectId={activeProject?.id} 
            activeProject={activeProject} 
            presetData={presetOptimizerData}
          />
        )}

        {activeTab === 'localpack' && (
          <LocalPackView projectId={activeProject?.id} activeProject={activeProject} />
        )}

        {activeTab === 'gsc' && (
          <GscView projectId={activeProject?.id} activeProject={activeProject} />
        )}

        {activeTab === 'ga4clarity' && (
          <Ga4ClarityView projectId={activeProject?.id} activeProject={activeProject} />
        )}

        {activeTab === 'schemagen' && (
          <SchemaGeneratorView projectId={activeProject?.id} />
        )}

        {activeTab === 'singlepage' && (
          <SinglePageView projectId={activeProject?.id} projectDomain={activeProject?.domain} />
        )}

        {activeTab === 'topicclusters' && (
          <PillarClusterView projectId={activeProject?.id} />
        )}

        {activeTab === 'internallinks' && (
          <InternalLinkView projectId={activeProject?.id} onNavigateTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'competitorgap' && (
          <CompetitorGapView projectId={activeProject?.id} />
        )}

        {activeTab === 'geo' && (
          <GeoAnalysisView 
            projectId={activeProject?.id}
            activeProject={activeProject}
          />
        )}

        {activeTab === 'crawler' && (
          <CrawlerView 
            projectId={activeProject?.id}
            projectDomain={activeProject?.domain}
            onCrawlComplete={() => fetchDashboardData(activeProject?.id)}
          />
        )}

        {activeTab === 'rankings' && (
          <RankTrackerView projectId={activeProject?.id} activeProject={activeProject} />
        )}

        {activeTab === 'pagespeed' && (
          <PageSpeedView projectId={activeProject?.id} projectDomain={activeProject?.domain} />
        )}

        {activeTab === 'reports' && (
          <ReportsView dashboardData={dashboardData} />
        )}

        {activeTab === 'googleads' && (
          <GoogleAdsStudio projectId={activeProject?.id} />
        )}

        {activeTab === 'settings' && (
          <SettingsView 
            activeProject={activeProject} 
            onProjectChange={(proj) => {
              setActiveProject(proj);
              fetchDashboardData(proj.id);
            }} 
          />
        )}
      </main>
    </div>
  );
}
