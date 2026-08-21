import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Sparkles,
  Rocket,
  FileText,
  Linkedin,
  Facebook,
  Instagram,
  Mail,
  PenTool,
  Megaphone,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Save,
  Trash2,
  ExternalLink,
  Bot,
  Cpu,
  Layers,
  Target,
  Users,
  Eye,
  Edit3,
  Download,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  FolderOpen
} from 'lucide-react';

const PRESET_BRIEFING_CODE95 = `Voor dit veld is de briefing compact maar volledig genoeg voor marketing. Omdat de campagne zowel B2C als B2B kan raken, nemen we beide invalshoeken expliciet mee. De bestaande Code95-funnel kan daarbij als aanvullende route worden gebruikt; die bestaat al uit een gids, bedankpagina en opvolgmails.

## Aanleiding
Rond 10 september verloopt voor een groot deel van de chauffeurs de huidige Code95-termijn. Niet iedereen heeft op dat moment de verplichte 35 uur nascholing afgerond.
FrisseStart organiseert daarom eind september en begin oktober een speciale Code95 Reparatieactie. Hiervoor is een planning samengesteld waarmee chauffeurs die nog uren tekortkomen hun 35 uur nascholing alsnog zo snel mogelijk compleet kunnen maken.

## Doel van de campagne
De extra Code95-planning onder de aandacht brengen en zoveel mogelijk relevante chauffeurs en werkgevers laten doorstromen naar de planning en aanmelding.

## Doelgroepen
B2C:
* Chauffeurs van wie de Code95 is verlopen of dreigt te verlopen
* ZZP-chauffeurs
* Chauffeurs die nog niet alle 35 uur hebben behaald

B2B:
* Transport- en logistieke bedrijven
* Bestaande FrisseStart-klanten
* Werkgevers met één of meerdere chauffeurs die hun Code95 nog niet compleet hebben

## Kernboodschap
Code95 nog niet compleet? FrisseStart heeft eind september en begin oktober extra opleidingsmogelijkheden gepland waarmee je jouw ontbrekende nascholingsuren alsnog snel kunt behalen.
Benadruk urgentie, maar communiceer oplossingsgericht: er is een probleem ontstaan, maar FrisseStart heeft hiervoor extra capaciteit en een concrete planning beschikbaar.

## Campagne-opzet
Werk vanuit één centrale campagne en één hoofdverhaal. Content wordt niet voor ieder kanaal opnieuw bedacht, maar zoveel mogelijk hergebruikt en aangepast aan het kanaal.
De blog/landingspagina vormt de inhoudelijke basis. Vanuit deze hoofdcontent worden varianten gemaakt voor:
* Funnel / Landingspagina
* Blog & Kennisbank
* LinkedIn
* Facebook
* Instagram
* E-mailmarketing & Handtekening

## Content & Invalshoeken
Behandel minimaal:
* Wat er rond 10 september speelt
* Wat het betekent als de 35 uur nog niet compleet zijn
* Wat de Code95 Reparatieactie inhoudt
* Voor wie de actie bedoeld is
* Wanneer de extra opleidingen plaatsvinden
* Hoe chauffeurs hun ontbrekende uren kunnen aanvullen
* Beschikbare plaatsen/data
* Duidelijke CTA naar planning/aanmelding

## Gewenste aanpak
Start met één sterke blog/landingspagina. Gebruik deze vervolgens om meerdere social posts en e-mails te maken. Bouw de communicatie op van:
bewustwording → oplossing → beschikbare planning → urgentie/laatste plaatsen.
Alle communicatie moet inhoudelijk consistent zijn: dezelfde data, voorwaarden, planning en CTA.

## CTA
Primair: Bekijk de Code95 Reparatieplanning / Meld je aan
Voor werkgevers mag aanvullend een contactmogelijkheid worden aangeboden wanneer zij meerdere chauffeurs willen inplannen.`;

