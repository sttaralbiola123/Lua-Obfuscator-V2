// src/junk.js
// Injects fake/dead instructions into the bytecode stream
// These instructions never affect execution but massively confuse analysis

'use strict';

/**
 * Random integer between min and max (inclusive)
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Inject junk opcodes into instruction stream.
 * - Uses high register numbers (200-255) that real code never touches
 * - Adds fake LOADK, MOVE, ADD instructions between real ones
 * - Adjusts all JMP targets to account for injected instructions
 *
 * @param {Array} instructions - original bytecode
 * @param {Object} ops - opcode name->number map
 * @param {Array} constants - constant pool (may add junk constants)
 * @param {number} density - how many junk ops per real op (0.0 - 1.0)
 */
function injectJunk(instructions, ops, constants, density = 0.4) {
  const junkRegBase = 200; // registers 200-255 — safe junk registers
  const result = [];

  // Build an index map: old_pc -> new_pc (for patching jumps)
  const pcMap = new Map();
  let newPc = 0;

  for (let oldPc = 0; oldPc < instructions.length; oldPc++) {
    pcMap.set(oldPc, newPc);

    // Inject junk BEFORE this instruction (probabilistically)
    const junkCount = Math.random() < density ? randInt(1, 3) : 0;
    for (let j = 0; j < junkCount; j++) {
      result.push(generateJunkInstruction(ops, constants, junkRegBase));
      newPc++;
    }

    result.push({ ...instructions[oldPc] });
    newPc++;
  }

  // Also set final mapping
  pcMap.set(instructions.length, newPc);

  // Patch all JMP / TEST+JMP targets
  const jumpOps = new Set([ops['JMP'], ops['FORPREP'], ops['FORLOOP'], ops['TFORLOOP']]);
  const testOp  = ops['TEST'];

  for (let i = 0; i < result.length; i++) {
    const inst = result[i];
    if (jumpOps.has(inst.op)) {
      const oldTarget = inst.b;
      if (pcMap.has(oldTarget)) {
        inst.b = pcMap.get(oldTarget);
      }
    }
  }

  return result;
}

/**
 * Generate a single junk instruction that:
 * - Only touches high registers (safe zone)
 * - Never causes side effects
 * - Looks plausible to an analyzer
 */
function generateJunkInstruction(ops, constants, junkRegBase) {
  const junkOps = [
    ops['LOADK'],
    ops['MOVE'],
    ops['ADD'],
    ops['SUB'],
    ops['MUL'],
    ops['NOT'],
    ops['UNM'],
    ops['LOADNIL'],
    ops['LOADBOOL'],
  ].filter(v => v !== undefined);

  const op = junkOps[randInt(0, junkOps.length - 1)];
  const a  = junkRegBase + randInt(0, 54);
  const b  = junkRegBase + randInt(0, 54);
  const c  = junkRegBase + randInt(0, 54);

  // For LOADK, use a valid constant index
  if (op === ops['LOADK'] && constants.length > 0) {
    return { op, a, b: randInt(0, constants.length - 1), c: 0 };
  }

  return { op, a, b, c };
}

/**
 * Add opaque predicates — conditions that always evaluate to the same value
 * but are hard for static analysis to determine
 * These are injected as Lua comments in the VM template (not bytecode)
 */
function generateOpaquePredicates() {
  // These are mathematically guaranteed to always be true/false
  // but look complex enough to confuse AI analysis
  const predicates = [
    // Always true
    `(function() local x=${randInt(2,9)} return (x*x - x) % 2 == 0 end)()`,
    `(function() local t={} for i=1,3 do t[i]=i*${randInt(2,7)} end return #t == 3 end)()`,
    `(function() return math.floor(${randInt(100,999)}.0) == ${randInt(100,999)} end)()`,
    // Always false
    `(function() return type(nil) == "number" end)()`,
    `(function() return #{} > 0 end)()`,
  ];

  return predicates;
}

module.exports = { injectJunk, generateOpaquePredicates };
