import React, { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';

export default function AiPromptCanvas({ title, promptText, subtitle = "Kopieer deze kant-en-klare AI-opdracht naar ChatGPT / Claude / Gemini om alle gedetecteerde problemen direct op te lossen." }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!promptText) return null;

  return (
    <div className="card" style={{ border: '1px solid var(--primary-border)', background: 'var(--primary-light)', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700 }}>
            <Sparkles size={20} color="var(--primary)" /> {title || 'AI Oplossings-Prompt (Kant-en-klaar Canvas)'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {subtitle}
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Gekopieerd!' : 'Kopieer AI Prompt'}
        </button>
      </div>

      <textarea
        readOnly
        className="input-field"
        style={{
          width: '100%',
          minHeight: '160px',
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
    </div>
  );
}
