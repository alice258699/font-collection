'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fontUrl, setFontUrl] = useState('');
  const [fontName, setFontName] = useState('');
  const [fontEnglishName, setFontEnglishName] = useState('');
  const [fontLoaded, setFontLoaded] = useState(false);
  const [previewFontFamily, setPreviewFontFamily] = useState('PreviewFont');
  const [isSaving, setIsSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
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
  const [hasCustomEmojis, setHasCustomEmojis] = useState(false);

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

  const parseFontFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
    let foundEngName = nameWithoutExt;
    let foundLocalName = null;
    let hasCustom = false;
    const defaultEmojis = ['😀', '😍', '🤔', '😂', '😭', '🥺', '🥳', '😎', '🤯', '👻'];
    let finalEmojis = defaultEmojis;
    
    // 1. Raw parser with TextDecoder for robust encoding support
    try {
      const data = new DataView(arrayBuffer);
      let fontOffset = 0;
      const magic = data.getUint32(0);
      
      if (magic === 0x74746366) { // 'ttcf'
        const numFonts = data.getUint32(8);
        if (numFonts > 0) {
          fontOffset = data.getUint32(12);
        }
      }
      
      const numTables = data.getUint16(fontOffset + 4);
      let nameOffset = 0;
      for (let i = 0; i < numTables; i++) {
        const recordOffset = fontOffset + 12 + i * 16;
        const tag = String.fromCharCode(data.getUint8(recordOffset), data.getUint8(recordOffset+1), data.getUint8(recordOffset+2), data.getUint8(recordOffset+3));
        if (tag === 'name') {
          nameOffset = data.getUint32(recordOffset + 8);
          break;
        }
      }
      if (nameOffset) {
        const count = data.getUint16(nameOffset + 2);
        const stringOffset = data.getUint16(nameOffset + 4);
        
        for (let i = 0; i < count; i++) {
          const recordOffset = nameOffset + 6 + i * 12;
          const platformID = data.getUint16(recordOffset);
          const encodingID = data.getUint16(recordOffset + 2);
          const languageID = data.getUint16(recordOffset + 4);
          const nameID = data.getUint16(recordOffset + 6);
          const length = data.getUint16(recordOffset + 8);
          const offset = data.getUint16(recordOffset + 10);
          
          if (nameID !== 1 && nameID !== 4 && nameID !== 16) continue;
          
          const bytes = new Uint8Array(arrayBuffer, nameOffset + stringOffset + offset, length);
          let str = '';
          
          try {
            if (platformID === 3 || platformID === 0) {
              str = new TextDecoder('utf-16be').decode(bytes);
            } else if (platformID === 1) {
              if (encodingID === 2) str = new TextDecoder('big5').decode(bytes);
              else if (encodingID === 1) str = new TextDecoder('shift-jis').decode(bytes);
              else if (encodingID === 25) str = new TextDecoder('gbk').decode(bytes);
              else if (encodingID === 3) str = new TextDecoder('euc-kr').decode(bytes);
              else str = new TextDecoder('macintosh').decode(bytes);
            }
          } catch (e) {
            str = new TextDecoder('utf-8').decode(bytes);
          }
          
          str = str.replace(/\0/g, '').trim();
          if (!str) continue;

          const hasLocalCharacters = (s) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(s);
          
          if (hasLocalCharacters(str)) {
            if (!foundLocalName) foundLocalName = str;
          } else {
            if (str.toLowerCase() !== 'regular' && str.length > 2) {
              if (foundEngName === nameWithoutExt || str.length < foundEngName.length) {
                foundEngName = str;
              }
            }
          }
        }
      }
    } catch (rawErr) {
      console.error('Raw parse failed', rawErr);
    }

    // 2. Fallback to opentype.js if raw parser didn't find anything
    if (!foundLocalName || foundEngName === nameWithoutExt) {
      try {
        const font = opentype.parse(arrayBuffer);
        const names = font.names;
        
        if (names) {
          if (foundEngName === nameWithoutExt) {
            if (names.preferredFamily?.en) foundEngName = names.preferredFamily.en;
            else if (names.fontFamily?.en) foundEngName = names.fontFamily.en;
            else if (names.fullName?.en) foundEngName = names.fullName.en;
          }
          
          if (!foundLocalName) {
            const hasLocalCharacters = (str) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(str);
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
            if (!foundLocalName && names.fontFamily) {
              const otherKeys = Object.keys(names.fontFamily).filter(k => k !== 'en' && !k.includes('mac'));
              if (otherKeys.length > 0) foundLocalName = names.fontFamily[otherKeys[0]];
            }
          }
        }
      } catch(e) {
        console.warn('Opentype parse failed', e);
      }
    }

    // 3. Check emoji support
    try {
      const font = opentype.parse(arrayBuffer);
      let supportedCount = 0;
      for (const emoji of defaultEmojis) {
        const glyphIndex = font.charToGlyphIndex(emoji);
        if (glyphIndex > 0) {
          supportedCount++;
        }
      }
      hasCustom = supportedCount > 0;
    } catch (e) {
      console.warn('Opentype parse failed for emojis', e);
    }

    return {
      localName: foundLocalName || foundEngName,
      engName: foundEngName,
      emojis: defaultEmojis,
      hasCustomEmojis: hasCustom
    };
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(files);
    
    // Always preview the first file
    const file = files[0];
    const url = URL.createObjectURL(file);
    setFontFile(file);
    setFontUrl(url);

    try {
      const { localName, engName, emojis, hasCustomEmojis } = await parseFontFile(file);
      setFontName(localName);
      setFontEnglishName(engName);
      setSupportedEmojis(emojis);
      setHasCustomEmojis(hasCustomEmojis);
    } catch (err) {
      console.error('File read failed', err);
      const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
      setFontName(nameWithoutExt);
      setFontEnglishName(nameWithoutExt);
      setSupportedEmojis(['😀', '😍', '🤔', '😂', '😭', '🥺', '🥳', '😎', '🤯', '👻']);
      setHasCustomEmojis(false);
    }
  };

  useEffect(() => {
    if (!fontUrl) return;

    const uniqueFamily = `PreviewFont_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const fontFace = new FontFace(uniqueFamily, `url(${fontUrl})`);
    fontFace.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
      setPreviewFontFamily(uniqueFamily);
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
  }, [fontLoaded, fontName, fontEnglishName, tcText, scText, jpText, enText, krText, bpmfText, supportedEmojis, theme]);

  const drawCanvas = () => {
    drawCanvasCore(theme === 'light', 1);
  };

  const drawCanvasCore = (isLight, scale = 1, overrideName, overrideEnglishName, overrideFamily, overrideEmojis) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set high resolution canvas
    const width = 1200 * scale;
    const height = 1060 * scale;
    canvas.width = width;
    canvas.height = height;

    ctx.scale(scale, scale);

    const bgColor = isLight ? '#f4f4f6' : '#101418';
    const textColor = isLight ? '#1e1e1e' : '#e6edf3';
    const secondaryColor = isLight ? '#666666' : '#8b949e';
    const accentColor = isLight ? '#4f46e5' : '#6366f1';
    const borderColor = isLight ? '#e5e7eb' : '#30363d';

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1200, 1060); // Use original coordinates since we scaled the context

    // Setup typography
    const fallback = 'system-ui, -apple-system, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    const currentFamily = overrideFamily || previewFontFamily;
    const previewFont = `${currentFamily}, ` + fallback;
    
    ctx.textAlign = 'center';
    
    // Draw Title
    ctx.fillStyle = textColor;
    ctx.font = `normal 76px ${previewFont}`;
    ctx.fillText(overrideName || fontName || 'Font Name', 600, 180);

    // Draw English Name
    ctx.fillStyle = secondaryColor;
    ctx.font = `italic 40px ${previewFont}`;
    ctx.fillText(overrideEnglishName || fontEnglishName || 'Font English Name', 600, 260);

    // Draw line separator
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 340);
    ctx.lineTo(1080, 340);
    ctx.stroke();

    // Draw sentences
    ctx.textAlign = 'left';
    const startX = 120;
    let startY = 430;
    const lineSpacing = 80;

    const currentEmojis = overrideEmojis || supportedEmojis;

    const languages = [
      { label: '繁體中文', text: tcText },
      { label: '注音符號', text: bpmfText },
      { label: '简体中文', text: scText },
      { label: '日本語', text: jpText },
      { label: 'English', text: enText },
      { label: '한국어', text: krText },
      { label: '繪文字', text: currentEmojis.join(' ') }
    ];

    languages.forEach((lang) => {
      // Label
      ctx.fillStyle = accentColor;
      ctx.font = `500 24px ${fallback}`;
      ctx.fillText(lang.label, startX, startY);

      // Text
      ctx.fillStyle = textColor;
      ctx.font = `normal 42px ${previewFont}`;
      
      if (lang.label === '繪文字') {
        let currentX = startX + 160;
        for (const emoji of currentEmojis) {
          ctx.fillText(emoji, currentX, startY);
          let w = ctx.measureText(emoji).width;
          if (w < 10) w = 45; // Force a minimum width to prevent 0-width stacking
          currentX += w + 8;
        }
      } else {
        ctx.fillText(lang.text, startX + 160, startY);
      }
      
      startY += lineSpacing;
    });
  };

  const handleSave = async () => {
    if (selectedFiles.length === 0) {
      alert('請上傳字體！');
      return;
    }

    setIsSaving(true);
    
    try {
      if (selectedFiles.length === 1) {
        // Single File Save
        const canvas = canvasRef.current;
        drawCanvasCore(true, 1);
        const base64ImageLight = canvas.toDataURL('image/webp', 0.6);
        drawCanvasCore(false, 1);
        const base64ImageDark = canvas.toDataURL('image/webp', 0.6);
        drawCanvasCore(theme === 'light', 1);

        const newFont = {
          name: fontName,
          englishName: fontEnglishName,
          imagePathLight: base64ImageLight,
          imagePathDark: base64ImageDark,
          tags: fontTags,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'fonts'), newFont);
      } else {
        // Batch Save
        for (let i = 0; i < selectedFiles.length; i++) {
          setBatchProgress({ current: i + 1, total: selectedFiles.length });
          const file = selectedFiles[i];
          
          let localName = '';
          let engName = '';
          let emojis = [];
          
          try {
            const parsed = await parseFontFile(file);
            localName = parsed.localName;
            engName = parsed.engName;
            emojis = parsed.emojis;
          } catch (e) {
            localName = file.name.split('.').slice(0, -1).join('.');
            engName = localName;
            emojis = ['😀', '😍', '🤔', '😂', '😭', '🥺', '🥳', '😎', '🤯', '👻'];
          }

          const url = URL.createObjectURL(file);
          const uniqueFamily = `BatchFont_${Date.now()}_${Math.floor(Math.random()*1000)}`;
          const fontFace = new FontFace(uniqueFamily, `url(${url})`);
          
          await fontFace.load();
          document.fonts.add(fontFace);
          
          // Draw and save
          const canvas = canvasRef.current;
          
          // Small delay to ensure browser paints/registers the fontface properly in DOM
          await new Promise(resolve => setTimeout(resolve, 50));
          
          drawCanvasCore(true, 1, localName, engName, uniqueFamily, emojis);
          const base64ImageLight = canvas.toDataURL('image/webp', 0.6);
          
          drawCanvasCore(false, 1, localName, engName, uniqueFamily, emojis);
          const base64ImageDark = canvas.toDataURL('image/webp', 0.6);
          
          const newFont = {
            name: localName,
            englishName: engName,
            imagePathLight: base64ImageLight,
            imagePathDark: base64ImageDark,
            tags: fontTags, // Use the globally set tags for all batch fonts!
            createdAt: new Date().toISOString()
          };
          
          await addDoc(collection(db, 'fonts'), newFont);
          
          // Cleanup
          URL.revokeObjectURL(url);
          document.fonts.delete(fontFace);
        }
      }

      router.push('/');
    } catch (err) {
      console.error(err);
      alert('儲存失敗，請重試。');
      setIsSaving(false);
      drawCanvasCore(theme === 'light', 1); // restore if it failed
    }
  };

  return (
    <div className={styles.generatorContainer}>
      <div className={`glass-panel ${styles.controls}`}>
        <h2 style={{ marginBottom: '1.5rem', color: '#e6edf3' }}>設定預覽參數</h2>
        
        <div className="form-group">
          <label>上傳字體檔案 (可多選批量匯入)</label>
          <input 
            type="file" 
            accept=".ttf,.otf,.woff,.woff2,.ttc" 
            multiple
            onChange={handleFileChange} 
            className="form-control"
            style={{ padding: '0.5rem' }}
          />
        </div>
        
        {selectedFiles.length > 1 && (
          <div style={{ padding: '1rem', background: 'rgba(10, 132, 255, 0.1)', border: '1px solid var(--accent-blue)', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '0.5rem' }}>批量匯入模式</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              您已選擇 {selectedFiles.length} 個字體檔案。系統將會自動提取所有字體名稱，並使用下方的「預覽句」與「標籤」套用至所有選擇的字體，一鍵完成處理！
            </p>
          </div>
        )}

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
            disabled={selectedFiles.length === 0 || (!fontLoaded && selectedFiles.length === 1) || isSaving}
            style={{ width: '100%' }}
          >
            {isSaving ? (selectedFiles.length > 1 ? `批量匯入中... (${batchProgress.current}/${batchProgress.total})` : '儲存中...') : (selectedFiles.length > 1 ? `批量匯出 ${selectedFiles.length} 個字體` : '匯出至字體大全')}
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

        <div style={{ width: '100%', textAlign: 'left', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '600' }}>標籤設定 (選填)</h3>
          {ALL_CATEGORIES.map(({ key: cat, label }) => (
            <div key={cat} style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{label}</label>
              
              <div className={styles.tagEditor} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <form onSubmit={(e) => handleAddTag(e, cat)} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newTagInputs[cat] || ''}
                    onChange={(e) => setNewTagInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                    placeholder={`自訂${label}...`}
                    className={styles.tagInput}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', width: '120px' }}
                  />
                  <button type="submit" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>+</button>
                </form>

                {fontTags[cat]?.map(tag => (
                  <div key={tag} className={styles.filterTag} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)' }}>
                    {tag}
                    <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveTag(cat, tag)}>&times;</span>
                  </div>
                ))}

                {allTags[cat]?.filter(t => !fontTags[cat]?.includes(t)).map(tag => (
                  <button 
                    key={tag} 
                    type="button"
                    className={styles.filterTag} 
                    onClick={() => {
                      setFontTags(prev => ({
                        ...prev,
                        [cat]: [...(prev[cat] || []), tag]
                      }));
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
  );
}
