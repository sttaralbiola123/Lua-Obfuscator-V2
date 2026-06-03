class LuaCompiler {
    constructor() {
        this.constants = [];
        this.bytecode = [];
        this.registers = {};
        this.nextReg = 0;
    }
    
    compile(code) {
        this.constants = [];
        this.bytecode = [];
        this.registers = {};
        this.nextReg = 0;
        
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            this.compileLine(lines[i], i);
        }
        
        return {
            bytecode: this.bytecode,
            constants: this.constants
        };
    }
    
    compileLine(line, lineNum) {
        line = line.trim();
        if (!line || line.startsWith('--')) return;
        
        if (line.includes('print(')) {
            this.compilePrint(line);
        } else if (line.includes('local function')) {
            this.compileFunction(line);
        } else if (line.includes('function')) {
            this.compileFunction(line);
        } else if (line.includes('return')) {
            this.compileReturn(line);
        } else if (line.includes('=')) {
            this.compileAssignment(line);
        } else if (line.includes('if')) {
            this.compileCondition(line);
        } else if (line.includes('for')) {
            this.compileLoop(line);
        } else if (line.includes('while')) {
            this.compileLoop(line);
        } else if (line.includes('call')) {
            this.compileCall(line);
        } else {
            this.compileExpression(line);
        }
    }
    
    compilePrint(line) {
        const match = line.match(/print\((.*)\)/);
        if (match) {
            const arg = match[1];
            const constIdx = this.addConstant(arg);
            
            this.bytecode.push({
                op: 1,
                a: this.getRegister(),
                b: constIdx,
                c: 0
            });
            
            this.bytecode.push({
                op: 19,
                a: this.getRegister(),
                b: 1,
                c: 0
            });
        }
    }
    
    compileFunction(line) {
        const match = line.match(/function\s+(\w+)\s*\((.*?)\)/);
        if (match) {
            const funcName = match[1];
            const params = match[2].split(',').map(p => p.trim());
            
            const constIdx = this.addConstant(funcName);
            
            this.bytecode.push({
                op: 21,
                a: this.getRegister(),
                b: constIdx,
                c: 0
            });
            
            this.bytecode.push({
                op: 18,
                a: this.getRegister(),
                b: this.getRegister(),
                c: 0
            });
        }
    }
    
    compileReturn(line) {
        const match = line.match(/return\s+(.+)/);
        if (match) {
            const value = match[1];
            const constIdx = this.addConstant(value);
            
            this.bytecode.push({
                op: 1,
                a: this.getRegister(),
                b: constIdx,
                c: 0
            });
            
            this.bytecode.push({
                op: 20,
                a: this.getRegister(),
                b: 1,
                c: 0
            });
        } else {
            this.bytecode.push({
                op: 20,
                a: 0,
                b: 0,
                c: 0
            });
        }
    }
    
    compileAssignment(line) {
        const match = line.match(/(\w+)\s*=\s*(.+)/);
        if (match) {
            const varName = match[1];
            const value = match[2];
            
            const constIdx = this.addConstant(value);
            const reg = this.getRegister();
            
            this.bytecode.push({
                op: 1,
                a: reg,
                b: constIdx,
                c: 0
            });
            
            const globalIdx = this.addConstant(varName);
            this.bytecode.push({
                op: 18,
                a: reg,
                b: globalIdx,
                c: 0
            });
        }
    }
    
    compileCondition(line) {
        this.bytecode.push({
            op: 11,
            a: 0,
            b: 0,
            c: 0
        });
    }
    
    compileLoop(line) {
        this.bytecode.push({
            op: 22,
            a: 0,
            b: 0,
            c: 0
        });
    }
    
    compileCall(line) {
        this.bytecode.push({
            op: 19,
            a: this.getRegister(),
            b: 1,
            c: 0
        });
    }
    
    compileExpression(line) {
        const constIdx = this.addConstant(line);
        this.bytecode.push({
            op: 1,
            a: this.getRegister(),
            b: constIdx,
            c: 0
        });
    }
    
    addConstant(value) {
        let idx = this.constants.indexOf(value);
        if (idx === -1) {
            idx = this.constants.length;
            this.constants.push(value);
        }
        return idx;
    }
    
    getRegister() {
        this.nextReg++;
        return this.nextReg - 1;
    }
}

module.exports = { LuaCompiler };
