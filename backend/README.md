# File Converter Backend

A Node.js Express server for file conversion with support for documents and images.

## Features

- **Document Conversion**: DOCX, DOC, ODT, RTF, HTML, MD ↔ PDF, TXT, HTML, etc.
- **Image Conversion**: HEIC, JPG, PNG, WEBP, TIFF, BMP with Sharp
- **Batch Processing**: Multiple file uploads with ZIP packaging
- **Security**: Rate limiting, file validation, size limits
- **Error Handling**: Comprehensive error responses

## Prerequisites

Install these system dependencies:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libreoffice pandoc

# macOS (with Homebrew)
brew install libreoffice pandoc

# Windows
# Download and install LibreOffice from https://www.libreoffice.org/
# Download and install Pandoc from https://pandoc.org/installing.html
```

## Installation

```bash
cd backend
npm install
```

## Usage

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on http://localhost:3001

## API Endpoints

### Single File Conversion
```bash
POST /api/files/convert
Content-Type: multipart/form-data

# Form data:
file: [file]
targetFormat: "pdf"
```

### Multiple File Conversion
```bash
POST /api/files/convert-multiple
Content-Type: multipart/form-data

# Form data:
files: [file1, file2, ...]
targetFormat: "pdf"
```

### Get Supported Formats
```bash
GET /api/files/supported-formats
```

## File Size Limits

- **Documents**: 20MB per file, max 10 files
- **Images**: 50MB per file, max 5 files  
- **Videos**: 100MB per file, max 3 files
- **Audio**: 30MB per file, max 10 files

## Environment Variables

```bash
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400**: Bad request (missing files, invalid format)
- **413**: File too large or too many files
- **429**: Rate limit exceeded
- **500**: Internal server error

## Example Usage

```javascript
// Single file conversion
const formData = new FormData();
formData.append('file', file);
formData.append('targetFormat', 'pdf');

const response = await fetch('/api/files/convert', {
  method: 'POST',
  body: formData
});

// Multiple file conversion
const formData = new FormData();
files.forEach(file => formData.append('files', file));
formData.append('targetFormat', 'pdf');

const response = await fetch('/api/files/convert-multiple', {
  method: 'POST',
  body: formData
});
```

## Security Features

- Helmet.js for security headers
- CORS protection
- Rate limiting (100 requests per 15 minutes)
- File type validation
- File size limits
- Automatic cleanup of temporary files