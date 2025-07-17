const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileRoutes = require('../../backend/routes/fileRoutes');
const { errorHandler } = require('../../backend/middleware/errorHandler');

const app = express();

// 🔐 Middlewares
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔃 Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// 🌐 Routes
app.use('/api', fileRoutes);

// ❗ Error and 404 Handling
app.use(errorHandler);
app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

// 🚀 Export for Netlify
module.exports.handler = serverless(app);
