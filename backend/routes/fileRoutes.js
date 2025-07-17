const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { convertFile } = require('../services/conversionService');
const { createZip } = require('../services/zipService');
const { validateFileType, validateFileSize } = require('../middleware/validation');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, validation happens later
    cb(null, true);
  }
});

// Single file conversion
router.post('/convert', upload.single('file'), validateFileType, validateFileSize, async (req, res) => {
  try {
    const { targetFormat } = req.body;
    const file = req.file;

    if (!file || !targetFormat) {
      return res.status(400).json({ 
        error: 'File and target format are required' 
      });
    }

    const convertedFile = await convertFile(file, targetFormat);
    
    // Send the converted file
    res.setHeader('Content-Disposition', `attachment; filename="${convertedFile.filename}"`);
    res.setHeader('Content-Type', convertedFile.mimeType);
    
    const fileStream = fs.createReadStream(convertedFile.path);
    fileStream.pipe(res);
    
    // Clean up files after sending
    fileStream.on('end', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(convertedFile.path, () => {});
    });

  } catch (error) {
    console.error('Conversion error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    
    res.status(500).json({ 
      error: error.message || 'Conversion failed' 
    });
  }
});

// Multiple file conversion
router.post('/convert-multiple', upload.array('files', 10), async (req, res) => {
  try {
    const { targetFormat } = req.body;
    const files = req.files;

    if (!files || files.length === 0 || !targetFormat) {
      return res.status(400).json({ 
        error: 'Files and target format are required' 
      });
    }

    const convertedFiles = [];
    const errors = [];

    // Convert each file
    for (const file of files) {
      try {
        // Validate each file
        if (!validateFileType({ file }, null, () => {}) || !validateFileSize({ file }, null, () => {})) {
          errors.push(`${file.originalname}: Invalid file type or size`);
          continue;
        }

        const convertedFile = await convertFile(file, targetFormat);
        convertedFiles.push({
          original: file.originalname,
          converted: convertedFile
        });
      } catch (error) {
        errors.push(`${file.originalname}: ${error.message}`);
        // Clean up failed file
        fs.unlink(file.path, () => {});
      }
    }

    if (convertedFiles.length === 0) {
      return res.status(400).json({ 
        error: 'No files could be converted',
        details: errors
      });
    }

    // Create zip file with converted files
    const zipPath = await createZip(convertedFiles);
    
    // Send zip file
    res.setHeader('Content-Disposition', 'attachment; filename="converted-files.zip"');
    res.setHeader('Content-Type', 'application/zip');
    
    const zipStream = fs.createReadStream(zipPath);
    zipStream.pipe(res);
    
    // Clean up files after sending
    zipStream.on('end', () => {
      // Clean up original files
      files.forEach(file => fs.unlink(file.path, () => {}));
      
      // Clean up converted files
      convertedFiles.forEach(({ converted }) => fs.unlink(converted.path, () => {}));
      
      // Clean up zip file
      fs.unlink(zipPath, () => {});
    });

    // Include any errors in response headers for client info
    if (errors.length > 0) {
      res.setHeader('X-Conversion-Errors', JSON.stringify(errors));
    }

  } catch (error) {
    console.error('Multiple conversion error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => fs.unlink(file.path, () => {}));
    }
    
    res.status(500).json({ 
      error: error.message || 'Batch conversion failed' 
    });
  }
});

// Get supported formats
router.get('/supported-formats', (req, res) => {
  res.json({
    documents: {
      input: ['docx', 'doc', 'odt', 'rtf', 'html', 'md', 'txt'],
      output: ['pdf', 'txt', 'html', 'docx', 'odt']
    },
    images: {
      input: ['heic', 'jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'],
      output: ['apng', 'bmp', 'exr', 'fits', 'gif', 'jp2', 'jpeg', 'jpg','pbm', 'pcx', 'pgm', 'pix', 'png', 'ppm', 'ras','sgi', 'tga', 'tiff', 'webp', 'xbm', 'xwd']

    }
  });
});

module.exports = router;