const serverless = require('serverless-http');
const app = require('../../server'); // points to your Express app
module.exports.handler = serverless(app);
