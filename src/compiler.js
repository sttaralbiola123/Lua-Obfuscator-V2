// src/compiler.js
// Walks the luaparse AST and emits custom bytecode instructions

'use strict';

class Compiler {
  constructor(opcodeTable) {
    this.ops = opcodeTable.nameToNum;
    this.instructions = [];
    this.constants = [];
    this.constMap = new Map();
    this.locals = [];       // stack of scope arrays
    this.registerTop = 0;
    this.labelCounter = 0;
  }

  // ── Constant pool ────────────────────────────────────────────

  addConstant(value) {
    const key = typeof value === 'string' ? `s:${value}` : `${typeof value}:${value}`;
    if (this.constMap.has(key)) return this.constMap.get(key);
    const idx = this.constants.length;
    this.constants.push(value);
    this.constMap.set(key, idx);
    return idx;
  }

  // ── Register allocation ──────────────────────────────────────

  allocReg() {
    return this.registerTop++;
  }

  freeReg() {
    if (this.registerTop > 0) this.registerTop--;
  }

  // ── Scope / locals ───────────────────────────────────────────

  pushScope() {
    this.locals.push([]);
  }

  popScope() {
    const scope = this.locals.pop();
    this.registerTop -= scope.length;
  }

  declareLocal(name) {
    const reg = this.allocReg();
    const top = this.locals[this.locals.length - 1];
    top.push({ name, reg });
    return reg;
  }

  resolveLocal(name) {
    for (let i = this.locals.length - 1; i >= 0; i--) {
      const scope = this.locals[i];
      for (let j = scope.length - 1; j >= 0; j--) {
        if (scope[j].name === name) return scope[j].reg;
      }
    }
    return null;
  }

  // ── Instruction emitter ──────────────────────────────────────

  emit(op, a = 0, b = 0, c = 0) {
    this.instructions.push({ op, a, b, c });
    return this.instructions.length - 1;
  }

  patch(idx, field, value) {
    this.instructions[idx][field] = value;
  }

  // ── Main compile entry ───────────────────────────────────────

  compile(ast) {
    this.pushScope();
    for (const stmt of ast.body) {
      this.compileStatement(stmt);
    }
    this.popScope();
    // Always end with RETURN
    this.emit(this.ops['RETURN'], 0, 0);
    return { instructions: this.instructions, constants: this.constants };
  }

  // ── Statements ───────────────────────────────────────────────

  compileStatement(node) {
    if (!node) return;
    switch (node.type) {
      case 'LocalStatement':       return this.compileLocalStatement(node);
      case 'AssignmentStatement':  return this.compileAssignment(node);
      case 'CallStatement':        return this.compileCallStatement(node);
      case 'IfStatement':          return this.compileIf(node);
      case 'WhileStatement':       return this.compileWhile(node);
      case 'NumericForStatement':  return this.compileNumericFor(node);
      case 'GenericForStatement':  return this.compileGenericFor(node);
      case 'ReturnStatement':      return this.compileReturn(node);
      case 'FunctionDeclaration':  return this.compileFunctionDecl(node);
      case 'DoStatement':
        this.pushScope();
        for (const s of node.body) this.compileStatement(s);
        this.popScope();
        return;
      case 'RepeatStatement':      return this.compileRepeat(node);
      case 'BreakStatement':
        this.emit(this.ops['JMP'], 0, 0); // will be patched by loop handlers
        return;
      default:
        // Silently skip unknown nodes
        return;
    }
  }

  compileLocalStatement(node) {
    const regs = [];
    // Compile init expressions first
    const vals = node.init || [];
    const tmpRegs = [];
    for (let i = 0; i < vals.length; i++) {
      const r = this.allocReg();
      tmpRegs.push(r);
      this.compileExpression(node.init[i], r);
    }
    // Free tmp regs
    for (let i = tmpRegs.length - 1; i >= 0; i--) this.freeReg();

    // Declare locals
    for (let i = 0; i < node.variables.length; i++) {
      const reg = this.declareLocal(node.variables[i].name);
      regs.push(reg);
      if (i < vals.length) {
        this.compileExpression(vals[i], reg);
      } else {
        this.emit(this.ops['LOADNIL'], reg, 0);
      }
    }
  }

