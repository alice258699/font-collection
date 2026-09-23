"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import styles from './page.module.css';

const ALL_CATEGORIES = [
  { key: 'type', label: '字體類型' },
  { key: 'language', label: '語言' },
  { key: 'style', label: '風格' },
  { key: 'other', label: '其他' }
];

export default function AddFontPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const canvasRef = useRef(null);
  const [fontFile, setFontFile] = useState(null);
  const [fontName, setFontName] = useState('');
  const [fontEnglishName, setFontEnglishName] = useState('');
  
  const [tcText, setTcText] = useState('你有檢查那個飯糰嗎？');
  const [bpmfText, setBpmfText] = useState('ㄅㄆㄇㄈˇˋˊ˙');
  const [scText, setScText] = useState('你有检查那个饭团吗？');
  const [jpText, setJpText] = useState('あのおにぎりを確認しましたか？');
  const [enText, setEnText] = useState('Have you checked that rice ball?');
  const [krText, setKrText] = useState('그 주먹밥 확인했어요?');
  
  const [isSaving, setIsSaving] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [previewFontFamily, setPreviewFontFamily] = useState('CustomPreviewFont');
  const [supportedEmojis, setSupportedEmojis] = useState([]);

  // Tags state
  const [fontTags, setFontTags] = useState({ type: [], language: [], style: [], other: [] });
  const [allTags, setAllTags] = useState({ type: [], language: [], style: [], other: [] });
  const [newTagInputs, setNewTagInputs] = useState({ type: '', language: '', style: '', other: '' });

  useEffect(() => {
    fetch('/api/tags').then(res => res.json()).then(data => {
      setAllTags(data);
    }).catch(console.error);
  }, []);

  const handleAddTag = (e, category) => {
    e.preventDefault();
    const input = newTagInputs[category];
    if (!input.trim()) return;
    
    const newTag = input.trim();
    if (fontTags[category]?.includes(newTag)) {
      setNewTagInputs(prev => ({ ...prev, [category]: '' }));
      return;
    }

    setFontTags(prev => ({
      ...prev,
      [category]: [...(prev[category] || []), newTag]
    }));
    setNewTagInputs(prev => ({ ...prev, [category]: '' }));
  };

  const handleRemoveTag = (category, tagToRemove) => {
    setFontTags(prev => ({
      ...prev,
      [category]: prev[category].filter(t => t !== tagToRemove)
    }));
  };

  // Handle file upload and load font
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFontFile(file);
    
    const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Use fontkit on the server via our API route
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const parseRes = await fetch('/api/parse', {
          method: 'POST',
          body: formData
        });
        
        if (parseRes.ok) {
          const names = await parseRes.json();
          
          let engName = nameWithoutExt;
          
          // Try to get English name
          if (names.preferredFamily?.en) {
            engName = names.preferredFamily.en;
          } else if (names.fontFamily?.en) {
            engName = names.fontFamily.en;
          } else if (names.fullName?.en) {
            engName = names.fullName.en;
          }
          
          let localName = engName;
          
          // Helper to check for CJK, Hiragana, Katakana, or Hangul characters
          const hasLocalCharacters = (str) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(str);
          let foundLocalName = null;
          
          const fieldsToCheck = ['fontFamily', 'preferredFamily', 'fullName'];
          
          for (const field of fieldsToCheck) {
            if (names[field]) {
              const values = Object.values(names[field]);
              const localVal = values.find(v => typeof v === 'string' && hasLocalCharacters(v));
              if (localVal) {
                foundLocalName = localVal;
                break;
              }
            }
          }
          
          if (foundLocalName) {
            localName = foundLocalName;
          } else if (names.fontFamily) {
            const otherKeys = Object.keys(names.fontFamily).filter(k => k !== 'en' && !k.includes('mac'));
            if (otherKeys.length > 0) {
              localName = names.fontFamily[otherKeys[0]];
            }
          }
          
          console.log('Extracted Font Names Metadata (Fontkit):', names);
          setFontEnglishName(engName);
          setFontName(localName);
          if (names.supportedEmojis && names.supportedEmojis.length > 0) {
            setSupportedEmojis(names.supportedEmojis);
          } else {
            setSupportedEmojis([]);
          }
        } else {
          console.warn('API parse failed, fallback to filename');
          setFontEnglishName(nameWithoutExt);
          setFontName(nameWithoutExt);
          setSupportedEmojis([]);
        }
      } catch (parseErr) {
        console.warn('Failed to parse font metadata via API:', parseErr);
        setFontEnglishName(nameWithoutExt);
        setFontName(nameWithoutExt);
      }

      const uniqueFontFamily = `PreviewFont_${Date.now()}`;
      const customFont = new FontFace(uniqueFontFamily, arrayBuffer);
      const loadedFont = await customFont.load();
      
      // Remove any previously loaded preview fonts to prevent fallback stacking
      document.fonts.forEach(f => {
        if (f.family.startsWith('PreviewFont_') || f.family === 'CustomPreviewFont') {
          document.fonts.delete(f);
        }
      });
      
      document.fonts.add(loadedFont);
      setPreviewFontFamily(uniqueFontFamily);
      setFontLoaded(true);
    } catch (err) {
      console.error('Failed to load font:', err);
      alert('字體載入失敗，請確認檔案格式是否正確 (.ttf, .otf, .woff)。');
    }
  };

  // Draw on canvas whenever inputs, font, or theme change
  useEffect(() => {
    drawCanvas();
  }, [fontName, fontEnglishName, tcText, scText, jpText, enText, krText, fontLoaded, theme, supportedEmojis]);

  const drawCanvas = () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    drawCanvasCore(isLight);
  };

  const drawCanvasCore = (isLight) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set high resolution for Retina displays
    const width = 1200;
    const height = 1060; // increased height for emoji & bopomofo rows
    canvas.width = width;
    canvas.height = height;

    // Dynamic Colors based on theme
    const bgColor = isLight ? '#f0f0f3' : '#0f1016';
    const textColor = isLight ? '#1d1d1f' : '#ffffff';
    const accentColor = isLight ? '#5e5ce6' : '#4d4bf5';
    const secondaryColor = isLight ? '#515154' : '#8b949e';
    const borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle background gradient/glow
    const gradient = ctx.createRadialGradient(width * 0.15, height * 0.5, 0, width * 0.15, height * 0.5, width * 0.6);
    gradient.addColorStop(0, isLight ? 'rgba(94, 92, 230, 0.15)' : 'rgba(77, 75, 245, 0.15)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Text defaults
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Fallback font stack (黑體 Sans-serif for missing characters)
    const fallback = '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
    const previewFont = fontLoaded ? `"${previewFontFamily}", ${fallback}` : fallback;

    // Draw Font Name (Title)
    ctx.fillStyle = textColor;
    ctx.font = `normal 80px ${previewFont}`;
    ctx.fillText(fontName || '字體名稱 Font Name', width / 2, 180);

    // Draw English Name
    ctx.fillStyle = secondaryColor;
    ctx.font = `italic 40px ${previewFont}`;
    ctx.fillText(fontEnglishName || 'Font English Name', width / 2, 260);

    // Draw line separator
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, 340);
    ctx.lineTo(width * 0.9, 340);
    ctx.stroke();

    // Draw sentences
    ctx.textAlign = 'left';
    const startX = 120;
    let startY = 430;
    const lineSpacing = 80;

    const languages = [
      { label: '繁體中文', text: tcText },
      { label: '注音符號', text: bpmfText },
      { label: '简体中文', text: scText },
      { label: '日本語', text: jpText },
      { label: 'English', text: enText },
      { label: '한국어', text: krText },
      { label: '繪文字', text: supportedEmojis.length > 0 ? supportedEmojis.join(' ') : '😀 😍 🤔 😂 😭 🥺 🥳 😎 🤯 👻' },
    ];

    languages.forEach((lang) => {
      // Label
      ctx.fillStyle = accentColor;
      ctx.font = `500 24px ${fallback}`;
      ctx.fillText(lang.label, startX, startY);

      // Text
      ctx.fillStyle = textColor;
      ctx.font = `normal 42px ${previewFont}`;
      ctx.fillText(lang.text, startX + 160, startY);
      
      startY += lineSpacing;
    });
  };

  const handleSave = async () => {
    if (!fontFile || !fontName || !fontEnglishName) {
      alert('請上傳字體並填寫字體名稱！');
      return;
    }

    setIsSaving(true);
    
    const canvas = canvasRef.current;
    
    // Generate Light image
    drawCanvasCore(true);
    const base64ImageLight = canvas.toDataURL('image/png');
    
    // Generate Dark image
    drawCanvasCore(false);
    const base64ImageDark = canvas.toDataURL('image/png');
    
    // Restore current theme preview
    drawCanvas();

    try {
      const res = await fetch('/api/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fontName,
          fontEnglishName,
          base64ImageLight,
          base64ImageDark,
          defaultTags: fontTags
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      // Redirect to home
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('儲存失敗，請重試。');
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.generatorContainer}>
      <div className={`glass-panel ${styles.controls}`}>
        <h2 style={{ marginBottom: '1.5rem', color: '#e6edf3' }}>設定預覽參數</h2>
        
        <div className="form-group">
          <label>上傳字體檔案 (.ttf, .otf, .woff)</label>
          <input 
            type="file" 
            accept=".ttf,.otf,.woff,.woff2" 
            onChange={handleFileChange} 
            className="form-control"
            style={{ padding: '0.5rem' }}
          />
        </div>

        <div className="form-group">
          <label>字體名稱 (例如: 淚體)</label>
          <input 
            type="text" 
            value={fontName} 
            onChange={(e) => setFontName(e.target.value)} 
            className="form-control"
            placeholder="請輸入字體名稱"
          />
        </div>

        <div className="form-group">
          <label>字體英文名稱 (例如: tearfont)</label>
          <input 
            type="text" 
            value={fontEnglishName} 
            onChange={(e) => setFontEnglishName(e.target.value)} 
            className="form-control"
            placeholder="請輸入英文名稱"
          />
        </div>

        <hr style={{ borderColor: 'var(--glass-border)', margin: '2rem 0' }} />

        <div className="form-group">
          <label>繁體中文預覽句</label>
          <input type="text" value={tcText} onChange={(e) => setTcText(e.target.value)} className="form-control" />
        </div>
        <div className="form-group">
          <label>簡體中文預覽句</label>
          <input type="text" value={scText} onChange={(e) => setScText(e.target.value)} className="form-control" />
        </div>
        <div className="form-group">
          <label>日文預覽句</label>
          <input type="text" value={jpText} onChange={(e) => setJpText(e.target.value)} className="form-control" />
        </div>
        <div className="form-group">
          <label>英文預覽句</label>
          <input type="text" value={enText} onChange={(e) => setEnText(e.target.value)} className="form-control" />
        </div>
        <div className="form-group">
          <label>韓文預覽句</label>
          <input type="text" value={krText} onChange={(e) => setKrText(e.target.value)} className="form-control" />
        </div>

        <div className={styles.actionRow}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!fontLoaded || isSaving}
            style={{ width: '100%' }}
          >
            {isSaving ? '儲存中...' : '匯出至字體大全'}
          </button>
        </div>
      </div>

      <div className={`glass-panel ${styles.previewArea}`}>
        <div className={styles.canvasWrapper}>
          <canvas ref={canvasRef} className={styles.canvasElement}></canvas>
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          上傳字體後，會即時顯示上方圖片預覽。確認無誤後點擊「匯出至字體大全」。
        </p>

        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '600' }}>標籤設定 (選填)</h3>
          {ALL_CATEGORIES.map(({ key: cat, label }) => (
            <div key={cat} style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{label}</label>
              
              <div className={styles.tagEditor}>
                {fontTags[cat]?.map(tag => (
                  <span key={tag} className={styles.tagBadge}>
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(cat, tag)}
                      style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: '6px', cursor: 'pointer', opacity: 0.7 }}
                    >&times;</button>
                  </span>
                ))}
                
                <form onSubmit={(e) => handleAddTag(e, cat)} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newTagInputs[cat] || ''}
                    onChange={(e) => setNewTagInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                    placeholder="輸入新標籤..."
                    className={styles.tagInput}
                    list={`suggestions-${cat}`}
                  />
                  <datalist id={`suggestions-${cat}`}>
                    {allTags[cat]?.filter(t => !fontTags[cat]?.includes(t)).map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                  <button type="submit" className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }}>新增</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
