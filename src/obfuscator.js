const { LuaCompiler } = require('./compiler');
const { generateEncryptionKeys, encryptData, generateDecryptor } = require('./encryptor');
const { generateVM } = require('./vmgen');
const { nameToNum } = require('./opcodes');

async function obfuscateLua(luaCode) {
  const compiler = new LuaCompiler();
  const { bytecode, constants } = compiler.compile(luaCode);
  
  // I-convert sa string ang bytecode (array of numbers)
  const bcStr = JSON.stringify(bytecode);
  const constStr = JSON.stringify(constants);
  
  const bcKeys = generateEncryptionKeys();
  const constKeys = generateEncryptionKeys();
  
  const charMap = { /* same as before */ };
  
  const encryptedBC = encryptData(bcStr, bcKeys.key1, bcKeys.key2);
  const encryptedConst = encryptData(constStr, constKeys.key1, constKeys.key2);
  
  const decryptor = generateDecryptor(bcKeys.key1, bcKeys.key2, charMap);
  
  const vmCode = generateVM({ nameToNum }, encryptedBC, encryptedConst, decryptor);
  return vmCode;
}

module.exports = { obfuscateLua };