const DEFAULT_CHANNELS = [
  {
    key: 'landing_page',
    title: 'Landingspagina & Lead Funnel',
    subtitle: 'De centrale spil waar alle kanalen naartoe linken',
    icon: Rocket,
    badge: 'Centrale Hub',
    defaultAgent: 'campaign_lead',
    defaultModel: 'auto',
    selected: true,
    whyText: 'Dit is de landingspagina waar alle bezoekers terechtkomen om zich in te schrijven of contact op te nemen. Zonder deze pagina hebben de andere kanalen nergens om naartoe te linken!',
    customPrompt: ''
  },
  {
    key: 'blog',
    title: 'SEO Blog & Kennisbank Artikel',
    subtitle: 'Diepgaand concept met zoekwoorden & interne links',
    icon: FileText,
    badge: 'SEO Concept',
    defaultAgent: 'seo_writer',
    defaultModel: 'auto',
    selected: true,
    whyText: 'Een blog trekt gratis bezoekers via Google. In het artikel leggen we alles uit en zetten we handige linkjes naar onze landingspagina!',
    customPrompt: ''
  },
  {
    key: 'linkedin',
    title: 'LinkedIn Posts (B2B & Werkgevers)',
    subtitle: 'Zakelijke berichten voor transporteurs en managers',
    icon: Linkedin,
    badge: 'B2B Bereik',
    defaultAgent: 'linkedin_b2b',
    defaultModel: 'auto',
    selected: true,
    whyText: 'LinkedIn is de beste plek om bazen en planners van transportbedrijven te bereiken. Zo kunnen ze meerdere chauffeurs tegelijk aanmelden.',
    customPrompt: ''
  },
  {
    key: 'facebook',
    title: 'Facebook Posts (B2C & Chauffeurs)',
    subtitle: 'Herkenbare, directe posts voor chauffeurs & ZZP',
    icon: Facebook,
    badge: 'B2C Community',
    defaultAgent: 'social_community',
    defaultModel: 'auto',
    selected: true,
    whyText: 'Veel chauffeurs zitten op Facebook. Met een duidelijke, vriendelijke post en emoji’s klikken ze snel door naar de landingspagina.',
    customPrompt: ''
  },
  {
    key: 'instagram',
    title: 'Instagram Carousel & Story Script',
    subtitle: 'Visuele swipe-kaarten en story link-stickers',
    icon: Instagram,
    badge: 'Visueel',
    defaultAgent: 'social_community',
    defaultModel: 'auto',
    selected: false,
    whyText: 'Met visuele swipe-plaatjes trek je direct de aandacht en stuur je volgers via de Link in Bio naar de actiepagina.',
    customPrompt: ''
  },
  {
    key: 'email',
    title: 'E-mailmarketing Flows (B2C & B2B)',
    subtitle: 'Directe e-mails voor chauffeurs én werkgevers',
    icon: Mail,
    badge: 'Hoge Conversie',
    defaultAgent: 'email_conversion',
    defaultModel: 'auto',
    selected: true,
    whyText: 'Mensen die al in je bestand staan, openen e-mails snel. We maken een versie voor chauffeurs en een versie voor bedrijven!',
    customPrompt: ''
  },
  {
    key: 'email_signature',
    title: 'E-mail Handtekening Banner & P.S.',
    subtitle: 'Korte actielink voor onderaan dagelijkse teammails',
    icon: PenTool,
    badge: 'Gratis Traffic',
    defaultAgent: 'email_conversion',
    defaultModel: 'auto',
    selected: true,
    whyText: 'Iedereen in het team verstuurt dagelijks mails. Een banner onder de handtekening brengt elke dag extra gratis bezoekers.',
    customPrompt: ''
  },
  {
    key: 'ad_copy',
    title: 'Google & Meta Advertentie Teksten',
    subtitle: 'Koppen en beschrijvingen voor gerichte advertenties',
    icon: Megaphone,
    badge: 'Performance Ads',
    defaultAgent: 'ad_copywriter',
    defaultModel: 'auto',
    selected: false,
    whyText: 'Als je budget wilt inzetten voor Google of Facebook advertenties, staan alle koppen en teksten al meteen klaar.',
    customPrompt: ''
  }
];

