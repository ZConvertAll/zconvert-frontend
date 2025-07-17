const fs = require('fs');

function errorHandler(error, req, res, next) {
  console.error('Error:', error);

  // Clean up any uploaded files on error
  if (req.file) {
    fs.unlink(req.file.path, () => {});
  }
  
  if (req.files) {
    req.files.forEach(file => fs.unlink(file.path, () => {}));
  }

  // Handle different types of errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: 'Maximum file size is 20MB'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      error: 'Too many files',
      message: 'Maximum 10 files allowed'
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      message: 'Invalid file upload format'
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
}

module.exports = {
  errorHandler
};