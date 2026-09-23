import { NextResponse } from 'next/server';
import { updateFontTags, deleteFont } from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { tags } = await request.json();

    if (!tags || typeof tags !== 'object') {
      return NextResponse.json({ error: 'Tags must be an object' }, { status: 400 });
    }

    const updatedFont = await updateFontTags(id, tags);
    if (!updatedFont) {
      return NextResponse.json({ error: 'Font not found' }, { status: 404 });
    }

    return NextResponse.json(updatedFont);
  } catch (error) {
    console.error('Error updating font tags:', error);
    return NextResponse.json({ error: 'Failed to update font' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    const success = await deleteFont(id);
    if (!success) {
      return NextResponse.json({ error: 'Font not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Font deleted successfully' });
  } catch (error) {
    console.error('Error deleting font:', error);
    return NextResponse.json({ error: 'Failed to delete font' }, { status: 500 });
  }
}
