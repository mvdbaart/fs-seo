import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, CheckCircle2, Circle, Clock, Send, RefreshCw, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

export default function AiPromptCanvas({ 
  title, 
  promptText, 
  subtitle = "Kopieer deze kant-en-klare AI-opdracht naar ChatGPT / Claude / Gemini om alle gedetecteerde problemen direct op te lossen.", 
  promptId,
  targetUrl 
}) {
  const [copied, setCopied] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);

  // Generate storage key based on promptId or title/promptText
  const keyBase = promptId || (title ? title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'generic_prompt');
  const storageKey = `ai_prompt_exec_${keyBase}`;

  const [executed, setExecuted] = useState(false);
  const [executedAt, setExecutedAt] = useState('');
  const [indexingLoading, setIndexingLoading] = useState(false);
  const [indexingResult, setIndexingResult] = useState(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiStyle, setAiStyle] = useState('default');
  const [aiResult, setAiResult] = useState(null);
  const [showResult, setShowResult] = useState(true);
  const [blogPushLoading, setBlogPushLoading] = useState(false);
  const [blogPushResult, setBlogPushResult] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setExecuted(!!parsed.executed);
        setExecutedAt(parsed.executedAt || '');
        if (parsed.indexingResult) setIndexingResult(parsed.indexingResult);
        if (parsed.aiResult) setAiResult(parsed.aiResult);
      } else {
        setExecuted(false);
        setExecutedAt('');
        setIndexingResult(null);
        setAiResult(null);
      }
    } catch (e) {
      console.error('Error reading prompt execution status:', e);
    }
  }, [storageKey]);

  const toggleExecuted = (overrideTimestamp, overrideAiResult) => {
    const nextExecuted = overrideTimestamp ? true : !executed;
    let timestamp = overrideTimestamp || '';
    
    if (nextExecuted && !timestamp) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      timestamp = `${dateStr} om ${timeStr}`;
    }

    setExecuted(nextExecuted);
    setExecutedAt(timestamp);

    const currentAiResult = overrideAiResult !== undefined ? overrideAiResult : aiResult;

    try {
      if (nextExecuted) {
        localStorage.setItem(storageKey, JSON.stringify({ 
          executed: true, 
          executedAt: timestamp,
          indexingResult,
          aiResult: currentAiResult
        }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.error('Error saving prompt execution status:', e);
    }
  };

  const handleCopy = () => {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyResultText = () => {
    const textToCopy = editedText || aiResult?.generatedText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2500);
  };

  const handleIndexUrl = async () => {
    if (!targetUrl) return;
    setIndexingLoading(true);
    try {
      const res = await axios.post('/api/indexing/publish', { url: targetUrl, type: 'URL_UPDATED' });
      const nowTime = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const resData = { success: true, message: `Verzonden om ${nowTime}` };
      setIndexingResult(resData);
      
      // Auto-vink ook af als uitgevoerd bij succesvolle indexering
      if (!executed) {
        toggleExecuted();
      }
    } catch (err) {
      setIndexingResult({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setIndexingLoading(false);
    }
  };

  const handleGenerateAi = async () => {
    if (!promptText) return;
    setAiLoading(true);
    try {
      const res = await axios.post('/api/ai/generate', { promptText, provider: 'auto', style: aiStyle });
      if (res.data && res.data.generatedText) {
        setAiResult(res.data);
        setShowResult(true);
        const now = new Date();
        const timestamp = `${now.toLocaleDateString('nl-NL')} om ${now.toLocaleTimeString('nl-NL')}`;
        toggleExecuted(timestamp, res.data);
      }
    } catch (err) {
      alert(`AI Generatie fout: ${err.response?.data?.error || err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (!promptText) return null;

  return (
    <div 
      className="card" 
      style={{ 
        border: executed ? '1px solid #10b981' : '1px solid var(--primary-border)', 
        background: executed ? 'rgba(16, 185, 129, 0.04)' : 'var(--primary-light)', 
        marginTop: '24px',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', color: executed ? '#059669' : 'var(--primary)', fontWeight: 700 }}>
            <Sparkles size={20} color={executed ? '#059669' : 'var(--primary)'} /> {title || 'AI Oplossings-Prompt (Kant-en-klaar Canvas)'}
            {executed && (
              <span style={{
                fontSize: '0.75rem',
                background: '#d1fae5',
                color: '#065f46',
                padding: '2px 10px',
                borderRadius: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle2 size={13} /> Uitgevoerd
              </span>
            )}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={aiStyle}
            onChange={(e) => setAiStyle(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #c084fc',
              background: '#ffffff',
              fontSize: '0.82rem',
              color: '#6b21a8',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <option value="default">Stijl: Standaard SEO</option>
            <option value="sander">Stijl: Sander (Direct & Pragmatisch)</option>
            <option value="kirsten">Stijl: Kirsten (Vriendelijk & Professioneel)</option>
            <option value="opleidingen">Stijl: Opleidingen & Certificering</option>
            <option value="vacatures">Stijl: Vacatures (Motiverend)</option>
          </select>

          <button 
            className="btn btn-secondary" 
            onClick={handleGenerateAi}
            disabled={aiLoading}
            style={{ 
              background: '#8b5cf6', 
              color: '#ffffff', 
              borderColor: '#7c3aed',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {aiLoading ? <RefreshCw size={16} className="spin" /> : <Bot size={16} />}
            {aiLoading ? 'AI is bezig...' : '🤖 Genereer direct met AI'}
          </button>

          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Gekopieerd!' : 'Kopieer AI Prompt'}
          </button>
        </div>
      </div>

      <textarea
        readOnly
        className="input-field"
        style={{
          width: '100%',
          minHeight: '130px',
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          color: 'var(--text-main)',
          resize: 'vertical'
        }}
        value={promptText}
      />

      {/* AI Direct Result Section */}
      {aiResult && (
        <div style={{
          marginTop: '16px',
          border: '1px solid #c084fc',
          borderRadius: 'var(--radius-md)',
          background: '#faf5ff',
          overflow: 'hidden'
        }}>
          <div 
            onClick={() => setShowResult(!showResult)}
            style={{
              padding: '12px 16px',
              background: '#f3e8ff',
              borderBottom: showResult ? '1px solid #e9d5ff' : 'none',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b21a8', fontWeight: 700, fontSize: '0.92rem' }}>
              <Bot size={18} color="#7e22ce" />
              <span>Gegenereerd met {aiResult.provider}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {isBlogPrompt && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const textToPush = editedText || aiResult?.generatedText;
                    if (!textToPush) return;
                    setBlogPushLoading(true);
                    try {
                      const res = await axios.post('/api/supabase/push-blog', {
                        title: title || 'AI Gegenereerd Artikel',
                        content: textToPush,
                        metaDescription: textToPush.slice(0, 150).replace(/[\r\n]+/g, ' '),
                        status: 'draft'
                      });
                      setBlogPushResult({ success: true, message: `Opgeslagen als concept (${res.data.table})` });
                    } catch (err) {
                      setBlogPushResult({ success: false, message: err.response?.data?.error || err.message });
                    } finally {
                      setBlogPushLoading(false);
                    }
                  }}
                  disabled={blogPushLoading}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.78rem', background: '#059669', borderColor: '#059669', color: '#ffffff', fontWeight: 600 }}
                >
                  {blogPushLoading ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                  {blogPushLoading ? 'Pushen...' : '🚀 Push naar fs-next Blog (Concept)'}
                </button>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCopyResultText(); }}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.78rem', background: '#ffffff', borderColor: '#c084fc', color: '#6b21a8' }}
              >
                {copiedResult ? <Check size={14} /> : <Copy size={14} />}
                {copiedResult ? 'Resultaat Gekopieerd!' : 'Kopieer AI Output'}
              </button>

              {showResult ? <ChevronUp size={18} color="#7e22ce" /> : <ChevronDown size={18} color="#7e22ce" />}
            </div>
          </div>

          {showResult && (
            <div style={{ padding: '16px', background: '#ffffff' }}>
              {blogPushResult && (
                <div style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: blogPushResult.success ? '#d1fae5' : '#fee2e2',
                  color: blogPushResult.success ? '#065f46' : '#991b1b',
                  border: `1px solid ${blogPushResult.success ? '#10b981' : '#f87171'}`
                }}>
                  {blogPushResult.success ? `✓ ${blogPushResult.message}` : `⚠ ${blogPushResult.message}`}
                </div>
              )}
              <textarea
                className="input-field"
                style={{
                  width: '100%',
                  minHeight: '180px',
                  maxHeight: '400px',
                  background: '#ffffff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: '#1e293b',
                  resize: 'vertical'
                }}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
              />
              <div style={{ fontSize: '0.78rem', color: '#6b21a8', marginTop: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ✏️ <span>Je kunt de gegenereerde AI-output hierboven direct aanpassen als je het ergens niet mee eens bent.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Execution & Indexing Action Bar */}
      <div style={{ 
        marginTop: '12px', 
        paddingTop: '12px', 
        borderTop: '1px dashed var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => toggleExecuted()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: executed ? '#d1fae5' : '#ffffff',
              border: `1px solid ${executed ? '#10b981' : 'var(--border-color)'}`,
              color: executed ? '#065f46' : 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              transition: 'all 0.15s ease'
            }}
          >
            {executed ? <CheckCircle2 size={18} color="#059669" /> : <Circle size={18} color="var(--text-muted)" />}
            {executed ? 'Markering opheffen' : 'Vink af als uitgevoerd'}
          </button>

          {targetUrl && (
            <button
              type="button"
              onClick={handleIndexUrl}
              disabled={indexingLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--primary)',
                border: '1px solid var(--primary)',
                color: '#ffffff',
                fontWeight: 600,
                cursor: indexingLoading ? 'not-allowed' : 'pointer',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                opacity: indexingLoading ? 0.7 : 1
              }}
            >
              {indexingLoading ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
              {indexingLoading ? 'Indienen bij Google...' : '⚡ Indienen bij Google Indexing API'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {indexingResult && (
            <span style={{ 
              fontSize: '0.8rem', 
              color: indexingResult.success ? '#065f46' : 'var(--danger)',
              fontWeight: 500
            }}>
              {indexingResult.success ? `✓ Google Indexing: ${indexingResult.message}` : `⚠ ${indexingResult.message}`}
            </span>
          )}

          {executed && executedAt ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', color: '#065f46', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '6px', fontWeight: 500 }}>
              <Clock size={14} color="#059669" />
              <span>Uitgevoerd op: <strong>{executedAt}</strong></span>
            </div>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Nog niet afgevinkt
            </span>
          )}
        </div>
      </div>
    </div>
  );
}



