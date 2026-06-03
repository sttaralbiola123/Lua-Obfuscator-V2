function encryptData(dataStr, key1, key2) {
  const bytes = [];
  for (let i = 0; i < dataStr.length; i++) {
    let byte = dataStr.charCodeAt(i);
    byte = byte ^ key1[i % key1.length];
    bytes.push(byte);
  }
  const shuffled = [];
  for (let i = 0; i < bytes.length; i++) {
    const shift = key2[i % key2.length] % 8;
    shuffled[i] = ((bytes[i] >> (8 - shift)) | (bytes[i] << shift)) & 0xFF;
  }
  // Iwasan ang octal na may backslash – gamitin ang string na may \ddd
  let out = '';
  for (let i = 0; i < shuffled.length; i++) {
    out += '\\' + shuffled[i].toString(8).padStart(3, '0');
  }
  return out;
}
