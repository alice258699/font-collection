'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as opentype from 'opentype.js';
import styles from './page.module.css';

const ALL_CATEGORIES = [
  { key: 'type', label: '字體種類' },
  { key: 'language', label: '語言支援' },
  { key: 'style', label: '風格感受' },
  { key: 'other', label: '其他標籤' }
];

export default function AddFontPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [fontFile, setFontFile] = useState(null);
  const [fontUrl, setFontUrl] = useState('');
  const [fontName, setFontName] = useState('');
  const [fontEnglishName, setFontEnglishName] = useState('');
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fontTags, setFontTags] = useState({ type: [], language: [], style: [], other: [] });
  const [allTags, setAllTags] = useState({ type: [], language: [], style: [], other: [] });
  const [newTagInputs, setNewTagInputs] = useState({ type: '', language: '', style: '', other: '' });

  const [tcText, setTcText] = useState('你有檢查那個飯糰嗎？');
  const [bpmfText, setBpmfText] = useState('ㄅㄆㄇㄈˇˋˊ˙');
  const [scText, setScText] = useState('你有检查那个饭团吗？');
  const [jpText, setJpText] = useState('あのおにぎりを確認しましたか？');
  const [enText, setEnText] = useState('Have you checked that rice ball?');
  const [krText, setKrText] = useState('그 주먹밥 확인했어요?');
  const [supportedEmojis, setSupportedEmojis] = useState([]);

  const canvasRef = useRef(null);

  useEffect(() => {
    // Fetch unique tags from Firestore fonts
    const fetchTags = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'fonts'));
        const uniqueTags = { type: new Set(), language: new Set(), style: new Set(), other: new Set() };
        
        querySnapshot.forEach((doc) => {
          const font = doc.data();
          if (font.tags) {
            ALL_CATEGORIES.forEach(({ key }) => {
              if (font.tags[key]) {
                font.tags[key].forEach(tag => uniqueTags[key].add(tag));
              }
            });
          }
        });
        
        setAllTags({
          type: Array.from(uniqueTags.type),
          language: Array.from(uniqueTags.language),
          style: Array.from(uniqueTags.style),
          other: Array.from(uniqueTags.other)
        });
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      }
    };
    fetchTags();
  }, []);

  const handleAddTag = (e, category) => {
    e.preventDefault();
    const newTag = newTagInputs[category].trim();
    if (!newTag) return;

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setFontFile(file);
    setFontUrl(url);

    const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');

    try {
      const arrayBuffer = await file.arrayBuffer();
      
        let fontNameObject = null;
      
      try {
        const font = opentype.parse(arrayBuffer);
        fontNameObject = font.names;
      } catch (err) {
        console.warn('Opentype parse failed, attempting raw parse fallback', err);
        // Raw parser fallback for name table
        try {
          const data = new DataView(arrayBuffer);
          const numTables = data.getUint16(4);
          let nameOffset = 0;
          for (let i = 0; i < numTables; i++) {
            const tag = String.fromCharCode(data.getUint8(12+i*16), data.getUint8(12+i*16+1), data.getUint8(12+i*16+2), data.getUint8(12+i*16+3));
            if (tag === 'name') {
              nameOffset = data.getUint32(12+i*16+8);
              break;
            }
          }
          if (nameOffset) {
            const count = data.getUint16(nameOffset + 2);
            const stringOffset = data.getUint16(nameOffset + 4);
            const rawNames = { fontFamily: {}, fullName: {} };
            for (let i = 0; i < count; i++) {
              const recordOffset = nameOffset + 6 + i * 12;
              const platformID = data.getUint16(recordOffset);
              const languageID = data.getUint16(recordOffset + 4);
              const nameID = data.getUint16(recordOffset + 6);
              const length = data.getUint16(recordOffset + 8);
              const offset = data.getUint16(recordOffset + 10);
              if (nameID !== 1 && nameID !== 4) continue;
              
              let str = '';
              const stringStart = nameOffset + stringOffset + offset;
              if (platformID === 3 || platformID === 0) { // Windows (UTF-16BE) or Unicode
                for (let j = 0; j < length; j += 2) str += String.fromCharCode(data.getUint16(stringStart + j));
              } else if (platformID === 1) { // Mac
                for (let j = 0; j < length; j++) str += String.fromCharCode(data.getUint8(stringStart + j));
              }
              if (str) {
                const key = (nameID === 1) ? 'fontFamily' : 'fullName';
                const langKey = (platformID === 1 && languageID === 2) ? 'zh-TW' : (platformID === 3 && languageID === 1028) ? 'zh-TW' : 'en';
                rawNames[key][langKey] = str;
              }
            }
            fontNameObject = rawNames;
          }
        } catch (fallbackErr) {
          console.error('Fallback parse also failed', fallbackErr);
        }
      }

      if (fontNameObject) {
        const names = fontNameObject;
        
        let engName = nameWithoutExt;
        if (names.preferredFamily?.en) engName = names.preferredFamily.en;
        else if (names.fontFamily?.en) engName = names.fontFamily.en;
        else if (names.fullName?.en) engName = names.fullName.en;
        
        let localName = engName;
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
          if (otherKeys.length > 0) localName = names.fontFamily[otherKeys[0]];
        }
        
        setFontEnglishName(engName);
        setFontName(localName);
        
        try {
          const font = opentype.parse(arrayBuffer);
          const emojisToTest = ['😀', '😍', '🤔', '😂', '😭', '🥺', '🥳', '😎', '🤯', '👻'];
          const supported = emojisToTest.filter(e => font.charToGlyphIndex(e) > 0);
          setSupportedEmojis(supported.length > 0 ? supported : []);
        } catch(e) { setSupportedEmojis([]); }
      } else {
        setFontEnglishName(nameWithoutExt);
        setFontName(nameWithoutExt);
        setSupportedEmojis([]);
      }
    } catch (err) {
      console.error('Failed to parse font:', err);
    }
  };

  useEffect(() => {
    if (!fontUrl) return;

    const fontFace = new FontFace('PreviewFont', `url(${fontUrl})`);
    fontFace.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
      setFontLoaded(true);
    }).catch(console.error);

    return () => {
      // Cleanup fontface on unmount if needed
    };
  }, [fontUrl]);

  useEffect(() => {
    if (fontLoaded) {
      drawCanvas();
    }
  }, [fontLoaded, fontName, fontEnglishName, tcText, scText, jpText, enText, krText, bpmfText, theme, supportedEmojis]);

  const drawCanvas = () => {
    drawCanvasCore(theme === 'light');
  };

  const drawCanvasCore = (isLight) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set high resolution canvas
    const width = 1200;
    const height = 1060;
    canvas.width = width;
    canvas.height = height;

    const bgColor = isLight ? '#f4f4f6' : '#101418';
    const textColor = isLight ? '#1e1e1e' : '#e6edf3';
    const secondaryColor = isLight ? '#666666' : '#8b949e';
    const accentColor = isLight ? '#4f46e5' : '#6366f1';
    const borderColor = isLight ? '#e5e7eb' : '#30363d';

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Setup typography
    const fallback = 'system-ui, -apple-system, sans-serif';
    const previewFont = 'PreviewFont, ' + fallback;
    
    ctx.textAlign = 'center';
    
    // Draw Title
    ctx.fillStyle = textColor;
    ctx.font = `normal 76px ${previewFont}`;
    ctx.fillText(fontName || 'Font Name', width / 2, 180);

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
      const id = Date.now().toString();
      const safeName = fontEnglishName.replace(/[^a-zA-Z0-9]/g, '_');
      
      const lightRef = ref(storage, `previews/${safeName}_light_${id}.png`);
      const darkRef = ref(storage, `previews/${safeName}_dark_${id}.png`);

      await uploadString(lightRef, base64ImageLight, 'data_url');
      const imagePathLight = await getDownloadURL(lightRef);

      await uploadString(darkRef, base64ImageDark, 'data_url');
      const imagePathDark = await getDownloadURL(darkRef);

      const newFont = {
        name: fontName,
        englishName: fontEnglishName,
        imagePathLight,
        imagePathDark,
        tags: fontTags,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'fonts'), newFont);

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
