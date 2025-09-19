// Simple static server for production client
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.CLIENT_PORT || 5173;
const HOST = process.env.CLIENT_HOST || '0.0.0.0';

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle client-side routing - send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`🎮 Snake client server running on http://${HOST}:${PORT}`);
});