  compileAssignment(node) {
    for (let i = 0; i < node.variables.length; i++) {
      const varNode = node.variables[i];
      const valNode = node.init[i] || null;
      const tmpReg = this.allocReg();

      if (valNode) {
        this.compileExpression(valNode, tmpReg);
      } else {
        this.emit(this.ops['LOADNIL'], tmpReg, 0);
      }

      if (varNode.type === 'Identifier') {
        const local = this.resolveLocal(varNode.name);
        if (local !== null) {
          this.emit(this.ops['MOVE'], local, tmpReg);
        } else {
          const k = this.addConstant(varNode.name);
          this.emit(this.ops['SETGLOBAL'], tmpReg, k);
        }
      } else if (varNode.type === 'MemberExpression') {
        const tableReg = this.allocReg();
        this.compileExpression(varNode.base, tableReg);
        const keyK = this.addConstant(
          varNode.indexType === '.' ? varNode.identifier.name : null
        );
        this.emit(this.ops['SETTABLE'], tableReg, keyK, tmpReg);
        this.freeReg();
      } else if (varNode.type === 'IndexExpression') {
        const tableReg = this.allocReg();
        this.compileExpression(varNode.base, tableReg);
        const keyReg = this.allocReg();
        this.compileExpression(varNode.index, keyReg);
        this.emit(this.ops['SETTABLE'], tableReg, keyReg, tmpReg);
        this.freeReg();
        this.freeReg();
      }

      this.freeReg();
    }
  }

  compileCallStatement(node) {
    const tmpReg = this.allocReg();
    this.compileCallExpression(node.expression, tmpReg);
    this.freeReg();
  }

  compileIf(node) {
    const condReg = this.allocReg();
    this.compileExpression(node.condition, condReg);
    const testIdx = this.emit(this.ops['TEST'], condReg, 0);
    const jmpIdx  = this.emit(this.ops['JMP'], 0, 0);
    this.freeReg();

    this.pushScope();
    for (const s of node.consequent) this.compileStatement(s);
    this.popScope();

    const endJmps = [];
    if (node.alternate && node.alternate.length > 0) {
      endJmps.push(this.emit(this.ops['JMP'], 0, 0));
    }

    // Patch the initial jump
    this.patch(jmpIdx, 'b', this.instructions.length);

    // Compile else/elseif
    if (node.alternate) {
      if (node.alternate.length === 1 && node.alternate[0].type === 'IfStatement') {
        this.compileIf(node.alternate[0]);
      } else {
        this.pushScope();
        for (const s of node.alternate) this.compileStatement(s);
        this.popScope();
      }
    }

    for (const j of endJmps) {
      this.patch(j, 'b', this.instructions.length);
    }
  }

  compileWhile(node) {
    const loopStart = this.instructions.length;
    const condReg = this.allocReg();
    this.compileExpression(node.condition, condReg);
    this.emit(this.ops['TEST'], condReg, 0);
    const exitJmp = this.emit(this.ops['JMP'], 0, 0);
    this.freeReg();

    this.pushScope();
    for (const s of node.body) this.compileStatement(s);
    this.popScope();

    this.emit(this.ops['JMP'], 0, loopStart);
    this.patch(exitJmp, 'b', this.instructions.length);
  }

  compileRepeat(node) {
    const loopStart = this.instructions.length;
    this.pushScope();
    for (const s of node.body) this.compileStatement(s);
    this.popScope();

    const condReg = this.allocReg();
    this.compileExpression(node.condition, condReg);
    this.emit(this.ops['TEST'], condReg, 0);
    this.emit(this.ops['JMP'], 0, loopStart);
    this.freeReg();
  }

  compileNumericFor(node) {
    const startReg = this.allocReg();
    const limitReg = this.allocReg();
    const stepReg  = this.allocReg();
    const iReg     = this.allocReg();

    this.compileExpression(node.start, startReg);
    this.compileExpression(node.limit, limitReg);
    if (node.step) {
      this.compileExpression(node.step, stepReg);
    } else {
      const oneK = this.addConstant(1);
      this.emit(this.ops['LOADK'], stepReg, oneK);
    }

    this.emit(this.ops['FORPREP'], startReg, 0);
    const loopStart = this.instructions.length;

    this.pushScope();
    // Declare loop variable
    const top = this.locals[this.locals.length - 1];
    top.push({ name: node.variable.name, reg: iReg });

    for (const s of node.body) this.compileStatement(s);
    this.popScope();

    this.emit(this.ops['FORLOOP'], startReg, loopStart);
    this.freeReg(); this.freeReg(); this.freeReg(); this.freeReg();
  }

