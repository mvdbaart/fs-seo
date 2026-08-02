import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Copy, 
  Check, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  Layers, 
  HelpCircle, 
  Code,
  ArrowRight
} from 'lucide-react';
import AiPromptCanvas from './AiPromptCanvas';

export default function ContentOptimizerView({ projectId, activeProject, presetData }) {
  const [keyword, setKeyword] = useState(presetData?.keyword || 'certificeringsbeheer');
  const [url, setUrl] = useState(presetData?.url || (activeProject ? `${activeProject.domain.replace(/\/$/, '')}/opleidingen/certificeringsbeheer` : 'https://frissestart.nl/opleidingen/certificeringsbeheer'));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedTitle, setCopiedTitle] = useState(null);
  const [copiedMeta, setCopiedMeta] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedFaq, setCopiedFaq] = useState(false);

  const domain = activeProject ? activeProject.domain : 'https://frissestart.nl';

  useEffect(() => {
    if (presetData) {
      if (presetData.keyword) setKeyword(presetData.keyword);
      if (presetData.url) setUrl(presetData.url);
    }
  }, [presetData]);

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/content-generator/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          keyword: keyword.trim(),
          domain: domain
        })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        alert(data.error || 'Fout bij genereren content briefing');
      }
    } catch (err) {
      alert('Netwerkfout bij genereren: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [projectId]);

  const copyToClipboard = (text, type, index = null) => {
    navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(index);
      setTimeout(() => setCopiedTitle(null), 2500);
    } else if (type === 'meta') {
      setCopiedMeta(index);
      setTimeout(() => setCopiedMeta(null), 2500);
    } else if (type === 'prompt') {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } else if (type === 'faq') {
      setCopiedFaq(true);
      setTimeout(() => setCopiedFaq(false), 2500);
    }
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <Sparkles size={20} color="var(--primary)" /> AI Content Generator & Title Optimizer
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Genereer geoptimaliseerde Title Tags, Meta Descriptions en H1/H2 uitbreidingsplannen voor <strong>{domain.replace(/^https?:\/\//, '')}</strong>.
        </p>

        <form onSubmit={handleGenerate} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Doel Zoekwoord:</label>
            <input 
              type="text" 
              className="input-field" 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="bijv. certificeringsbeheer"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Doel Pagina URL (Optioneel):</label>
            <input 
              type="url" 
              className="input-field" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://frissestart.nl/opleidingen/certificeringsbeheer"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '42px', width: '100%' }}>
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Genereer...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Genereer SEO Plan
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <>
          {/* Section 1: Title & Meta CTR Optimizer */}
          <div className="card">
            <h3 className="card-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} /> 1. Geoptimaliseerde Title Tag Variaties (CTR Boosters)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {result.titleVariations.map((t, idx) => (
                <div key={idx} style={{ padding: '14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge badge-info">{t.angle}</span>
                      <span className="badge badge-success">{t.charCount} tekens</span>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {t.title}
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => copyToClipboard(t.title, 'title', idx)}>
                    {copiedTitle === idx ? <Check size={14} color="var(--primary)" /> : <Copy size={14} />} 
                    {copiedTitle === idx ? 'Gekopieerd' : 'Kopieer Title'}
                  </button>
                </div>
              ))}
            </div>

            <h3 className="card-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
              <FileText size={18} /> 2. Hoge-Conversie Meta Descriptions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {result.metaVariations.map((m, idx) => (
                <div key={idx} style={{ padding: '14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge badge-info">{m.angle}</span>
                      <span className="badge badge-success">{m.charCount} tekens</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {m.description}
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => copyToClipboard(m.description, 'meta', idx)}>
                    {copiedMeta === idx ? <Check size={14} color="var(--primary)" /> : <Copy size={14} />} 
                    {copiedMeta === idx ? 'Gekopieerd' : 'Kopieer Meta'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Content Expansion Brief */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--primary)" /> 3. Aanbevolen Content & Koptekst Structuur
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aanbevolen Woordenaantal:</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', margin: '4px 0 12px 0' }}>
                  {result.brief.suggestedStructure.recommendedWordCount} woorden
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aanbevolen H1 kop:</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '4px' }}>
                  {result.brief.suggestedStructure.h1}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '0.9rem' }}>Aanbevolen H2 Subkoppen & Inhoudelijke Focus:</strong>
                {result.brief.suggestedStructure.h2Sections.map((sec, idx) => (
                  <div key={idx} style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.9rem' }}>H2: {sec.heading}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sec.contentFocus}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: AI Copywriting Prompt */}
          <AiPromptCanvas
            promptId={`content_opt_${keyword.replace(/\s+/g, '_')}`}
            title="4. AI Prompt voor Volledig Pagina-Artikel"
            subtitle="Kopieer naar ChatGPT/Claude om direct een artikel van 750+ woorden te genereren."
            promptText={result.brief.aiCopyPrompt}
            targetUrl={url}
          />

          {/* Section 4: Schema.org FAQ JSON-LD */}
          {result.faqSchema && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code size={18} color="var(--primary)" /> 5. FAQ Schema.org JSON-LD Code
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Plaats deze code in de HTML head voor een Rich Snippet in Google.nl.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={() => copyToClipboard(result.faqSchema, 'faq')}>
                  {copiedFaq ? <Check size={14} color="var(--primary)" /> : <Copy size={14} />} {copiedFaq ? 'Gekopieerd' : 'Kopieer JSON-LD'}
                </button>
              </div>

              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--primary)', maxHeight: '200px', overflowY: 'auto' }}>
                {result.faqSchema}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
