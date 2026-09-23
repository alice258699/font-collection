import { NextResponse } from 'next/server';
import { getFonts, addFont } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const fonts = await getFonts();
    return NextResponse.json(fonts);
  } catch (error) {
    console.error('Error fetching fonts:', error);
    return NextResponse.json({ error: 'Failed to fetch fonts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { 
      fontName, 
      fontEnglishName, 
      base64ImageLight, 
      base64ImageDark, 
      defaultTags = { type: [], language: [], style: [], other: [] } 
    } = await request.json();

    if (!fontName || !fontEnglishName || !base64ImageLight || !base64ImageDark) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a unique ID (timestamp-based)
    const id = Date.now().toString();
    const safeName = fontEnglishName.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Paths
    const fileNameLight = `${safeName}_light_${id}.png`;
    const fileNameDark = `${safeName}_dark_${id}.png`;
    
    const imagePathLight = `/previews/${fileNameLight}`;
    const imagePathDark = `/previews/${fileNameDark}`;
    
    const absoluteImagePathLight = path.join(process.cwd(), 'public', 'previews', fileNameLight);
    const absoluteImagePathDark = path.join(process.cwd(), 'public', 'previews', fileNameDark);

    // Decode and save Light image
    const base64DataLight = base64ImageLight.replace(/^data:image\/\w+;base64,/, '');
    const bufferLight = Buffer.from(base64DataLight, 'base64');
    await fs.writeFile(absoluteImagePathLight, bufferLight);

    // Decode and save Dark image
    const base64DataDark = base64ImageDark.replace(/^data:image\/\w+;base64,/, '');
    const bufferDark = Buffer.from(base64DataDark, 'base64');
    await fs.writeFile(absoluteImagePathDark, bufferDark);

    const newFont = {
      id,
      name: fontName,
      englishName: fontEnglishName,
      imagePathLight,
      imagePathDark,
      tags: defaultTags,
      createdAt: new Date().toISOString()
    };

    await addFont(newFont);

    return NextResponse.json(newFont, { status: 201 });
  } catch (error) {
    console.error('Error saving font:', error);
    return NextResponse.json({ error: 'Failed to save font' }, { status: 500 });
  }
}