  compileGenericFor(node) {
    const iterReg = this.allocReg();
    this.compileExpression(node.iterators[0], iterReg);
    this.emit(this.ops['TFORLOOP'], iterReg, node.variables.length);

    const loopStart = this.instructions.length;
    this.pushScope();
    for (const v of node.variables) {
      this.declareLocal(v.name);
    }
    for (const s of node.body) this.compileStatement(s);
    this.popScope();

    this.emit(this.ops['JMP'], 0, loopStart - 1);
    this.freeReg();
  }

  compileReturn(node) {
    if (!node.arguments || node.arguments.length === 0) {
      this.emit(this.ops['RETURN'], 0, 0);
      return;
    }
    const regs = [];
    for (const arg of node.arguments) {
      const r = this.allocReg();
      this.compileExpression(arg, r);
      regs.push(r);
    }
    this.emit(this.ops['RETURN'], regs[0], regs.length);
    for (let i = 0; i < regs.length; i++) this.freeReg();
  }

  compileFunctionDecl(node) {
    // For simplicity, treat as global assignment with a closure
    // Full closure support would require a separate chunk compiler
    const name = node.identifier
      ? (node.identifier.name || (node.identifier.base && node.identifier.base.name) || '__func')
      : '__anon';
    const k = this.addConstant(`__FUNC__${name}`);
    const reg = this.allocReg();
    this.emit(this.ops['LOADK'], reg, k);
    this.emit(this.ops['SETGLOBAL'], reg, this.addConstant(name));
    this.freeReg();
  }

  // ── Expressions ──────────────────────────────────────────────

  compileExpression(node, destReg) {
    if (!node) {
      this.emit(this.ops['LOADNIL'], destReg, 0);
      return;
    }
    switch (node.type) {
      case 'NumericLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral': {
        const k = this.addConstant(node.value);
        this.emit(this.ops['LOADK'], destReg, k);
        break;
      }
      case 'NilLiteral':
        this.emit(this.ops['LOADNIL'], destReg, 0);
        break;

      case 'VarargLiteral':
        this.emit(this.ops['VARARG'], destReg, 1);
        break;

      case 'Identifier': {
        const local = this.resolveLocal(node.name);
        if (local !== null) {
          this.emit(this.ops['MOVE'], destReg, local);
        } else {
          const k = this.addConstant(node.name);
          this.emit(this.ops['GETGLOBAL'], destReg, k);
        }
        break;
      }

      case 'MemberExpression': {
        const baseReg = this.allocReg();
        this.compileExpression(node.base, baseReg);
        const keyK = this.addConstant(node.identifier.name);
        this.emit(this.ops['GETTABLE'], destReg, baseReg, keyK);
        this.freeReg();
        break;
      }

      case 'IndexExpression': {
        const baseReg = this.allocReg();
        this.compileExpression(node.base, baseReg);
        const keyReg = this.allocReg();
        this.compileExpression(node.index, keyReg);
        this.emit(this.ops['GETTABLE'], destReg, baseReg, keyReg);
        this.freeReg();
        this.freeReg();
        break;
      }

      case 'BinaryExpression':
        this.compileBinary(node, destReg);
        break;

      case 'UnaryExpression':
        this.compileUnary(node, destReg);
        break;

      case 'LogicalExpression':
        this.compileLogical(node, destReg);
        break;

      case 'CallExpression':
      case 'StringCallExpression':
      case 'TableCallExpression':
        this.compileCallExpression(node, destReg);
        break;

      case 'TableConstructor':
        this.compileTable(node, destReg);
        break;

      case 'FunctionExpression':
        // Simplified: just load a placeholder
        this.emit(this.ops['LOADNIL'], destReg, 0);
        break;

      default:
        this.emit(this.ops['LOADNIL'], destReg, 0);
    }
  }

