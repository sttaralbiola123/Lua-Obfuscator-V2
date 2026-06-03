const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { obfuscateLua } = require('./src/obfuscator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static('public'));

app.post('/obfuscate', async (req, res) => {
  try {
    let luaCode;
    
    if (typeof req.body === 'string') {
      luaCode = req.body;
    } else if (req.body.code) {
      luaCode = req.body.code;
    } else {
      return res.status(400).json({ error: 'Invalid Lua code provided' });
    }
    
    if (!luaCode || typeof luaCode !== 'string' || luaCode.trim().length === 0) {
      return res.status(400).json({ error: 'Empty or invalid Lua code' });
    }
    
    console.log(`Obfuscating code (${luaCode.length} bytes)...`);
    const obfuscated = await obfuscateLua(luaCode);
    console.log('Obfuscation successful!');
    
    res.json({ success: true, code: obfuscated });
  } catch (error) {
    console.error('Obfuscation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Lua Obfuscator running on port ${PORT}`);
  console.log(`Protected by: Sttar Albiola`);
});
