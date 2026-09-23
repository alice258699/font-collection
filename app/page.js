"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/components/ThemeProvider';
import styles from './page.module.css';

export default function Home() {
  const { theme } = useTheme();
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('All');
  const [allTags, setAllTags] = useState({ type: [], language: [], style: [], other: [] });
  
  const [previewImageFont, setPreviewImageFont] = useState(null);
  const [editingTagsFont, setEditingTagsFont] = useState(null);
  const [newTagInputs, setNewTagInputs] = useState({ type: '', language: '', style: '', other: '' });

  useEffect(() => {
    fetchFonts();
  }, []);

  const fetchFonts = async () => {
    try {
      const res = await fetch('/api/fonts');
      const data = await res.json();
      setFonts(data);
      
      // Extract unique tags per category
      const categories = ['type', 'language', 'style', 'other'];
      const tags = { type: new Set(), language: new Set(), style: new Set(), other: new Set() };
      data.forEach(font => {
        if (font.tags && !Array.isArray(font.tags)) {
          categories.forEach(cat => {
            font.tags[cat]?.forEach(tag => tags[cat].add(tag));
          });
        }
      });
      setAllTags({
        type: Array.from(tags.type),
        language: Array.from(tags.language),
        style: Array.from(tags.style),
        other: Array.from(tags.other)
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleAddTag = async (e, category) => {
    e.preventDefault();
    const input = newTagInputs[category];
    if (!input.trim() || !editingTagsFont) return;
    
    const newTag = input.trim();
    if (editingTagsFont.tags?.[category]?.includes(newTag)) {
      setNewTagInputs(prev => ({ ...prev, [category]: '' }));
      return;
    }

    const updatedTags = {
      ...editingTagsFont.tags,
      [category]: [...(editingTagsFont.tags?.[category] || []), newTag]
    };
    await updateTags(editingTagsFont.id, updatedTags);
    setNewTagInputs(prev => ({ ...prev, [category]: '' }));
  };

  const handleRemoveTag = async (category, tagToRemove) => {
    if (!editingTagsFont) return;
    const updatedTags = {
      ...editingTagsFont.tags,
      [category]: editingTagsFont.tags[category].filter(t => t !== tagToRemove)
    };
    await updateTags(editingTagsFont.id, updatedTags);
  };

  const updateTags = async (id, tags) => {
    try {
      const res = await fetch(`/api/fonts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      if (res.ok) {
        const updated = await res.json();
        setEditingTagsFont(updated);
        // Update main list
        setFonts(fonts.map(f => f.id === id ? updated : f));
        
        // Update tags list
        const categories = ['type', 'language', 'style', 'other'];
        const tags = { type: new Set(), language: new Set(), style: new Set(), other: new Set() };
        fonts.map(f => f.id === id ? updated : f).forEach(font => {
          if (font.tags && !Array.isArray(font.tags)) {
            categories.forEach(cat => {
              font.tags[cat]?.forEach(tag => tags[cat].add(tag));
            });
          }
        });
        setAllTags({
          type: Array.from(tags.type),
          language: Array.from(tags.language),
          style: Array.from(tags.style),
          other: Array.from(tags.other)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除這個字體嗎？')) return;
    try {
      const res = await fetch(`/api/fonts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (editingTagsFont?.id === id) setEditingTagsFont(null);
        if (previewImageFont?.id === id) setPreviewImageFont(null);
        fetchFonts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter fonts
  const filteredFonts = activeTag === 'All' 
    ? fonts 
    : fonts.filter(f => {
        if (!f.tags || Array.isArray(f.tags)) return false;
        return Object.values(f.tags).flat().includes(activeTag);
      });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>載入中...</div>;
  }

  return (
    <div className={styles.dashboard}>
      
      {/* Filters */}
      <div className={styles.filters} style={{ flexDirection: 'column', gap: '1rem', paddingBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className={`${styles.filterTag} ${activeTag === 'All' ? styles.active : ''}`}
            onClick={() => setActiveTag('All')}
          >
            全部 All
          </button>
        </div>

        {[{key: 'type', label: '字體類型'}, {key: 'language', label: '語言'}, {key: 'style', label: '風格'}, {key: 'other', label: '其他'}].map(cat => (
          allTags[cat.key]?.length > 0 && (
            <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', minWidth: '80px', fontWeight: '500' }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {allTags[cat.key].map(tag => (
                  <button 
                    key={tag}
                    className={`${styles.filterTag} ${activeTag === tag ? styles.active : ''}`}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Grid */}
      {filteredFonts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '4rem' }}>
          尚無字體，請點擊右上角「新增字體」。
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredFonts.map(font => {
            const displayImage = (theme === 'dark' && font.imagePathDark) ? font.imagePathDark :
                                 (theme === 'light' && font.imagePathLight) ? font.imagePathLight :
                                 font.imagePath;
            return (
            <div key={font.id} className={styles.card}>
              <img 
                src={displayImage} 
                alt={font.name} 
                className={styles.cardImage} 
                onClick={() => setPreviewImageFont(font)} 
                style={{ cursor: 'zoom-in' }} 
              />
              <div className={styles.cardInfo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div className={styles.cardTitle}>{font.name}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button className={styles.btnSecondary} onClick={() => setEditingTagsFont(font)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>編輯標籤</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(font.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>刪除</button>
                  </div>
                </div>
                <div className={styles.cardTags}>
                  {font.tags && !Array.isArray(font.tags) && Object.values(font.tags).flat().map(tag => (
                    <span key={tag} className={styles.tagBadge}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {typeof document !== 'undefined' && previewImageFont && createPortal(
        <div onClick={() => setPreviewImageFont(null)} style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', 
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          <img 
            src={(theme === 'dark' && previewImageFont.imagePathDark) ? previewImageFont.imagePathDark :
                 (theme === 'light' && previewImageFont.imagePathLight) ? previewImageFont.imagePathLight :
                 previewImageFont.imagePath} 
            alt={previewImageFont.name} 
            style={{ maxWidth: 'min(90vw, 800px)', maxHeight: '85vh', width: 'auto', height: 'auto', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', cursor: 'zoom-out' }}
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* Tag Editing Modal */}
      {typeof document !== 'undefined' && editingTagsFont && createPortal(
        <div className={styles.modalOverlay} onClick={() => setEditingTagsFont(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button className={styles.closeBtn} onClick={() => setEditingTagsFont(null)}>&times;</button>
          
          <div className={`glass-panel ${styles.modalContent}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', margin: 'auto', textAlign: 'left' }}>
            <div style={{ padding: '2rem' }}>
              <div className={styles.modalDetails}>
                <div>
                  <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'left' }}>{editingTagsFont.name}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{editingTagsFont.englishName}</p>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>編輯標籤 Tags</h3>
                <div className={styles.tagEditor} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {[{key: 'type', label: '字體類型'}, {key: 'language', label: '語言'}, {key: 'style', label: '風格'}, {key: 'other', label: '其他'}].map(cat => (
                    <div key={cat.key}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{cat.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        {editingTagsFont.tags?.[cat.key]?.map(tag => (
                          <div key={tag} className={styles.filterTag} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {tag}
                            <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveTag(cat.key, tag)}>&times;</span>
                          </div>
                        ))}
                        
                        <form onSubmit={(e) => handleAddTag(e, cat.key)} style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            value={newTagInputs[cat.key]}
                            onChange={e => setNewTagInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                            placeholder={`新增${cat.label}...`}
                            className={styles.tagInput}
                            list={`existing-tags-${cat.key}`}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', width: '120px' }}
                          />
                          <datalist id={`existing-tags-${cat.key}`}>
                            {allTags[cat.key]?.map(tag => (
                              <option key={tag} value={tag} />
                            ))}
                          </datalist>
                          <button type="submit" className={styles.btnSecondary} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>+</button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
