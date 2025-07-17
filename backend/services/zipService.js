const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function createZip(convertedFiles) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(__dirname, '../converted', `batch-${uuidv4()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level
    });

    output.on('close', () => {
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add each converted file to the zip
    convertedFiles.forEach(({ original, converted }) => {
      const originalName = path.parse(original).name;
      const extension = path.extname(converted.filename);
      const zipFilename = `${originalName}${extension}`;
      
      archive.file(converted.path, { name: zipFilename });
    });

    archive.finalize();
  });
}

module.exports = {
  createZip
};