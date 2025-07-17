const mime = require('mime-types');

// File size limits by category (in bytes)
const FILE_SIZE_LIMITS = {
  video: 100 * 1024 * 1024, // 100MB
  image: 50 * 1024 * 1024,  // 50MB
  audio: 30 * 1024 * 1024,  // 30MB
  document: 20 * 1024 * 1024 // 20MB
};

// File count limits by category
const FILE_COUNT_LIMITS = {
  video: 3,
  image: 5,
  audio: 10,
  document: 10
};

// Supported file types
const SUPPORTED_TYPES = {
  documents: ['docx', 'doc', 'odt', 'rtf', 'html', 'md', 'txt', 'pdf'],
  images: ['heic', 'jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif'],
  videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']
};

function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  if (SUPPORTED_TYPES.documents.includes(ext)) return 'document';
  if (SUPPORTED_TYPES.images.includes(ext)) return 'image';
  if (SUPPORTED_TYPES.videos.includes(ext)) return 'video';
  if (SUPPORTED_TYPES.audio.includes(ext)) return 'audio';
  
  return null;
}

function validateFileType(req, res, next) {
  const file = req.file || (req.files && req.files[0]);
  
  if (!file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const category = getFileCategory(file.originalname);
  
  if (!category) {
    return res.status(400).json({ 
      error: `Unsupported file type: ${file.originalname}`,
      supportedTypes: SUPPORTED_TYPES
    });
  }

  // Store category for later use
  req.fileCategory = category;
  next();
}

function validateFileSize(req, res, next) {
  const files = req.files || [req.file];
  const category = req.fileCategory;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  // Check file count limits
  if (files.length > FILE_COUNT_LIMITS[category]) {
    return res.status(400).json({ 
      error: `Too many ${category} files. Maximum allowed: ${FILE_COUNT_LIMITS[category]}` 
    });
  }

  // Check individual file sizes
  const sizeLimit = FILE_SIZE_LIMITS[category];
  const oversizedFiles = files.filter(file => file.size > sizeLimit);
  
  if (oversizedFiles.length > 0) {
    return res.status(400).json({ 
      error: `File(s) too large for ${category} category. Maximum size: ${Math.round(sizeLimit / (1024 * 1024))}MB`,
      oversizedFiles: oversizedFiles.map(f => ({
        name: f.originalname,
        size: `${Math.round(f.size / (1024 * 1024))}MB`
      }))
    });
  }

  next();
}

function validateConversionRequest(req, res, next) {
  const { targetFormat } = req.body;
  const category = req.fileCategory;
  
  if (!targetFormat) {
    return res.status(400).json({ error: 'Target format is required' });
  }

  // Check if target format is supported for this file category
  const supportedOutputs = Object.values(SUPPORTED_TYPES).flat();
  
  if (!supportedOutputs.includes(targetFormat.toLowerCase())) {
    return res.status(400).json({ 
      error: `Unsupported target format: ${targetFormat}`,
      supportedFormats: SUPPORTED_TYPES
    });
  }

  next();
}

module.exports = {
  validateFileType,
  validateFileSize,
  validateConversionRequest,
  getFileCategory,
  SUPPORTED_TYPES,
  FILE_SIZE_LIMITS,
  FILE_COUNT_LIMITS
};