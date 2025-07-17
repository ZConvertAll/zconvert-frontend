const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const shell = require('shelljs');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');

class ConversionService {
  constructor() {
    this.outputDir = path.join(__dirname, '../converted');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async convertFile(file, targetFormat) {
    if (!fs.existsSync(file.path)) {
  throw new Error('Uploaded file was not found on server');
}

    const sourceExt = path.extname(file.originalname).toLowerCase().substring(1);
    const targetExt = targetFormat.toLowerCase();

    // Determine conversion type
    if (this.isImageFormat(sourceExt) || this.isImageFormat(targetExt)) {
      return await this.convertImage(file, targetExt);
    } else if (this.isDocumentFormat(sourceExt) || this.isDocumentFormat(targetExt)) {
      return await this.convertDocument(file, targetExt);
    } else {
      throw new Error(`Unsupported conversion: ${sourceExt} to ${targetExt}`);
    }
  }

  async convertImage(file, targetFormat) {
    const outputFilename = `${uuidv4()}.${targetFormat}`;
    const outputPath = path.join(this.outputDir, outputFilename);

    try {
      let sharpInstance = sharp(file.path);

      // Configure based on target format
      switch (targetFormat.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality: 85 });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality: 85 });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality: 85 });
          break;
        case 'tiff':
          sharpInstance = sharpInstance.tiff();
          break;
        case 'bmp':
          sharpInstance = sharpInstance.bmp();
          break;
        default:
          throw new Error(`Unsupported image format: ${targetFormat}`);
      }

      await sharpInstance.toFile(outputPath);

      return {
        path: outputPath,
        filename: outputFilename,
        mimeType: mime.lookup(targetFormat) || 'application/octet-stream'
      };
    } catch (error) {
      console.warn(`⚠️ Sharp failed: ${error.message}. Trying fallback methods...`);
      return await this.fallbackConvertImage(file, targetFormat, outputPath, outputFilename);
    }
  }

  async fallbackConvertImage(file, targetFormat, outputPath, outputFilename) {
    const inputPath = file.path;
    const format = targetFormat.toLowerCase();

    // Try ImageMagick fallback
    try {
      const convertCmd = `convert "${inputPath}" "${outputPath}"`;
      execSync(convertCmd);

      if (fs.existsSync(outputPath)) {
        return {
          path: outputPath,
          filename: outputFilename,
          mimeType: mime.lookup(format) || 'application/octet-stream'
        };
      }
    } catch (magickError) {
      console.warn(`⚠️ ImageMagick failed: ${magickError.message}`);
    }

    // Try libvips CLI fallback
    try {
      const vipsCmd = `vips copy "${inputPath}" "${outputPath}"`;
      execSync(vipsCmd);

      if (fs.existsSync(outputPath)) {
        return {
          path: outputPath,
          filename: outputFilename,
          mimeType: mime.lookup(format) || 'application/octet-stream'
        };
      }
    } catch (vipsError) {
      console.warn(`⚠️ libvips failed: ${vipsError.message}`);
    }

    throw new Error('All image conversion methods failed.');
  }

  async convertDocument(file, targetFormat) {
    const sourceExt = path.extname(file.originalname).toLowerCase().substring(1);
    const outputFilename = `${uuidv4()}.${targetFormat}`;
    const outputPath = path.join(this.outputDir, outputFilename);

    try {
      if (this.canUseLibreOffice(sourceExt, targetFormat)) {
        await this.convertWithLibreOffice(file.path, outputPath, targetFormat);
      } else if (this.canUsePandoc(sourceExt, targetFormat)) {
        await this.convertWithPandoc(file.path, outputPath, sourceExt, targetFormat);
      } else if (this.canConvertText(sourceExt, targetFormat)) {
        await this.convertText(file.path, outputPath, sourceExt, targetFormat);
      } else {
        throw new Error(`Conversion from ${sourceExt} to ${targetFormat} is not supported`);
      }

      return {
        path: outputPath,
        filename: outputFilename,
        mimeType: mime.lookup(targetFormat) || 'application/octet-stream'
      };
    } catch (error) {
      throw new Error(`Document conversion failed: ${error.message}`);
    }
  }

  async convertWithLibreOffice(inputPath, outputPath, targetFormat) {
    const outputDir = path.dirname(outputPath);
    const tempName = path.basename(outputPath, path.extname(outputPath));

    const cmd = `libreoffice --headless --convert-to ${targetFormat} --outdir "${outputDir}" "${inputPath}"`;
    const result = shell.exec(cmd, { silent: true });

    if (result.code !== 0) {
      throw new Error(`LibreOffice conversion failed: ${result.stderr}`);
    }

    const originalName = path.basename(inputPath, path.extname(inputPath));
    const libreOfficeOutput = path.join(outputDir, `${originalName}.${targetFormat}`);

    if (fs.existsSync(libreOfficeOutput)) {
      fs.renameSync(libreOfficeOutput, outputPath);
    } else {
      throw new Error('LibreOffice output file not found');
    }
  }

  async convertWithPandoc(inputPath, outputPath, sourceFormat, targetFormat) {
    let fromFormat = sourceFormat;
    let toFormat = targetFormat;

    if (sourceFormat === 'md') fromFormat = 'markdown';
    if (targetFormat === 'md') toFormat = 'markdown';

    const cmd = `pandoc -f ${fromFormat} -t ${toFormat} "${inputPath}" -o "${outputPath}"`;
    const result = shell.exec(cmd, { silent: true });

    if (result.code !== 0) {
      throw new Error(`Pandoc conversion failed: ${result.stderr}`);
    }
  }

  async convertText(inputPath, outputPath, sourceFormat, targetFormat) {
    const content = fs.readFileSync(inputPath, 'utf8');
    let convertedContent;

    if (sourceFormat === 'txt' && targetFormat === 'html') {
      convertedContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Converted Document</title>
</head>
<body>
    <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    } else if (sourceFormat === 'html' && targetFormat === 'txt') {
      convertedContent = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    } else {
      convertedContent = content;
    }

    fs.writeFileSync(outputPath, convertedContent);
  }

  canUseLibreOffice(sourceFormat, targetFormat) {
    const libreOfficeInputs = ['docx', 'doc', 'odt', 'rtf'];
    const libreOfficeOutputs = ['pdf', 'docx', 'odt', 'txt', 'html'];
    return libreOfficeInputs.includes(sourceFormat) && libreOfficeOutputs.includes(targetFormat);
  }

  canUsePandoc(sourceFormat, targetFormat) {
    const pandocFormats = ['md', 'html', 'txt'];
    return pandocFormats.includes(sourceFormat) && pandocFormats.includes(targetFormat);
  }

  canConvertText(sourceFormat, targetFormat) {
    const textFormats = ['txt', 'html'];
    return textFormats.includes(sourceFormat) && textFormats.includes(targetFormat);
  }

  isImageFormat(format) {
    const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff', 'bmp'];
    return imageFormats.includes(format.toLowerCase());
  }

  isDocumentFormat(format) {
    const documentFormats = ['docx', 'doc', 'odt', 'rtf', 'html', 'md', 'txt', 'pdf'];
    return documentFormats.includes(format.toLowerCase());
  }
}

module.exports = {
  convertFile: async (file, targetFormat) => {
    const service = new ConversionService();
    return await service.convertFile(file, targetFormat);
  }
};
