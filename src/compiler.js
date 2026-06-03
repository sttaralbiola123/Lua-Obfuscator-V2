class LuaCompiler {
  constructor() {
    this.constants = [];
    this.bytecode = []; // array of numbers (32-bit packed)
  }

  compile(code) {
    this.constants = [];
    this.bytecode = [];
    const lines = code.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line === '' || line.startsWith('--')) continue;
      this.compileLine(line);
    }
    // RETURN opcode (21)
    this.emit(21, 0, 0, 0);
    return { bytecode: this.bytecode, constants: this.constants };
  }

  compileLine(line) {
    if (line.startsWith('print(')) {
      const match = line.match(/print\((.*)\)/);
      if (match) {
        const arg = match[1];
        const constIdx = this.addConstant(arg);
        this.emit(1, 0, constIdx, 0); // LOADK
        this.emit(20, 0, 1, 0);       // CALL
      }
    } else if (line.includes('=') && !line.includes('function')) {
      const [varName, value] = line.split('=');
      const constIdx = this.addConstant(value.trim());
      this.emit(1, 1, constIdx, 0);
      const globalIdx = this.addConstant(varName.trim());
      this.emit(18, 1, globalIdx, 0);
    } else if (line.startsWith('local function')) {
      const match = line.match(/local function (\w+)/);
      if (match) {
        const name = match[1];
        const idx = this.addConstant(name);
        this.emit(29, 1, idx, 0);  // CLOSURE
        this.emit(18, 1, idx, 0);  // SETGLOBAL
      }
    } else {
      // fallback: treat as expression
      const constIdx = this.addConstant(line);
      this.emit(1, 0, constIdx, 0);
    }
  }

  emit(op, a, b, c) {
    // Pack into 32-bit: op (6 bits), a (8 bits), b (9 bits), c (9 bits)
    const packed = (op & 0x3F) |
                  ((a & 0xFF) << 6) |
                  ((b & 0x1FF) << 14) |
                  ((c & 0x1FF) << 23);
    this.bytecode.push(packed);
  }

  addConstant(value) {
    let idx = this.constants.indexOf(value);
    if (idx === -1) {
      idx = this.constants.length;
      this.constants.push(value);
    }
    return idx;
  }
}

module.exports = { LuaCompiler };
