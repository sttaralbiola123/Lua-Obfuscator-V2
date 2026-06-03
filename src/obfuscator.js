const { LuaCompiler } = require('./compiler');
const { generateEncryptionKeys, encryptData, generateDecryptor } = require('./encryptor');
const { generateVM } = require('./vmgen');
const { nameToNum } = require('./opcodes');

async function obfuscateLua(luaCode) {
    try {
        const compiler = new LuaCompiler();
        const compiled = compiler.compile(luaCode);
        
        const { bytecode, constants } = compiled;
        
        const bcStr = JSON.stringify(bytecode);
        const constStr = JSON.stringify(constants);
        
        const { key1: bcKey1, key2: bcKey2 } = generateEncryptionKeys();
        const { key1: constKey1, key2: constKey2 } = generateEncryptionKeys();
        
        const charMap = {
            "0":"e","1":"p","2":"8","3":"6","4":"S","5":"j","6":"b","7":"u","8":"Y","9":"a",
            "j":"A","C":"B","z":"C","n":"D","h":"E","o":"F","w":"G","K":"H","Q":"I","+":"J",
            "O":"K","g":"L","E":"M","p":"N","b":"O","u":"P","L":"Q","Z":"R","Y":"T","e":"U",
            "c":"V","x":"W","T":"X","r":"Z","J":"c","S":"d","H":"f","q":"g","I":"h","l":"i",
            "U":"k","a":"l","M":"m","N":"n","R":"o","f":"q","d":"r","F":"s","m":"t","y":"v",
            "k":"w","X":"x","t":"y","V":"z","A":"0","D":"1","/":"2","P":"3","G":"4","v":"5",
            "W":"7","s":"9","i":"+","B":"/"
        };
        
        const encryptedBC = encryptData(bcStr, bcKey1, bcKey2);
        const encryptedConst = encryptData(constStr, constKey1, constKey2);
        
        const decryptorBC = generateDecryptor(bcKey1, bcKey2, charMap);
        const decryptorConst = generateDecryptor(constKey1, constKey2, charMap);
        
        const combinedDecryptor = decryptorBC;
        
        const opcodeTable = { nameToNum };
        
        const vmCode = generateVM(opcodeTable, encryptedBC, encryptedConst, combinedDecryptor);
        
        return vmCode;
    } catch (error) {
        throw new Error(`Obfuscation failed: ${error.message}`);
    }
}

module.exports = { obfuscateLua };
