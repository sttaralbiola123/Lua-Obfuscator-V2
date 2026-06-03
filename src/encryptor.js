const crypto = require('crypto');

function generateEncryptionKeys() {
  const key1 = [];
  const key2 = [];
  
  for (let i = 0; i < 64; i++) {
    key1.push(Math.floor(Math.random() * 256));
  }
  
  for (let i = 0; i < 16; i++) {
    key2.push(Math.floor(Math.random() * 256));
  }
  
  return { key1, key2 };
}

function encryptData(data, key1, key2) {
  const bytes = [];
  
  for (let i = 0; i < data.length; i++) {
    let byte = data.charCodeAt(i);
    byte = byte ^ key1[i % key1.length];
    bytes.push(byte);
  }
  
  let shuffled = [];
  for (let i = 0; i < bytes.length; i++) {
    const shift = key2[i % key2.length] % 8;
    shuffled[i] = ((bytes[i] >> (8 - shift)) | (bytes[i] << shift)) & 0xFF;
  }
  
  let result = '';
  for (let i = 0; i < shuffled.length; i++) {
    result += '\\' + shuffled[i].toString(8).padStart(3, '0');
  }
  
  return result;
}

function generateDecryptor(key1, key2, charMap) {
  const k1Str = JSON.stringify(key1);
  const k2Str = JSON.stringify(key2);
  const mapStr = JSON.stringify(charMap);
  
  return `
local B_k1=${k1Str}
local B_k2=${k2Str}
local B_rm=${mapStr}
local function B_decode(s)
  local r=""
  for c in s:gmatch(".")do r=r..(B_rm[c]or c)end
  local b64=r
  local b={}
  local n=0
  for i=1,#b64,4 do
    local c1,c2,c3,c4=b64:sub(i,i),b64:sub(i+1,i+1),b64:sub(i+2,i+2),b64:sub(i+3,i+3)
    local function cv(c)
      local s2="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
      local pos=s2:find(c,1,true)
      return pos and(pos-1)or 0
    end
    local b1,b2,b3,b4=cv(c1),cv(c2),cv(c3),cv(c4)
    n=n+1;b[n]=(b1<<2)|(b2>>4)
    if c3~="="then n=n+1;b[n]=((b2&0xF)<<4)|(b3>>2)end
    if c4~="="then n=n+1;b[n]=((b3&0x3)<<6)|b4 end
  end
  local unshuffled={}
  for i=1,#b do
    local shift=B_k2[((i-1)%#B_k2)+1]%8
    local byte=b[i]
    unshuffled[i]=((byte>>(8-shift))|(byte<<shift))&0xFF
  end
  local decrypted={}
  for i=1,#unshuffled do
    decrypted[i]=unshuffled[i]~B_k1[((i-1)%#B_k1)+1]
  end
  return decrypted
end
`;
}

module.exports = { generateEncryptionKeys, encryptData, generateDecryptor };
