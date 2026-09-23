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
        
        let foundEngName = nameWithoutExt;
        let foundLocalName = null;
        
        // 1. Raw parser with TextDecoder for robust encoding support
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
                  // Windows / Unicode is always UTF-16BE
                  str = new TextDecoder('utf-16be').decode(bytes);
                } else if (platformID === 1) {
                  // Mac encodings
                  if (encodingID === 2) str = new TextDecoder('big5').decode(bytes);
                  else if (encodingID === 1) str = new TextDecoder('shift-jis').decode(bytes);
                  else if (encodingID === 25) str = new TextDecoder('gbk').decode(bytes);
                  else if (encodingID === 3) str = new TextDecoder('euc-kr').decode(bytes);
                  else str = new TextDecoder('macintosh').decode(bytes);
                }
              } catch (e) {
                // If specific decoder fails, fallback to utf-8 just in case
                str = new TextDecoder('utf-8').decode(bytes);
              }
              
              // Clean up string
              str = str.replace(/\0/g, '').trim();
              
              if (!str) continue;

              const hasLocalCharacters = (s) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(s);
              
              if (hasLocalCharacters(str)) {
                if (!foundLocalName) foundLocalName = str;
              } else {
                // Keep the shortest english name that isn't just "Regular"
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

        // ... opentype fallback handles foundEngName, foundLocalName ...
        setFontEnglishName(foundEngName);
        setFontName(foundLocalName || foundEngName);
        
        // 3. Raw cmap parser to extract up to 10 emojis
        let extractedEmojis = [];
        try {
          const data = new DataView(arrayBuffer);
          let cmapOffset = 0;
          for (let i = 0; i < data.getUint16(4); i++) {
            const tag = String.fromCharCode(data.getUint8(12+i*16), data.getUint8(12+i*16+1), data.getUint8(12+i*16+2), data.getUint8(12+i*16+3));
            if (tag === 'cmap') { cmapOffset = data.getUint32(12+i*16+8); break; }
          }
          
          if (cmapOffset) {
            let format12Offset = 0, format4Offset = 0;
            const numRecords = data.getUint16(cmapOffset + 2);
            for (let i = 0; i < numRecords; i++) {
              const subtableOffset = cmapOffset + data.getUint32(cmapOffset + 4 + i * 8 + 4);
              const format = data.getUint16(subtableOffset);
              if (format === 12) format12Offset = subtableOffset;
              if (format === 4) format4Offset = subtableOffset;
            }

            const emojiRanges = [
              [0x1F600, 0x1F64F], // Emoticons (Faces)
              [0x1F900, 0x1F9FF], // Supplemental Faces/Symbols
              [0x1F300, 0x1F5FF], // Misc Symbols and Pictographs
              [0x1F680, 0x1F6FF], // Transport and Map
              [0x1FA70, 0x1FAFF]  // Symbols and Pictographs Extended-A
            ];
            const foundEmojis = new Set();

            const checkRange = (startChar, endChar) => {
              for (const [eStart, eEnd] of emojiRanges) {
                const overlapStart = Math.max(startChar, eStart);
                const overlapEnd = Math.min(endChar, eEnd);
                for (let c = overlapStart; c <= overlapEnd; c++) {
                  foundEmojis.add(String.fromCodePoint(c));
                }
              }
            };

            if (format12Offset) {
              const numGroups = data.getUint32(format12Offset + 12);
              for (let i = 0; i < numGroups; i++) {
                const groupOffset = format12Offset + 16 + i * 12;
                checkRange(data.getUint32(groupOffset), data.getUint32(groupOffset + 4));
              }
            }

            // We skip format 4 entirely because standard emojis are in Format 12 (BMP supplementary planes)
            // and checking Format 4 often catches generic text symbols like stars or shapes.

            let allEmojis = Array.from(foundEmojis);
            
            // Prioritize faces (0x1F600 - 0x1F64F) so they show up first
            allEmojis.sort((a, b) => {
              const codeA = a.codePointAt(0);
              const codeB = b.codePointAt(0);
              const isFaceA = (codeA >= 0x1F600 && codeA <= 0x1F64F) ? 1 : 0;
              const isFaceB = (codeB >= 0x1F600 && codeB <= 0x1F64F) ? 1 : 0;
              if (isFaceA !== isFaceB) return isFaceB - isFaceA;
              return codeA - codeB;
            });
            
            extractedEmojis = allEmojis.slice(0, 10);
          }
        } catch (cmapErr) { console.error('Raw cmap parse failed', cmapErr); }

        if (extractedEmojis.length > 0) {
          setSupportedEmojis(extractedEmojis);
        } else {
          setSupportedEmojis(['😀', '😍', '🤔', '😂', '😭', '🥺', '🥳', '😎', '🤯', '👻']);
        }
        
      } catch (err) {
        console.error('File read failed', err);
        setFontEnglishName(nameWithoutExt);
        setFontName(nameWithoutExt);
        setSupportedEmojis(['😀', '😍', '🤔', '😂', '😭', '🥺', '🥳', '😎', '🤯', '👻']);
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
  }, [fontLoaded, fontName, fontEnglishName, tcText, scText, jpText, enText, krText, bpmfText, supportedEmojis, theme]);

  const drawCanvas = () => {
    drawCanvasCore(theme === 'light', 1);
  };

  const drawCanvasCore = (isLight, scale = 1) => {
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
    const fallback = 'system-ui, -apple-system, sans-serif';
    const previewFont = 'PreviewFont, ' + fallback;
    
    ctx.textAlign = 'center';
    
    // Draw Title
    ctx.fillStyle = textColor;
    ctx.font = `normal 76px ${previewFont}`;
    ctx.fillText(fontName || 'Font Name', 600, 180);

    // Draw English Name
    ctx.fillStyle = secondaryColor;
    ctx.font = `italic 40px ${previewFont}`;
    ctx.fillText(fontEnglishName || 'Font English Name', 600, 260);

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

    const languages = [
      { label: '繁體中文', text: tcText },
      { label: '注音符號', text: bpmfText },
      { label: '简体中文', text: scText },
      { label: '日本語', text: jpText },
      { label: 'English', text: enText },
      { label: '한국어', text: krText },
      { label: '繪文字', text: supportedEmojis.join(' ') }
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
    
    try {
      const canvas = canvasRef.current;
      
      // Generate Light image (Use full resolution WebP for sharp text, small file size)
      drawCanvasCore(true, 1);
      const base64ImageLight = canvas.toDataURL('image/webp', 0.6);
      
      // Generate Dark image (Use full resolution WebP for sharp text, small file size)
      drawCanvasCore(false, 1);
      const base64ImageDark = canvas.toDataURL('image/webp', 0.6);
      
      // Restore current theme preview at full resolution
      drawCanvasCore(theme === 'light', 1);

      // Because Firebase Storage now requires a Blaze (paid) plan, 
      // we bypass it entirely by storing the compressed Base64 JPEG directly into Firestore!
      // Firestore has a 1MB limit per document. At 0.5 scale and 0.5 jpeg quality,
      // the images are ~30KB each, easily fitting in the 1MB limit.
      const newFont = {
        name: fontName,
        englishName: fontEnglishName,
        imagePathLight: base64ImageLight,
        imagePathDark: base64ImageDark,
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
      drawCanvasCore(theme === 'light', 1); // restore if it failed
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