  compileBinary(node, destReg) {
    const leftReg  = this.allocReg();
    const rightReg = this.allocReg();
    this.compileExpression(node.left, leftReg);
    this.compileExpression(node.right, rightReg);

    const opMap = {
      '+':  'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV',
      '%':  'MOD', '^': 'POW', '..': 'CONCAT',
      '==': 'EQ',  '<': 'LT',  '<=': 'LE',
      '~=': 'EQ',  '>': 'LT',  '>=': 'LE',
    };

    const opName = opMap[node.operator] || 'ADD';
    let aReg = leftReg, bReg = rightReg;

    // For reversed operators, swap operands
    if (node.operator === '>' || node.operator === '>=') {
      [aReg, bReg] = [rightReg, leftReg];
    }

    this.emit(this.ops[opName], destReg, aReg, bReg);
    this.freeReg();
    this.freeReg();
  }

  compileUnary(node, destReg) {
    const argReg = this.allocReg();
    this.compileExpression(node.argument, argReg);
    const opMap = { '-': 'UNM', 'not': 'NOT', '#': 'LEN' };
    const opName = opMap[node.operator] || 'UNM';
    this.emit(this.ops[opName], destReg, argReg);
    this.freeReg();
  }

  compileLogical(node, destReg) {
    // Simplified: compile both sides, use TEST+JMP
    const leftReg = this.allocReg();
    this.compileExpression(node.left, leftReg);
    this.emit(this.ops['TEST'], leftReg, node.operator === 'and' ? 0 : 1);
    const jmpIdx = this.emit(this.ops['JMP'], 0, 0);
    this.emit(this.ops['MOVE'], destReg, leftReg);
    const endJmp = this.emit(this.ops['JMP'], 0, 0);
    this.patch(jmpIdx, 'b', this.instructions.length);
    const rightReg = this.allocReg();
    this.compileExpression(node.right, rightReg);
    this.emit(this.ops['MOVE'], destReg, rightReg);
    this.freeReg();
    this.patch(endJmp, 'b', this.instructions.length);
    this.freeReg();
  }

  compileCallExpression(node, destReg) {
    // Handle method calls (colon syntax)
    if (node.type === 'CallExpression' && node.base && node.base.type === 'MemberExpression' && node.base.indexType === ':') {
      const selfReg = this.allocReg();
      this.compileExpression(node.base.base, selfReg);
      const methodK = this.addConstant(node.base.identifier.name);
      this.emit(this.ops['SELF'], destReg, selfReg, methodK);
      const argStart = this.allocReg();
      for (const arg of node.arguments) {
        const r = this.allocReg();
        this.compileExpression(arg, r);
      }
      this.emit(this.ops['CALL'], destReg, node.arguments.length + 2, 2);
      for (let i = 0; i < node.arguments.length; i++) this.freeReg();
      this.freeReg();
      this.freeReg();
      return;
    }

    // Regular call
    const fnReg = this.allocReg();
    const base = node.base || node;
    this.compileExpression(base, fnReg);

    const argRegs = [];
    const args = node.arguments || node.args || [];
    for (const arg of args) {
      const r = this.allocReg();
      this.compileExpression(arg, r);
      argRegs.push(r);
    }

    this.emit(this.ops['CALL'], fnReg, args.length + 1, 2);
    this.emit(this.ops['MOVE'], destReg, fnReg);

    for (let i = 0; i < argRegs.length; i++) this.freeReg();
    this.freeReg();
  }

  compileTable(node, destReg) {
    this.emit(this.ops['NEWTABLE'], destReg, node.fields.length, 0);
    let arrayIdx = 1;
    for (const field of node.fields) {
      const valReg = this.allocReg();
      this.compileExpression(field.value, valReg);
      if (field.type === 'TableKey') {
        const keyReg = this.allocReg();
        this.compileExpression(field.key, keyReg);
        this.emit(this.ops['SETTABLE'], destReg, keyReg, valReg);
        this.freeReg();
      } else if (field.type === 'TableKeyString') {
        const keyK = this.addConstant(field.key.name);
        this.emit(this.ops['SETTABLE'], destReg, keyK, valReg);
      } else {
        // Array-style
        const keyK = this.addConstant(arrayIdx++);
        this.emit(this.ops['SETTABLE'], destReg, keyK, valReg);
      }
      this.freeReg();
    }
  }
}

module.exports = Compiler;
