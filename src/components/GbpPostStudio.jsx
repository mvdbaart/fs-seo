import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  Trash2, 
  ExternalLink, 
  Image as ImageIcon, 
  MapPin, 
  Clock, 
  Building2, 
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Layers,
  Calendar,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Meer informatie' },
  { value: 'BOOK', label: 'Boeken / Reserveren' },
  { value: 'SIGN_UP', label: 'Aanmelden' },
  { value: 'CALL', label: 'Nu bellen' }
];

const PRESET_IMAGES = [
  { label: 'Heftruck', url: 'https://frissestart.nl/images/courses/heftruck-cursus.webp' },
  { label: 'Reachtruck', url: 'https://frissestart.nl/images/courses/reachtruck-cursus.webp' },
  { label: 'VCA', url: 'https://frissestart.nl/images/courses/vca-cursus.webp' },
  { label: 'Hoogwerker', url: 'https://frissestart.nl/images/courses/hoogwerker-cursus.webp' }
];

export default function GbpPostStudio({ projectId, activeProject }) {
  const [presets, setPresets] = useState({});
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState(null);
  const [copied, setCopied] = useState(false);

  // Formulier state
  const [selectedPreset, setSelectedPreset] = useState('heftruck');
  const [topic, setTopic] = useState('Heftruck Certificaat in 1 Dag');
  const [location, setLocation] = useState('Nuenen & Regio Eindhoven');
  const [ctaType, setCtaType] = useState('LEARN_MORE');
  const [ctaUrl, setCtaUrl] = useState('https://frissestart.nl/cursussen/heftruck-certificaat');
  const [mediaUrl, setMediaUrl] = useState('https://frissestart.nl/images/courses/heftruck-cursus.webp');
  const [customInstructions, setCustomInstructions] = useState('');
  const [summary, setSummary] = useState('');
  const [currentPostId, setCurrentPostId] = useState(null);

  useEffect(() => {
    fetchPosts();
  }, [projectId]);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    const id = projectId || 1;
    try {
      const res = await fetch(`/api/projects/${id}/gbp/posts`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        if (data.presets) {
          setPresets(data.presets);
        }
      }
    } catch (err) {
      console.error('Fout bij ophalen posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleSelectPreset = (key) => {
    setSelectedPreset(key);
    const p = presets[key];
    if (p) {
      setTopic(p.title || '');
      setCtaUrl(p.defaultUrl || 'https://frissestart.nl');
      setCtaType(p.defaultCta || 'LEARN_MORE');
      
      const imgMatch = PRESET_IMAGES.find(img => img.label.toLowerCase() === key.toLowerCase());
      if (imgMatch) setMediaUrl(imgMatch.url);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setPublishFeedback(null);
    const id = projectId || 1;

    try {
      const res = await fetch(`/api/projects/${id}/gbp/posts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetKey: selectedPreset,
          topic,
          location,
          ctaType,
          ctaUrl,
          customInstructions
        })
      });

      if (!res.ok) throw new Error('Genereren mislukt');
      const data = await res.json();
      setSummary(data.summary || '');
      setCurrentPostId(null);
    } catch (err) {
      alert('Fout bij AI generatie: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!summary.trim()) {
      alert('Er is nog geen posttekst om op te slaan.');
      return;
    }

    const id = projectId || 1;
    try {
      const res = await fetch(`/api/projects/${id}/gbp/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentPostId,
          title: topic,
          summary,
          topicType: 'STANDARD',
          ctaType,
          ctaUrl,
          mediaUrl,
          status: 'draft'
        })
      });

      if (res.ok) {
        const saved = await res.json();
        setCurrentPostId(saved.id);
        fetchPosts();
        setPublishFeedback({
          type: 'success',
          message: 'Post succesvol opgeslagen als concept!'
        });
      }
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    }
  };

  const handlePublish = async () => {
    if (!summary.trim()) {
      alert('Genereer of schrijf eerst een post.');
      return;
    }

    setPublishing(true);
    setPublishFeedback(null);
    const id = projectId || 1;

    try {
      // Sla eerst op als concept als dat nog niet is gebeurd
      let targetId = currentPostId;
      if (!targetId) {
        const saveRes = await fetch(`/api/projects/${id}/gbp/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: topic,
            summary,
            topicType: 'STANDARD',
            ctaType,
            ctaUrl,
            mediaUrl,
            status: 'draft'
          })
        });
        const saved = await saveRes.json();
        targetId = saved.id;
        setCurrentPostId(targetId);
      }

      // Roep publicatie aan
      const pubRes = await fetch(`/api/projects/${id}/gbp/posts/${targetId}/publish`, {
        method: 'POST'
      });

      const result = await pubRes.json();
      fetchPosts();

      if (result.success) {
        setPublishFeedback({
          type: 'success',
          message: result.message || 'Post is succesvol live geplaatst op je Google Bedrijfsprofiel!'
        });
      } else {
        setPublishFeedback({
          type: result.quotaPending ? 'info' : 'warning',
          message: result.message,
          quotaPending: result.quotaPending
        });
      }
    } catch (err) {
      setPublishFeedback({
        type: 'error',
        message: 'Fout bij publiceren: ' + err.message
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyText = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLoadPost = (p) => {
    setCurrentPostId(p.id);
    setTopic(p.title || '');
    setSummary(p.summary || '');
    setCtaType(p.cta_type || 'LEARN_MORE');
    setCtaUrl(p.cta_url || '');
    setMediaUrl(p.media_url || '');
    setPublishFeedback(null);
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const handleDeletePost = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Weet je zeker dat je deze post wilt verwijderen?')) return;
    const projId = projectId || 1;
    try {
      await fetch(`/api/projects/${projId}/gbp/posts/${id}`, { method: 'DELETE' });
      if (currentPostId === id) setCurrentPostId(null);
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Info Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(241,139,26,0.08), rgba(5,150,105,0.06))', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary)' }}>
              <Building2 size={24} /> Google Bedrijfsprofiel Posts Studio
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
              Genereer met AI wervende Google Posts voor je cursussen, bekijk de live preview en publiceer direct naar Google Maps & Zoeken.
            </p>
          </div>
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} /> OAuth Koppeling Actief
          </span>
        </div>
      </div>

      {/* Main Studio Grid: Left Editor + Right Live Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Left Column: Preset Selector & Controls */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" /> 1. Kies Onderwerp & Cursus
            </h3>
            {currentPostId && (
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                Concept #{currentPostId} bewerken
              </span>
            )}
          </div>

          {/* Preset Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { id: 'heftruck', label: '🚜 Heftruck Cursus' },
              { id: 'reachtruck', label: '🏗️ Reachtruck' },
              { id: 'vca', label: '⚡ VCA Basis / VOL' },
              { id: 'hoogwerker', label: '🦺 Hoogwerker' },
              { id: 'lastminute', label: '⏳ Last-minute' },
              { id: 'bedrijven', label: '🏢 SOOB Subsidie' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${selectedPreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', fontSize: '0.82rem' }}
                onClick={() => handleSelectPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Onderwerp / Titel van de Post
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Bijv. Heftruck Certificaat in 1 Dag"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Lokale Regio
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Nuenen, Eindhoven, Helmond"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Actieknop (Call to Action)
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={ctaType}
                  onChange={(e) => setCtaType(e.target.value)}
                >
                  {CTA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                <ExternalLink size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Actieknop URL (Landingspagina)
              </label>
              <input
                type="url"
                className="input"
                style={{ width: '100%' }}
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://frissestart.nl/cursussen/..."
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                <ImageIcon size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Afbeelding URL (Optioneel)
              </label>
              <input
                type="url"
                className="input"
                style={{ width: '100%' }}
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://frissestart.nl/images/..."
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Extra AI Instructies / Acties (Optioneel)
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Bijv. Vermeld SOOB subsidie tot 50% en zaterdagcursussen"
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}
            >
              {generating ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
              {generating ? 'AI schrijft Google Post...' : 'Genereer Post met AI'}
            </button>
          </div>
        </div>

        {/* Right Column: Google Live Preview Card & Action Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card" style={{ padding: '20px', border: '1px solid #dcdcdc', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #f18b1a, #ea580c)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  FS
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#202124' }}>
                    {activeProject?.name || 'FrisseStart'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#70757a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Google Bedrijfsprofiel Update</span> · <Clock size={11} /> <span>Zojuist</span>
                  </div>
                </div>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                Google Zoeken & Maps Preview
              </span>
            </div>

            {/* Post Image Preview */}
            {mediaUrl && (
              <div style={{ width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', background: '#f8f9fa', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img 
                  src={mediaUrl} 
                  alt="Post preview" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Post Content Text Area */}
            <div style={{ marginBottom: '16px' }}>
              <textarea
                className="input"
                rows={6}
                style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.6, resize: 'vertical', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Klik op 'Genereer Post met AI' of typ hier je bericht voor Google Bedrijfsprofiel..."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#70757a', marginTop: '4px' }}>
                <span>{summary.length} tekens (aanbevolen: 150-600)</span>
                <span>{summary.split(/\s+/).filter(Boolean).length} woorden</span>
              </div>
            </div>

            {/* Google CTA Button Preview */}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
              <a
                href={ctaUrl || '#'}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#1a73e8',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                }}
              >
                {CTA_OPTIONS.find(o => o.value === ctaType)?.label || 'Meer informatie'}
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Publishing & Action Controls */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              
              <button
                className="btn btn-primary"
                onClick={handleCopyText}
                disabled={!summary.trim()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Gekopieerd naar klembord!' : 'Kopieer Post Tekst'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleSaveDraft}
                disabled={!summary.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <PlusCircle size={16} />
                Opslaan als Concept
              </button>

              <button
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={publishing || !summary.trim()}
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  borderColor: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Publiceert direct naar Google Bedrijfsprofiel (zodra Basic API Access actief is)"
              >
                {publishing ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                {publishing ? 'Plaatsen...' : '1-Klik Publiceren'}
              </button>
            </div>

            {/* Status & Quota Feedback Banner */}
            {publishFeedback && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                marginTop: '6px',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                background: publishFeedback.type === 'success' ? 'var(--primary-light)' : publishFeedback.type === 'info' ? '#eff6ff' : 'var(--warning-light)',
                border: `1px solid ${publishFeedback.type === 'success' ? 'var(--primary-border)' : publishFeedback.type === 'info' ? '#bfdbfe' : 'var(--warning)'}`,
                color: publishFeedback.type === 'success' ? 'var(--primary)' : publishFeedback.type === 'info' ? '#1e40af' : '#92400e'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  {publishFeedback.type === 'success' ? (
                    <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div>
                    <strong>
                      {publishFeedback.type === 'success'
                        ? 'Succes!'
                        : publishFeedback.quotaPending
                        ? 'Google Basic API Goedkeuring In Behandeling'
                        : 'Melding'}
                    </strong>
                    <div style={{ marginTop: '2px' }}>{publishFeedback.message}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Concepten & Geschiedenis Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 className="card-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            <Layers size={20} color="var(--primary)" /> Opgeslagen Posts & Geschiedenis ({posts.length})
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchPosts} disabled={loadingPosts}>
            <RefreshCw size={14} className={loadingPosts ? 'spin' : ''} /> Vernieuwen
          </button>
        </div>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Nog geen opgeslagen posts. Genereer hierboven een post en sla deze op als concept of publiceer direct!
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Titel / Cursus</th>
                  <th>Voorbeeld van tekst</th>
                  <th>Call to Action</th>
                  <th>Status</th>
                  <th>Aangemaakt</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => handleLoadPost(p)}>
                    <td>
                      <strong>{p.title || 'Google Post'}</strong>
                    </td>
                    <td style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }}>
                      {p.summary}
                    </td>
                    <td>
                      <span className="badge badge-info">{p.cta_type || 'LEARN_MORE'}</span>
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'published' ? 'badge-success' : p.status === 'pending_approval' ? 'badge-warning' : 'badge-secondary'}`}>
                        {p.status === 'published' ? 'Gepubliceerd' : p.status === 'pending_approval' ? 'Wacht op Quotum' : 'Concept'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {new Date(p.created_at).toLocaleDateString('nl-NL')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleLoadPost(p)}
                          title="Laden in preview"
                        >
                          Bewerken
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={(e) => handleDeletePost(p.id, e)}
                          title="Verwijderen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
