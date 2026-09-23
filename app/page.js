'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './page.module.css';
import { useTheme } from '@/components/ThemeProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';

export default function Home() {
  const { theme } = useTheme();
  const [fonts, setFonts] = useState([]);
  const [filteredFonts, setFilteredFonts] = useState([]);
  const [activeTag, setActiveTag] = useState('All');
  const [allTags, setAllTags] = useState({ type: [], language: [], style: [], other: [] });
  
  const [previewImageFont, setPreviewImageFont] = useState(null);
  const [editingTagsFont, setEditingTagsFont] = useState(null);
  const [newTagInputs, setNewTagInputs] = useState({ type: '', language: '', style: '', other: '' });

  const fetchFonts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'fonts'));
      const fontsData = [];
      const uniqueTags = { type: new Set(), language: new Set(), style: new Set(), other: new Set() };
      
      querySnapshot.forEach((docSnap) => {
        const font = { id: docSnap.id, ...docSnap.data() };
        fontsData.push(font);
        
        if (font.tags) {
          ['type', 'language', 'style', 'other'].forEach((key) => {
            if (font.tags[key]) {
              font.tags[key].forEach(tag => uniqueTags[key].add(tag));
            }
          });
        }
      });
      
      // Sort fonts by createdAt descending
      fontsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setFonts(fontsData);
      setFilteredFonts(fontsData);
      setAllTags({
        type: Array.from(uniqueTags.type),
        language: Array.from(uniqueTags.language),
        style: Array.from(uniqueTags.style),
        other: Array.from(uniqueTags.other)
      });
    } catch (err) {
      console.error('Error fetching fonts from Firebase:', err);
    }
  };

  useEffect(() => {
    fetchFonts();
  }, []);

  useEffect(() => {
    if (activeTag === 'All') {
      setFilteredFonts(fonts);
    } else {
      setFilteredFonts(fonts.filter(f => {
        if (!f.tags) return false;
        return Object.values(f.tags).flat().includes(activeTag);
      }));
    }
  }, [activeTag, fonts]);

  const handleDelete = async (id) => {
    if (confirm('確定要刪除這個字體嗎？')) {
      try {
        await deleteDoc(doc(db, 'fonts', id));
        fetchFonts();
      } catch (err) {
        console.error('Failed to delete', err);
      }
    }
  };

  const handleRemoveTag = async (category, tagToRemove) => {
    if (!editingTagsFont) return;
    
    const newTags = {
      ...editingTagsFont.tags,
      [category]: editingTagsFont.tags[category].filter(t => t !== tagToRemove)
    };
    
    setEditingTagsFont(prev => ({ ...prev, tags: newTags }));
    
    try {
      await updateDoc(doc(db, 'fonts', editingTagsFont.id), { tags: newTags });
      fetchFonts();
    } catch (err) {
      console.error('Failed to update tags', err);
    }
  };

  const handleAddTag = async (e, category) => {
    e.preventDefault();
    const newTag = newTagInputs[category]?.trim();
    if (!newTag || !editingTagsFont) return;

    const currentCatTags = editingTagsFont.tags?.[category] || [];
    if (currentCatTags.includes(newTag)) {
      setNewTagInputs(prev => ({ ...prev, [category]: '' }));
      return;
    }

    const newTags = {
      ...editingTagsFont.tags,
      [category]: [...currentCatTags, newTag]
    };

    setEditingTagsFont(prev => ({ ...prev, tags: newTags }));
    setNewTagInputs(prev => ({ ...prev, [category]: '' }));
    
    try {
      await updateDoc(doc(db, 'fonts', editingTagsFont.id), { tags: newTags });
      fetchFonts();
    } catch (err) {
      console.error('Failed to update tags', err);
    }
  };

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
                                 font.imagePathLight || font.imagePathDark; // Default
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
                 previewImageFont.imagePathLight || previewImageFont.imagePathDark} 
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
                            value={newTagInputs[cat.key] || ''}
                            onChange={e => setNewTagInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                            placeholder={`新增${cat.label}...`}
                            className={styles.tagInput}
                            list={`existing-tags-${cat.key}`}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', width: '120px' }}
                          />
                          <datalist id={`existing-tags-${cat.key}`}>
                            {allTags[cat.key]?.filter(t => !editingTagsFont.tags?.[cat.key]?.includes(t)).map(tag => (
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
