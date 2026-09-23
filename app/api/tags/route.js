import { NextResponse } from 'next/server';
import { getFonts } from '@/lib/db';

export async function GET() {
  try {
    const fonts = await getFonts();
    const categories = ['type', 'language', 'style', 'other'];
    const tags = { type: new Set(), language: new Set(), style: new Set(), other: new Set() };
    
    fonts.forEach(font => {
      if (font.tags && !Array.isArray(font.tags)) {
        categories.forEach(cat => {
          font.tags[cat]?.forEach(tag => tags[cat].add(tag));
        });
      }
    });
    
    const result = {
      type: Array.from(tags.type),
      language: Array.from(tags.language),
      style: Array.from(tags.style),
      other: Array.from(tags.other)
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
