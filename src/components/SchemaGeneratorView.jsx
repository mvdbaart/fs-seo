import React, { useState, useEffect } from 'react';
import { Code, Copy, Check, Sparkles, CheckCircle2 } from 'lucide-react';

export default function SchemaGeneratorView({ projectId }) {
  const [schemas, setSchemas] = useState(null);
  const [activeSchema, setActiveSchema] = useState('localBusiness');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSchemas();
  }, [projectId]);

  const fetchSchemas = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId || 1}/schema-generator`);
      const data = await res.json();
      setSchemas(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyCode = (jsonCode) => {
    navigator.clipboard.writeText(`<script type="application/ld+json">\n${jsonCode}\n</script>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!schemas) return <div className="card">Laden van Schema.org JSON-LD Generator...</div>;

  const schemaKeys = Object.keys(schemas);
  const current = schemas[activeSchema] || schemas[schemaKeys[0]];

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(241,139,26,0.05))', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">
          <Code size={20} color="var(--primary)" /> AI Schema.org JSON-LD Rich Snippet Generator
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Genereer kant-en-klare JSON-LD gestructureerde data voor Google **Rich Snippets** (Opleidingen, Vacatures, Veelgestelde Vragen & Bedrijfsgegevens).
        </p>
      </div>

      {/* Tabs */}
      <div className="filter-tabs">
        {schemaKeys.map(key => (
          <button
            key={key}
            className={`tab-btn ${activeSchema === key ? 'active' : ''}`}
            onClick={() => setActiveSchema(key)}
          >
            {schemas[key].title}
          </button>
        ))}
      </div>

      {/* Code Display Card */}
      <div className="card" style={{ border: '1px solid var(--primary-border)', background: 'var(--primary-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
              <Sparkles size={18} /> {current.title}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Plak deze HTML-code in de `&lt;head&gt;` of `layout.tsx` van de betreffende pagina.
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => handleCopyCode(current.jsonLd)}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Gekopieerd!' : 'Kopieer JSON-LD HTML Code'}
          </button>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-main)', maxHeight: '420px', overflowY: 'auto' }}>
          {`<script type="application/ld+json">\n${current.jsonLd}\n</script>`}
        </div>
      </div>
    </div>
  );
}
