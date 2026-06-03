// src/opcodes.js
// Generates a UNIQUE randomized opcode table every compile
// This means the same source code produces different bytecode every time

'use strict';

const OPCODE_NAMES = [
  'LOADK',       // Load constant
  'LOADNIL',     // Load nil
  'LOADBOOL',    // Load boolean
  'MOVE',        // Move register
  'GETGLOBAL',   // Get global variable
  'SETGLOBAL',   // Set global variable
  'GETTABLE',    // Get table field
  'SETTABLE',    // Set table field
  'NEWTABLE',    // Create new table
  'CALL',        // Call function
  'RETURN',      // Return
  'ADD',         // Addition
  'SUB',         // Subtraction
  'MUL',         // Multiplication
  'DIV',         // Division
  'MOD',         // Modulo
  'POW',         // Power
  'UNM',         // Unary minus
  'NOT',         // Logical not
  'LEN',         // Length
  'CONCAT',      // Concatenation
  'JMP',         // Unconditional jump
  'EQ',          // Equal
  'LT',          // Less than
  'LE',          // Less equal
  'TEST',        // Test (for loops)
  'FORPREP',     // Numeric for prepare
  'FORLOOP',     // Numeric for loop
  'TFORLOOP',    // Generic for loop
  'CLOSURE',     // Create closure
  'VARARG',      // Vararg
  'SELF',        // Self call (method)
];

/**
 * Generate a shuffled opcode map — different every compile.
 * Returns: { NAME -> number, number -> NAME }
 */
function generateOpcodeTable() {
  // Create array of numbers 0..N and shuffle
  const nums = Array.from({ length: OPCODE_NAMES.length }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }

  const nameToNum = {};
  const numToName = {};

  OPCODE_NAMES.forEach((name, i) => {
    nameToNum[name] = nums[i];
    numToName[nums[i]] = name;
  });

  return { nameToNum, numToName };
}

module.exports = { generateOpcodeTable, OPCODE_NAMES };
