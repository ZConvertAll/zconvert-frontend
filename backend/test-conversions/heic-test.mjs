import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { convertFile } from '../services/conversionService.js';

// Helpers for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample HEIC file (use one that previously failed)
const samplePath = path.join(__dirname, 'sample.HEIC');

const convert = async () => {
  console.log('🔁 Starting conversion...');
  const fakeFile = {
    path: samplePath,
    originalname: 'sample.heic'
  };

  try {
    const result = await convertFile(fakeFile, 'jpg');
    console.log('✅ Converted:', result.filename);
    console.log('📁 Output path:', result.path);
  } catch (err) {
    console.error('❌ Conversion failed:', err.message);
  }
};

convert();