const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { obfuscateLua } = require('./src/obfuscator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb', type: 'text/plain' }));
app.use(express.static('public'));

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Obfuscation endpoint
app.post('/obfuscate', async (req, res) => {
  try {
    let luaCode = '';

    // Handle both JSON and plain text requests
    if (typeof req.body === 'string') {
      luaCode = req.body;
    } else if (req.body && typeof req.body === 'object') {
      luaCode = req.body.code || req.body.luaCode || '';
    } else {
      return res.status(400).json({ error: 'Invalid request: missing Lua code' });
    }

    if (!luaCode || typeof luaCode !== 'string' || luaCode.trim().length === 0) {
      return res.status(400).json({ error: 'Empty or invalid Lua code provided' });
    }

    console.log(`[+] Obfuscating Lua (${luaCode.length} bytes)...`);
    const obfuscated = await obfuscateLua(luaCode);
    console.log('[+] Obfuscation successful');

    res.json({ success: true, code: obfuscated });
  } catch (error) {
    console.error('Obfuscation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Catch-all to serve index.html for any other route (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server on 0.0.0.0 (required for Render)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Lua Obfuscator running on port ${PORT}`);
  console.log(`🔒 Protected by: Sttar Albiola`);
});
