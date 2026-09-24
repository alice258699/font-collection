'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './page.module.css';
import { useTheme } from '@/components/ThemeProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';

function FontFamilyCard({ familyName, fonts, theme, setPreviewImageFont, setEditingTagsFont, handleDelete }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeFont = fonts[activeIdx] || fonts[0];

  if (!activeFont) return null;

  const displayImage = (theme === 'dark' && activeFont.imagePathDark) ? activeFont.imagePathDark :
                       (theme === 'light' && activeFont.imagePathLight) ? activeFont.imagePathLight :
                       activeFont.imagePathLight || activeFont.imagePathDark;

  return (
    <div className={styles.card}>
      <img 
        src={displayImage} 
        alt={activeFont.name} 
        className={styles.cardImage} 
        onClick={() => setPreviewImageFont(activeFont)} 
        style={{ cursor: 'zoom-in' }} 
      />
      <div className={styles.cardInfo}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>{familyName}</div>
          <div className={styles.cardActions}>
            <button className={styles.btnSecondary} onClick={() => setEditingTagsFont(activeFont)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>編輯標籤</button>
            <button className={styles.deleteBtn} onClick={() => handleDelete(activeFont.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>刪除</button>
          </div>
        </div>

        {fonts.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {fonts.map((f, idx) => (
              <button 
                key={f.id} 
                onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
                className={`${styles.weightBtn} ${activeIdx === idx ? styles.activeWeight : ''}`}
              >
                {f.parsedWeight}
              </button>
            ))}
          </div>
        )}

        <div className={styles.cardTags}>
          {activeFont.tags && !Array.isArray(activeFont.tags) && Object.values(activeFont.tags).flat().map(tag => (
            <span key={tag} className={styles.tagBadge}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { theme } = useTheme();
  const [fonts, setFonts] = useState([]);
  const [filteredFonts, setFilteredFonts] = useState([]);
  const [activeTags, setActiveTags] = useState([]);
  const [allTags, setAllTags] = useState({ type: [], language: [], style: [], other: [] });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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
    if (activeTags.length === 0) {
      setFilteredFonts(fonts);
    } else {
      setFilteredFonts(fonts.filter(f => {
        if (!f.tags) return false;
        const fontTagsFlat = Object.values(f.tags).flat();
        return activeTags.every(tag => fontTagsFlat.includes(tag));
      }));
    }
  }, [activeTags, fonts]);

  const toggleTag = (tag) => {
    if (tag === 'All') {
      setActiveTags([]);
    } else {
      setActiveTags(prev => 
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      );
    }
  };

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

  const extractFamilyAndWeight = (name) => {
    if (!name) return { family: 'Unknown Font', weight: 'Regular' };
    const weightKeywords = ['thin', 'hairline', 'extralight', 'ultralight', 'light', 'regular', 'normal', 'medium', 'semibold', 'demibold', 'bold', 'extrabold', 'ultrabold', 'black', 'heavy', 'extrablack', 'ultrablack', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', '一分糖', '微糖', '半糖', '七分糖', '九分糖'];
    
    let parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (weightKeywords.some(w => lastPart.toLowerCase().includes(w))) {
        return {
          family: parts.slice(0, -1).join(' '),
          weight: lastPart
        };
      }
    }
    
    for (const w of weightKeywords) {
      if (name.toLowerCase().endsWith(w.toLowerCase())) {
        const family = name.slice(0, -w.length).trim() || name;
        const weight = name.slice(-w.length);
        if (family !== name) return { family, weight };
      }
    }
    
    return { family: name, weight: 'Regular' };
  };

  const groupedFonts = [];
  const familyMap = {};
  filteredFonts.forEach(font => {
    const { family, weight } = extractFamilyAndWeight(font.name);
    if (!familyMap[family]) {
      familyMap[family] = [];
      groupedFonts.push({ family, fonts: familyMap[family] });
    }
    familyMap[family].push({ ...font, parsedWeight: weight });
  });

  return (
    <div className={styles.dashboard}>
      
      <button 
        className={`btn btn-secondary ${styles.mobileFilterBtn}`} 
        onClick={() => setIsSidebarOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px'}}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        篩選標籤 Filters
      </button>

      <div 
        className={`${styles.mobileOverlay} ${isSidebarOpen ? styles.open : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar Filters */}
      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>篩選 Filters</h3>
          {isSidebarOpen && (
             <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>&times;</button>
          )}
        </div>
        <div className={styles.filters}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className={`${styles.filterTag} ${activeTags.length === 0 ? styles.active : ''}`}
              onClick={() => toggleTag('All')}
            >
              全部 All
            </button>
          </div>

          {[{key: 'type', label: '字體類型'}, {key: 'language', label: '語言'}, {key: 'style', label: '風格'}, {key: 'other', label: '其他'}].map(cat => (
            allTags[cat.key]?.length > 0 && (
              <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  {cat.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {allTags[cat.key].map(tag => (
                    <button 
                      key={tag}
                      className={`${styles.filterTag} ${activeTags.includes(tag) ? styles.active : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={styles.mainContent}>
      {groupedFonts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '4rem' }}>
          尚無字體，請點擊右上角「新增字體」。
        </div>
      ) : (
        <div className={styles.grid}>
          {groupedFonts.map(group => (
            <FontFamilyCard 
              key={group.family}
              familyName={group.family}
              fonts={group.fonts}
              theme={theme}
              setPreviewImageFont={setPreviewImageFont}
              setEditingTagsFont={setEditingTagsFont}
              handleDelete={handleDelete}
            />
          ))}
        </div>
      )}
      </div>

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
                <div className={styles.tagEditor} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-start' }}>
                  {[{key: 'type', label: '字體類型'}, {key: 'language', label: '語言'}, {key: 'style', label: '風格'}, {key: 'other', label: '其他'}].map(cat => (
                    <div key={cat.key} style={{ width: '100%' }}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{cat.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        
                        <form onSubmit={(e) => handleAddTag(e, cat.key)} style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            value={newTagInputs[cat.key] || ''}
                            onChange={e => setNewTagInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                            placeholder={`自訂${cat.label}...`}
                            className={styles.tagInput}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', width: '120px' }}
                          />
                          <button type="submit" className={styles.btnSecondary} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>+</button>
                        </form>

                        {editingTagsFont.tags?.[cat.key]?.map(tag => (
                          <div key={tag} className={styles.filterTag} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)' }}>
                            {tag}
                            <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveTag(cat.key, tag)}>&times;</span>
                          </div>
                        ))}

                        {allTags[cat.key]?.filter(t => !editingTagsFont.tags?.[cat.key]?.includes(t)).map(tag => (
                          <button 
                            key={tag} 
                            className={styles.filterTag} 
                            onClick={(e) => {
                              e.preventDefault();
                              const newTags = {
                                ...editingTagsFont.tags,
                                [cat.key]: [...(editingTagsFont.tags?.[cat.key] || []), tag]
                              };
                              setEditingTagsFont(prev => ({ ...prev, tags: newTags }));
                              updateDoc(doc(db, 'fonts', editingTagsFont.id), { tags: newTags }).then(() => fetchFonts());
                            }}
                            style={{ opacity: 0.7 }}
                          >
                            + {tag}
                          </button>
                        ))}
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
