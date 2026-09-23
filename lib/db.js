import fs from 'fs/promises';
import path from 'path';

// Define the path to data.json
const dataFilePath = path.join(process.cwd(), 'data.json');

// Ensure the data file exists
async function ensureDataFile() {
  try {
    await fs.access(dataFilePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(dataFilePath, '[]', 'utf-8');
    }
  }
}

export async function getFonts() {
  await ensureDataFile();
  const fileContents = await fs.readFile(dataFilePath, 'utf8');
  if (!fileContents.trim()) return [];
  try {
    return JSON.parse(fileContents);
  } catch (e) {
    return [];
  }
}

export async function addFont(fontData) {
  const fonts = await getFonts();
  fonts.push(fontData);
  await fs.writeFile(dataFilePath, JSON.stringify(fonts, null, 2), 'utf8');
}

export async function updateFontTags(id, tags) {
  const fonts = await getFonts();
  const index = fonts.findIndex(f => f.id === id);
  if (index !== -1) {
    fonts[index].tags = tags;
    await fs.writeFile(dataFilePath, JSON.stringify(fonts, null, 2), 'utf8');
    return fonts[index];
  }
  return null;
}

export async function deleteFont(id) {
  const fonts = await getFonts();
  const index = fonts.findIndex(f => f.id === id);
  if (index !== -1) {
    const deletedFont = fonts.splice(index, 1)[0];
    await fs.writeFile(dataFilePath, JSON.stringify(fonts, null, 2), 'utf8');
    
    // Also delete the images
    const imagesToDelete = [
      deletedFont.imagePath,
      deletedFont.imagePathLight,
      deletedFont.imagePathDark
    ].filter(Boolean);

    for (const imgPath of imagesToDelete) {
      const fullPath = path.join(process.cwd(), 'public', imgPath);
      try {
        await fs.unlink(fullPath);
      } catch (e) {
        console.error(`Failed to delete image ${imgPath}:`, e);
      }
    }
    
    return true;
  }
  return false;
}
