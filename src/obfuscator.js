// src/obfuscator.js
// Main pipeline: source → AST → bytecode → encrypt → VM

'use strict';

const luaparse = require('luaparse');
const Compiler = require('./compiler');
const { generateOpcodeTable } = require('./opcodes');
const { encryptConstantPool, encryptBytecode, generateDecryptorLua } = require('./encryptor');
const { injectJunk } = require('./junk');
const { generateVM } = require('./vmgen');

/**
 * Main obfuscation function.
 * @param {string} source - Lua source code
 * @returns {string} - Obfuscated Lua code
 */
function obfuscate(source) {
  // ── Step 1: Parse to AST ─────────────────────────────────────
  let ast;
  try {
    ast = luaparse.parse(source, {
      luaVersion: '5.1',
      encodingMode: 'pseudo-latin1',
    });
  } catch (e) {
    throw new Error(`Lua parse error: ${e.message}`);
  }

  // ── Step 2: Generate randomized opcode table ─────────────────
  const opcodeTable = generateOpcodeTable();

  // ── Step 3: Compile AST → bytecode ──────────────────────────
  const compiler = new Compiler(opcodeTable);
  const { instructions, constants } = compiler.compile(ast);

  if (instructions.length === 0) {
    throw new Error('Compilation produced no instructions.');
  }

  // ── Step 4: Inject junk instructions ────────────────────────
  const junkInstructions = injectJunk(
    instructions,
    opcodeTable.nameToNum,
    constants,
    0.45  // 45% density — adds ~45% more fake instructions
  );

  // ── Step 5: Encrypt constant pool ───────────────────────────
  const {
    encoded: encryptedKST,
    key1, key2, alphabet
  } = encryptConstantPool(constants);

  // ── Step 6: Encrypt bytecode ─────────────────────────────────
  const encryptedBC = encryptBytecode(junkInstructions, key1, key2, alphabet);

  // ── Step 7: Generate decryptor Lua ──────────────────────────
  const varPrefix = 'x' + Math.random().toString(36).slice(2, 6) + '_';
  const decryptorLua = generateDecryptorLua(key1, key2, alphabet, varPrefix);

  // ── Step 8: Generate VM ──────────────────────────────────────
  const output = generateVM(
    opcodeTable,
    encryptedBC,
    encryptedKST,
    decryptorLua,
    {}
  );

  return output;
}

module.exports = { obfuscate };