export default function CampaignWizardView({ projectId }) {
  // Wizard stappen: 1 = Briefing, 2 = Kanalen & AI, 3 = Landingspagina Hub, 4 = Genereren, 5 = Studio Review
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [campaignId, setCampaignId] = useState(null);
  const [title, setTitle] = useState('Code95 Reparatieactie Najaar');
  const [targetUrl, setTargetUrl] = useState('https://frissestart.nl/campagne/code95-reparatieactie');
  const [targetAudience, setTargetAudience] = useState('B2C Chauffeurs (verlopen uren) & B2B Werkgevers/Transportbedrijven');
  const [briefingText, setBriefingText] = useState(PRESET_BRIEFING_CODE95);
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);

  // Generation & AI Presets
  const [personas, setPersonas] = useState({});
  const [models, setModels] = useState([]);
  const [generatedContent, setGeneratedContent] = useState({});
  const [generationProgress, setGenerationProgress] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('landing_page');
  const [copiedKey, setCopiedKey] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [pushStatus, setPushStatus] = useState(null);

  // Saved campaigns drawer
  const [savedCampaigns, setSavedCampaigns] = useState([]);
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);

  useEffect(() => {
    fetchPresets();
    fetchSavedCampaigns();
  }, [projectId]);

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/campaigns/presets');
      if (res.ok) {
        const data = await res.json();
        setPersonas(data.personas || {});
        setModels(data.models || []);
      }
    } catch (e) {
      console.warn('Presets laden mislukt:', e);
    }
  };

  const fetchSavedCampaigns = async () => {
    try {
      const url = projectId ? `/api/campaigns?projectId=${projectId}` : '/api/campaigns';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSavedCampaigns(data.campaigns || []);
      }
    } catch (e) {
      console.warn('Campagnes ophalen mislukt:', e);
    }
  };

  const handleLoadPresetBriefing = () => {
    setTitle('Code95 Reparatieactie Najaar');
    setTargetUrl('https://frissestart.nl/campagne/code95-reparatieactie');
    setTargetAudience('B2C Chauffeurs (verlopen uren) & B2B Transportbedrijven');
    setBriefingText(PRESET_BRIEFING_CODE95);
  };

  const handleToggleChannel = (key) => {
    setChannels(prev => prev.map(ch => {
      if (ch.key === key) {
        // Landing page is required hub
        if (ch.key === 'landing_page' && ch.selected) return ch;
        return { ...ch, selected: !ch.selected };
      }
      return ch;
    }));
  };

  const handleUpdateChannelAgent = (key, agentRole) => {
    setChannels(prev => prev.map(ch => ch.key === key ? { ...ch, defaultAgent: agentRole } : ch));
  };

  const handleUpdateChannelModel = (key, modelId) => {
    setChannels(prev => prev.map(ch => ch.key === key ? { ...ch, defaultModel: modelId } : ch));
  };

  const handleUpdateChannelCustomPrompt = (key, customPrompt) => {
    setChannels(prev => prev.map(ch => ch.key === key ? { ...ch, customPrompt } : ch));
  };

  // Start Generation Flow
  const handleStartGeneration = async () => {
    setCurrentStep(4);
    setIsGenerating(true);
    const selectedChannels = channels.filter(c => c.selected);

    const initialProg = {};
    selectedChannels.forEach(c => {
      initialProg[c.key] = { status: 'pending', label: 'In de wachtrij...' };
    });
    setGenerationProgress(initialProg);

    const newGenerated = { ...generatedContent };

    for (const ch of selectedChannels) {
      setGenerationProgress(prev => ({
        ...prev,
        [ch.key]: { status: 'working', label: `Aan het schrijven met ${ch.defaultAgent}...` }
      }));

      try {
        const res = await fetch('/api/campaigns/generate-channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignTitle: title,
            briefingText,
            targetLandingUrl: targetUrl,
            targetAudience,
            channelKey: ch.key,
            agentRoleId: ch.defaultAgent,
            modelId: ch.defaultModel,
            customInstructions: ch.customPrompt
          })
        });

        const data = await res.json();
        if (data.success) {
          newGenerated[ch.key] = data.result;
          setGeneratedContent({ ...newGenerated });
          setGenerationProgress(prev => ({
            ...prev,
            [ch.key]: { status: 'done', label: `Voltooid via ${data.result.modelUsed}` }
          }));
        } else {
          setGenerationProgress(prev => ({
            ...prev,
            [ch.key]: { status: 'error', label: 'Fout: ' + (data.error || 'Generatie mislukt') }
          }));
        }
      } catch (err) {
        setGenerationProgress(prev => ({
          ...prev,
          [ch.key]: { status: 'error', label: 'Netwerkfout: ' + err.message }
        }));
      }
    }

    setIsGenerating(false);

    // Save campaign automatically
    try {
      const saveRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          projectId,
          title,
          targetUrl,
          briefingText,
          targetAudience,
          channels,
          generatedContent: newGenerated,
          status: 'completed'
        })
      });
      const saveData = await saveRes.json();
      if (saveData.success && saveData.campaign) {
        setCampaignId(saveData.campaign.id);
        fetchSavedCampaigns();
      }
    } catch (e) {
      console.warn('Opslaan mislukt:', e);
    }

    // Go to review step
    setCurrentStep(5);
    if (selectedChannels.length > 0) {
      setActiveResultTab(selectedChannels[0].key);
    }
  };

  const handleRegenerateSingleChannel = async (channelKey) => {
    const ch = channels.find(c => c.key === channelKey);
    if (!ch) return;

    setGenerationProgress(prev => ({
      ...prev,
      [channelKey]: { status: 'working', label: 'Opnieuw aan het schrijven...' }
    }));

    try {
      const res = await fetch('/api/campaigns/generate-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignTitle: title,
          briefingText,
          targetLandingUrl: targetUrl,
          targetAudience,
          channelKey: ch.key,
          agentRoleId: ch.defaultAgent,
          modelId: ch.defaultModel,
          customInstructions: ch.customPrompt
        })
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedContent(prev => ({ ...prev, [channelKey]: data.result }));
        setGenerationProgress(prev => ({
          ...prev,
          [channelKey]: { status: 'done', label: `Voltooid via ${data.result.modelUsed}` }
        }));
      }
    } catch (err) {
      alert('Fout bij hergenereren: ' + err.message);
    }
  };

  const handleManualContentChange = (key, newText) => {
    setGeneratedContent(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        content: newText
      }
    }));
  };

  const handleSaveCampaign = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          projectId,
          title,
          targetUrl,
          briefingText,
          targetAudience,
          channels,
          generatedContent,
          status: 'completed'
        })
      });
      const data = await res.json();
      if (data.success) {
        setCampaignId(data.campaign.id);
        setSaveStatus('saved');
        fetchSavedCampaigns();
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const handleLoadCampaign = (camp) => {
    setCampaignId(camp.id);
    setTitle(camp.title || '');
    setTargetUrl(camp.target_url || '');
    setTargetAudience(camp.target_audience || '');
    setBriefingText(camp.briefing_text || '');
    if (camp.channels && Array.isArray(camp.channels) && camp.channels.length > 0) {
      setChannels(camp.channels);
    }
    if (camp.generatedContent && Object.keys(camp.generatedContent).length > 0) {
      setGeneratedContent(camp.generatedContent);
      setCurrentStep(5);
      const firstKey = Object.keys(camp.generatedContent)[0];
      if (firstKey) setActiveResultTab(firstKey);
    } else {
      setCurrentStep(1);
    }
    setShowSavedDrawer(false);
  };

  const handleDeleteCampaign = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Weet je zeker dat je deze opgeslagen campagne wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (campaignId === id) {
          setCampaignId(null);
        }
        fetchSavedCampaigns();
      }
    } catch (err) {
      alert('Verwijderen mislukt: ' + err.message);
    }
  };

  const handleCopyContent = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadMarkdown = (key, text, titleStr) => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${titleStr.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${key}.md`;
    link.click();
  };

  const handlePushBlogToSupabase = async (blogContent) => {
    setPushStatus('pushing');
    try {
      const res = await fetch('/api/campaigns/push-blog-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          content: blogContent,
          metaDescription: `Bekijk alle informatie over ${title} voor chauffeurs en transporteurs.`,
          targetKeywords: ['Code 95', 'nascholing', 'reparatieactie']
        })
      });
      const data = await res.json();
      if (data.success) {
        setPushStatus('pushed');
        setTimeout(() => setPushStatus(null), 4000);
      } else {
        alert('Supabase push fout: ' + (data.error || 'Niet gelukt'));
        setPushStatus(null);
      }
    } catch (err) {
      alert('Fout: ' + err.message);
      setPushStatus(null);
    }
  };

  const activeChannelConfig = channels.find(c => c.key === activeResultTab);
  const activeContentItem = generatedContent[activeResultTab];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        color: 'white',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(5, 150, 105, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ maxWidth: '750px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px' }}>
            <Sparkles size={13} /> Multi-Channel Campagne & AI Funnel Wizard
          </div>
          <h2 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
            Campagne Wizard: Van Briefing naar Volledige Funnel
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', lineHeight: 1.4 }}>
            Geef je context en wensen mee. Kies per kanaal een gespecialiseerde <strong>AI Agent</strong> en <strong>AI Model</strong>. 
            Alle kanalen (Blog, LinkedIn, Facebook, E-mail, Handtekening) linken automatisch door naar jouw <strong>Landingspagina</strong> om leads te verzamelen!
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowSavedDrawer(!showSavedDrawer)}
            className="btn"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            <FolderOpen size={16} /> Opgeslagen Campagnes ({savedCampaigns.length})
          </button>
          {currentStep === 5 && (
            <button
              onClick={handleSaveCampaign}
              className="btn"
              style={{ background: '#ffffff', color: '#047857', fontWeight: 700 }}
            >
              {saveStatus === 'saving' ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              {saveStatus === 'saved' ? 'Opgeslagen!' : 'Campagne Opslaan'}
            </button>
          )}
        </div>
      </div>

      {/* Saved Campaigns Drawer */}
      {showSavedDrawer && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--primary-border)', background: 'var(--primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} color="var(--primary)" /> Eerder Aangemaakte Campagnes
            </h3>
            <button onClick={() => setShowSavedDrawer(false)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
              Sluiten
            </button>
          </div>
          {savedCampaigns.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nog geen opgeslagen campagnes gevonden.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {savedCampaigns.map(camp => (
                <div
                  key={camp.id}
                  onClick={() => handleLoadCampaign(camp)}
                  style={{
                    background: 'white',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{camp.title}</div>
                    <button
                      onClick={(e) => handleDeleteCampaign(camp.id, e)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                      title="Verwijderen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🔗 {camp.target_url || 'Geen URL'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>
                    {Object.keys(camp.generatedContent || {}).length} kanalen gegenereerd &bull; {new Date(camp.created_at).toLocaleDateString('nl-NL')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stepper Navigation (10-year old / beginner friendly) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        overflowX: 'auto',
        gap: '8px'
      }}>
        {[
          { num: 1, label: '1. Briefing & Context', desc: 'Wat willen we vertellen?' },
          { num: 2, label: '2. Kanalen & AI Agenten', desc: 'Wie schrijft wat?' },
          { num: 3, label: '3. Landingspagina Spil', desc: 'Lead magnet & CTA' },
          { num: 4, label: '4. AI Aan het Werk', desc: 'Multi-model schrijven' },
          { num: 5, label: '5. Studio & Resultaten', desc: 'Kopiëren & Exporteren' }
        ].map((st) => {
          const isActive = currentStep === st.num;
          const isDone = currentStep > st.num;
          return (
            <div
              key={st.num}
              onClick={() => !isGenerating && setCurrentStep(st.num)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                border: isActive ? '1px solid var(--primary-border)' : '1px solid transparent',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating && !isActive ? 0.6 : 1,
                minWidth: '170px'
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isDone ? 'var(--primary)' : (isActive ? 'var(--primary)' : 'var(--border-color)'),
                color: isDone || isActive ? 'white' : 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                {isDone ? <Check size={16} /> : st.num}
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? 'var(--primary)' : 'var(--text-main)' }}>
                  {st.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {st.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* STAP 1: Briefing & Context */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="var(--primary)" /> Stap 1: Geef je Campagne Briefing & Context
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                Vertel de AI agenten alles over de aanleiding, actiedata, doelgroepen en wat je wilt bereiken. Hoe meer context, hoe beter de teksten!
              </p>
            </div>

            <button
              onClick={handleLoadPresetBriefing}
              className="btn btn-secondary"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 600 }}
            >
              <Sparkles size={15} /> ✨ Laad Voorbeeld Briefing (Code95 Reparatieactie)
            </button>
          </div>

          {/* Child-friendly info box */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Lightbulb size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', color: '#1e40af' }}>
              <strong>Wat is een campagne en hoe werkt het?</strong><br />
              Stel je voor dat je een feestje organiseert. Je stuurt uitnodigingen via WhatsApp, hangt een poster op school en vertelt het aan je vrienden. 
              Maar op elk briefje staat hetzelfde adres waar het feestje is! 
              Bij marketing is de <strong>Landingspagina</strong> het adres, en zijn de <strong>social media posts en e-mails</strong> de uitnodigingen.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Titel van de Campagne
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Bijv: Code95 Reparatieactie Najaar"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Doelgroep(en)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="Bijv: B2C Chauffeurs & B2B Werkgevers"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Volledige Context, Aanleiding & Marketing Briefing
            </label>
            <textarea
              rows={12}
              value={briefingText}
              onChange={e => setBriefingText(e.target.value)}
              placeholder="Plak hier je briefing, data, doelen, actie-details en suggesties..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                lineHeight: 1.5
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setCurrentStep(2)}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.9rem' }}
            >
              Volgende Stap: Kanalen & AI Agenten Kiezen <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAP 2: Kies Kanalen & Wijs AI Agenten toe */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="var(--primary)" /> Stap 2: Kies je Marketing Kanalen & AI Specialisten
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              Selecteer welke onderdelen je wilt laten maken. Wijs per kanaal een specifieke <strong>AI Specialist Agent</strong> en het gewenste <strong>AI Model</strong> toe.
            </p>
          </div>

          {/* Channels Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {channels.map((ch) => {
              const Icon = ch.icon;
              const isSelected = ch.selected;

              return (
                <div
                  key={ch.key}
                  style={{
                    background: isSelected ? '#ffffff' : '#f9fafb',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Channel Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--primary-light)' : '#f3f4f6',
                        color: isSelected ? 'var(--primary)' : 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          {ch.title}
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isSelected ? 'var(--primary-border)' : '#e5e7eb',
                          color: isSelected ? 'var(--primary-hover)' : 'var(--text-dim)'
                        }}>
                          {ch.badge}
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={ch.key === 'landing_page'}
                      onChange={() => handleToggleChannel(ch.key)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: ch.key === 'landing_page' ? 'not-allowed' : 'pointer' }}
                    />
                  </div>

                  {/* Why Text for Beginners */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '8px 10px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                    💡 <strong>Waarom dit kanaal?</strong> {ch.whyText}
                  </div>

                  {/* Agent & Model Selectors */}
                  {isSelected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
                          <Bot size={13} color="var(--primary)" /> Toegewezen AI Specialist Agent:
                        </label>
                        <select
                          value={ch.defaultAgent}
                          onChange={(e) => handleUpdateChannelAgent(ch.key, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 'white'
                          }}
                        >
                          {Object.keys(personas).map((pk) => (
                            <option key={pk} value={pk}>
                              {personas[pk].badge} - {personas[pk].name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
                          <Cpu size={13} color="var(--primary)" /> AI Model:
                        </label>
                        <select
                          value={ch.defaultModel}
                          onChange={(e) => handleUpdateChannelModel(ch.key, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.8rem',
                            background: 'white'
                          }}
                        >
                          {models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Prompt Toggle */}
                      <div>
                        <input
                          type="text"
                          value={ch.customPrompt}
                          onChange={(e) => handleUpdateChannelCustomPrompt(ch.key, e.target.value)}
                          placeholder="Optioneel: Extra specifieke instructie voor deze agent..."
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            fontSize: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            background: '#fafafa'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setCurrentStep(1)}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} /> Vorige Stap
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.9rem' }}
            >
              Volgende Stap: Landingspagina Hub Controleren <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAP 3: Landingspagina Lead Funnel Hub */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Rocket size={20} color="var(--primary)" /> Stap 3: De Centrale Landingspagina (Lead Hub)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              Een funnel is de combinatie van alle onderdelen. Dit is het hart van je campagne waar alle social posts, blogs en e-mails naartoe linken!
            </p>
          </div>

          {/* Lead Hub Box */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '2px solid var(--primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-hover)' }}>
                Centrale Doel-URL voor de hele campagne
              </h4>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                Landingspagina URL (Alle andere kanalen linken automatisch naar dit webadres)
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://frissestart.nl/campagne/code95-reparatieactie"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--primary)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--primary-hover)',
                  background: 'white'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'white', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>Primaire CTA Knop</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>Bekijk Planning & Aanmelden</div>
              </div>
              <div style={{ background: 'white', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>Lead Capture Doel</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>Chauffeurs & Werkgevers Inschrijvingen</div>
              </div>
              <div style={{ background: 'white', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>Geselecteerde Kanalen</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {channels.filter(c => c.selected).length} Kanalen Klaar voor Generatie
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setCurrentStep(2)}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} /> Vorige Stap
            </button>
            <button
              onClick={handleStartGeneration}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.95rem', background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)' }}
            >
              <Wand2 size={18} /> ✨ Start Campagne Generatie met Alle AI Agenten!
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAP 4: Live Voortgang & Generatie */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '16px' }}>
            <Wand2 size={36} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
            De AI Specialisten Schrijven Jouw Campagne!
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 24px auto' }}>
            Elke specialist werkt tegelijk aan zijn eigen kanaal en zorgt dat alle teksten, koppen en actieknoppen perfect naar de landingspagina verwijzen.
          </p>

          {/* Progress Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', textAlign: 'left', maxWidth: '900px', margin: '0 auto' }}>
            {channels.filter(c => c.selected).map(ch => {
              const prog = generationProgress[ch.key] || { status: 'pending', label: 'Wachten...' };
              const isWorking = prog.status === 'working';
              const isDone = prog.status === 'done';
              const isErr = prog.status === 'error';

              return (
                <div
                  key={ch.key}
                  style={{
                    background: isDone ? '#f0fdf4' : (isWorking ? '#eff6ff' : '#fafafa'),
                    border: isDone ? '1px solid #86efac' : (isWorking ? '1px solid #93c5fd' : '1px solid var(--border-color)'),
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      {ch.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isDone ? 'var(--primary)' : (isWorking ? '#2563eb' : 'var(--text-dim)') }}>
                      {prog.label}
                    </div>
                  </div>
                  <div>
                    {isDone && <CheckCircle2 size={20} color="var(--primary)" />}
                    {isWorking && <RefreshCw size={18} className="animate-spin" color="#2563eb" />}
                    {isErr && <AlertCircle size={20} color="var(--danger)" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAP 5: Resultaten & Studio Review */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <div>
          {/* Top Bar with Channel Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            marginBottom: '16px',
            paddingBottom: '4px'
          }}>
            {channels.filter(c => c.selected).map((ch) => {
              const Icon = ch.icon;
              const isActive = activeResultTab === ch.key;
              const hasContent = !!generatedContent[ch.key];

              return (
                <button
                  key={ch.key}
                  onClick={() => setActiveResultTab(ch.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--primary)' : '#ffffff',
                    color: isActive ? 'white' : 'var(--text-main)',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} />
                  <span>{ch.title.split(' ')[0]} {ch.title.split(' ')[1] || ''}</span>
                  {hasContent && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isActive ? '#ffffff' : 'var(--primary)'
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Content Studio Card */}
          {activeContentItem ? (
            <div className="card" style={{ padding: '24px' }}>
              {/* Channel Meta Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{activeChannelConfig?.badge.split(' ')[0]}</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      {activeChannelConfig?.title}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Geschreven door: <strong>{activeContentItem.agentRole}</strong></span>
                    <span>&bull;</span>
                    <span>Model: <strong>{activeContentItem.modelUsed}</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleRegenerateSingleChannel(activeResultTab)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    title="Alleen dit kanaal opnieuw laten schrijven door de AI"
                  >
                    <RefreshCw size={13} /> Opnieuw Schrijven
                  </button>

                  <button
                    onClick={() => handleCopyContent(activeResultTab, activeContentItem.content)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px', borderColor: copiedKey === activeResultTab ? 'var(--primary)' : 'var(--border-color)' }}
                  >
                    {copiedKey === activeResultTab ? <Check size={13} color="var(--primary)" /> : <Copy size={13} />}
                    {copiedKey === activeResultTab ? 'Gekopieerd!' : 'Kopiëren'}
                  </button>

                  <button
                    onClick={() => handleDownloadMarkdown(activeResultTab, activeContentItem.content, title)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    title="Download als Markdown (.md)"
                  >
                    <Download size={13} /> Download .MD
                  </button>

                  {activeResultTab === 'blog' && (
                    <button
                      onClick={() => handlePushBlogToSupabase(activeContentItem.content)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                      {pushStatus === 'pushing' ? <RefreshCw className="animate-spin" size={13} /> : <ExternalLink size={13} />}
                      {pushStatus === 'pushed' ? 'Blog Toegevoegd als Concept!' : 'Push Blog naar Supabase'}
                    </button>
                  )}
                </div>
              </div>

              {/* Lead Link Reminder Banner */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                  <span>🔗</span>
                  <span><strong>Doellink voor dit kanaal:</strong></span>
                  <a href={targetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                    {targetUrl}
                  </a>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  Alle CTA's verwijzen naar deze centrale pagina
                </span>
              </div>

              {/* Editable Markdown Content Area */}
              <div>
                <textarea
                  rows={20}
                  value={activeContentItem.content}
                  onChange={(e) => handleManualContentChange(activeResultTab, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    color: '#1a1a18',
                    background: '#ffffff'
                  }}
                />
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="btn btn-secondary"
                >
                  <ArrowLeft size={16} /> Kanalen & Agenten Aanpassen
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleSaveCampaign}
                    className="btn btn-primary"
                  >
                    {saveStatus === 'saving' ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                    {saveStatus === 'saved' ? 'Campagne Opgeslagen in Database!' : 'Campagne Opslaan'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Nog geen content gegenereerd voor dit kanaal.
              </p>
              <button
                onClick={handleStartGeneration}
                className="btn btn-primary"
                style={{ marginTop: '12px' }}
              >
                Start Generatie
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
