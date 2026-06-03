// server.js
'use strict';

const express = require('express');
const path = require('path');
const { obfuscate } = require('./src/obfuscator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── POST /api/obfuscate ──────────────────────────────────────────────────────
app.post('/api/obfuscate', (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ error: 'No code provided.' });
  }

  if (code.length > 50000) {
    return res.status(400).json({ error: 'Script too large (max 50KB).' });
  }

  try {
    const result = obfuscate(code.trim());
    return res.status(200).json({ result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Fallback ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🔐 Lua Obfuscator running at http://localhost:${PORT}`);
});
