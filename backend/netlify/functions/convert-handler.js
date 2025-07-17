// netlify/functions/convert-handler.js
const serverless = require("serverless-http");
const express = require("express");
const fileRoutes = require("../../backend/routes/fileRoutes"); // update path as needed
const errorHandler = require("../../backend/middleware/errorHandler");

const app = express();

app.use(express.json());
app.use("/api/files", fileRoutes);
app.use(errorHandler);

module.exports.handler = serverless(app);
