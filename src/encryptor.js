// src/encryptor.js
// Multi-layer encryption for the constant pool and bytecode
// Uses: multi-key XOR + byte shuffling + custom base alphabet

'use strict';

/**
 * Generate a random encryption key of given length
 */
function generateKey(length = 32) {
  const key = [];
  for (let i = 0; i < length; i++) {
    key.push(Math.floor(Math.random() * 256));
  }
  return key;
}

/**
 * Generate a random substitution alphabet for encoding
 * (replaces standard base64 alphabet with a shuffled one)
 */
function generateAlphabet() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const arr = chars.split('');
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/**
 * XOR encrypt a byte array with a key (cyclic)
 */
function xorEncrypt(bytes, key) {
  return bytes.map((b, i) => b ^ key[i % key.length]);
}

/**
 * Encode bytes using a custom alphabet (base64-like)
 */
function customEncode(bytes, alphabet) {
  // Standard base64 encode first
  const b64 = Buffer.from(bytes).toString('base64');
  // Then substitute each char using our custom alphabet
  const standard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (const c of b64) {
    const idx = standard.indexOf(c);
    result += idx >= 0 ? alphabet[idx] : c; // keep '=' padding as-is
  }
  return result;
}

/**
 * Serialize a number to bytes (4-byte big-endian)
 */
function numToBytes(n) {
  n = Math.floor(n) >>> 0;
  return [(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
}

/**
 * Serialize a string to bytes (length-prefixed)
 */
function strToBytes(s) {
  const buf = Buffer.from(s, 'utf8');
  return [...numToBytes(buf.length), ...buf];
}

/**
 * Encrypt a constant pool entry
 */
function encryptConstant(value, key) {
  let typeTag;
  let bytes;

  if (value === null || value === undefined) {
    typeTag = 0;
    bytes = [];
  } else if (typeof value === 'boolean') {
    typeTag = 1;
    bytes = [value ? 1 : 0];
  } else if (typeof value === 'number') {
    typeTag = 2;
    // Encode float as string representation for simplicity
    bytes = strToBytes(String(value));
  } else if (typeof value === 'string') {
    typeTag = 3;
    bytes = strToBytes(value);
  } else {
    typeTag = 0;
    bytes = [];
  }

  const fullBytes = [typeTag, ...bytes];
  return xorEncrypt(fullBytes, key);
}

/**
 * Main encryption pipeline:
 * 1. Serialize all constants
 * 2. XOR encrypt with key1
 * 3. Byte-shuffle with key2
 * 4. Encode with custom alphabet
 */
function encryptConstantPool(constants) {
  const key1 = generateKey(64);
  const key2 = generateKey(16);
  const alphabet = generateAlphabet();

  // Serialize each constant
  const serialized = constants.map(c => encryptConstant(c, key1));

  // Flatten: [count(4), len0(4), data0..., len1(4), data1..., ...]
  const flat = [...numToBytes(constants.length)];
  for (const enc of serialized) {
    flat.push(...numToBytes(enc.length), ...enc);
  }

  // Byte shuffle using key2
  const shuffled = flat.map((b, i) => {
    const shift = key2[i % key2.length] % 8;
    return ((b << shift) | (b >> (8 - shift))) & 0xFF;
  });

  // Custom encode
  const encoded = customEncode(shuffled, alphabet);

  return { encoded, key1, key2, alphabet };
}

/**
 * Encrypt the bytecode array
 */
function encryptBytecode(instructions, key1, key2, alphabet) {
  // Serialize instructions as: [op(1), a(1), b(2), c(2)] per instruction
  const flat = [...numToBytes(instructions.length)];
  
  for (const inst of instructions) {
    flat.push(
      inst.op & 0xFF,
      (inst.a || 0) & 0xFF,
      ((inst.b || 0) >> 8) & 0xFF,
      (inst.b || 0) & 0xFF,
      ((inst.c || 0) >> 8) & 0xFF,
      (inst.c || 0) & 0xFF
    );
  }

  // XOR with key1
  const encrypted = xorEncrypt(flat, key1);

  // Byte shuffle with key2
  const shuffled = encrypted.map((b, i) => {
    const shift = key2[i % key2.length] % 8;
    return ((b << shift) | (b >> (8 - shift))) & 0xFF;
  });

  return customEncode(shuffled, alphabet);
}

/**
 * Generate Lua decryption code that will be embedded in the VM
 */
function generateDecryptorLua(key1, key2, alphabet, varPrefix) {
  const k1Str = '[' + key1.join(',') + ']';
  const k2Str = '[' + key2.join(',') + ']';
  const stdAlpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // Build reverse alphabet map
  const reverseMap = {};
  for (let i = 0; i < stdAlpha.length; i++) {
    reverseMap[alphabet[i]] = stdAlpha[i];
  }
  const revPairs = Object.entries(reverseMap)
    .map(([k, v]) => `["${k}"]="${v}"`)
    .join(',');

  return `
local ${varPrefix}k1=${k1Str}
local ${varPrefix}k2=${k2Str}
local ${varPrefix}rm={${revPairs}}
local function ${varPrefix}decode(s)
  local r=""
  for c in s:gmatch(".")do r=r..(${varPrefix}rm[c]or c)end
  local b64=r
  local b={}
  local n=0
  for i=1,#b64,4 do
    local c1,c2,c3,c4=b64:sub(i,i),b64:sub(i+1,i+1),b64:sub(i+2,i+2),b64:sub(i+3,i+3)
    local function cv(c)
      local s2="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
      return s2:find(c,1,true) and (s2:find(c,1,true)-1) or 0
    end
    local b1,b2,b3,b4=cv(c1),cv(c2),cv(c3),cv(c4)
    n=n+1;b[n]=(b1<<2)|(b2>>4)
    if c3~="=" then n=n+1;b[n]=((b2&0xF)<<4)|(b3>>2)end
    if c4~="=" then n=n+1;b[n]=((b3&0x3)<<6)|b4 end
  end
  local unshuffled={}
  for i=1,#b do
    local shift=${varPrefix}k2[((i-1)%#${varPrefix}k2)+1]%8
    local byte=b[i]
    unshuffled[i]=((byte>>(8-shift))|(byte<<shift))&0xFF
  end
  local decrypted={}
  for i=1,#unshuffled do
    decrypted[i]=unshuffled[i]^${varPrefix}k1[((i-1)%#${varPrefix}k1)+1]
  end
  return decrypted
end`;
}

module.exports = {
  generateKey,
  generateAlphabet,
  encryptConstantPool,
  encryptBytecode,
  generateDecryptorLua,
};
