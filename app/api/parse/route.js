import { NextResponse } from 'next/server';
import * as fontkit from 'fontkit';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Parse font with fontkit
    const font = fontkit.create(buffer);
    
    // Extract names from fontkit records
    // fontkit usually decodes name.records into string objects
    const records = font.name.records;
    
    // Convert buffers/objects to strings for our JSON response
    const safeRecords = {};
    const fields = ['fontFamily', 'preferredFamily', 'fullName'];
    
    for (const field of fields) {
      if (records[field]) {
        safeRecords[field] = {};
        // records[field] is usually an object where keys are languages and values are string-like objects
        for (const [lang, val] of Object.entries(records[field])) {
           safeRecords[field][lang] = val.toString();
        }
      }
    }

    // Detect Emojis
    const supportedEmojis = [];
    const seenGlyphIds = new Set();
    
    if (font.characterSet) {
      for (const cp of font.characterSet) {
        // Basic Emoji ranges
        if (
          (cp >= 0x1F300 && cp <= 0x1F5FF) || // Misc Symbols and Pictographs
          (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
          (cp >= 0x1F680 && cp <= 0x1F6FF) || // Transport and Map
          (cp >= 0x1F900 && cp <= 0x1F9FF) || // Supplemental Symbols and Pictographs
          (cp >= 0x1FA70 && cp <= 0x1FAFF)    // Symbols and Pictographs Extended-A
        ) {
          const glyph = font.glyphForCodePoint(cp);
          // Only add if we haven't seen this visual glyph yet
          if (glyph && glyph.id !== undefined && !seenGlyphIds.has(glyph.id)) {
            seenGlyphIds.add(glyph.id);
            supportedEmojis.push(String.fromCodePoint(cp));
            if (supportedEmojis.length >= 10) break;
          }
        }
      }
    }
    
    safeRecords.supportedEmojis = supportedEmojis;

    return NextResponse.json(safeRecords);
  } catch (err) {
    console.error('Fontkit parse error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
