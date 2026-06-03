// src/vmgen.js
// ULTRA SECURE VERSION: Almost impossible to unobfuscate/read
// VM that changes shape and secrets on every compile

'use strict';

const { generateOpaquePredicates } = require('./junk');

function randomVar(prefix = '_', length = null) {
  const firstChars = 'lIiOoUuVvWwXxYyZzAaBbCcDdEeFfGgHhJjKkMmNnPpQqRrSsTt';
  const restChars = 'lIiOo0123456789UuVvWwXxYyZzAaBbCcDdEeFfGgHhJjKkMmNnPpQqRrSsTt';
  
  let name = prefix;
  name += firstChars[Math.floor(Math.random() * firstChars.length)];
  
  const len = length || (Math.floor(Math.random() * 8) + 5);
  
  for (let i = 1; i < len; i++) {
    name += restChars[Math.floor(Math.random() * restChars.length)];
  }
  
  name += Math.floor(Math.random() * 999999999).toString(36);
  return name;
}

function generateHardPredicate() {
  const type = Math.random() > 0.5 ? 'true' : 'false';
  const a = Math.floor(Math.random() * 10000) + 1000;
  const b = Math.floor(Math.random() * 10000) + 1000;
  const c = Math.floor(Math.random() * 10000) + 1000;
  const d = Math.floor(Math.random() * 10000) + 1000;

  if (type === 'true') {
    return `(((${a} * ${b}) - (${c} * ${d}) + (${c-d})) == ((-${d} * ${c}) + ${a*b} + ${c-d}))`;
  } else {
    return `(((${a} + ${b}) * ${c}) == (${a*c} + ${b*c + 1}))`;
  }
}

function obfuscateMath(expr, op) {
  if (!expr || typeof expr !== 'string') {
    return `(${expr})`;
  }
  
  const patterns = {
    '+': [
      '(({0} | {1}) + ({0} & {1}))',
      '(({0} ~ -{1}) + (({0} & {1}) << 1))',
      '(({0} * 1) + ({1} * 1))'
    ],
    '-': [
      '(({0} + (-{1})))',
      '(({0} ~ {1}) - ((-{0} & {1}) << 1))'
    ],
    '*': [
      '(({0} << 0) * ({1} << 0))',
      'math.floor(({0}) * ({1}) + 0.0)'
    ],
    '/': [
      '(({0}) / (({1}) ~~ 0 + 1))',
      'math.floor(({0}) / (({1}) == 0 and 1 or ({1})))'
    ]
  };

  const list = patterns[op] || [`(${expr})`];
  
  const splitIndex = expr.indexOf(op);
  if (splitIndex === -1) {
    return `(${expr})`;
  }
  
  const left = expr.substring(0, splitIndex).trim();
  const right = expr.substring(splitIndex + 1).trim();
  
  return list[Math.floor(Math.random() * list.length)]
    .replace('{0}', left)
    .replace('{1}', right);
}

function generateVM(opcodeTable, encryptedBytecode, encryptedConstants, decryptorLua, options = {}) {
  const { nameToNum } = opcodeTable;

  const V = {};
  const symbols = [
    'vm','bc','kst','stack','pc','inst','op','a','b','c','dispatch','env','i','tmp','tmp2',
    'running','decode','decodeK','parseNum','readBytes','tonum','encBC','encKST','ctx','mem',
    'handler','state','val','key','tbl','fn','args','res','n','len','tag','s','p1','p2','p3','p4'
  ];
  symbols.forEach(sym => V[sym] = randomVar('_'));

  const decPrefix = randomVar('x', 8);

  let patchedDecryptor = decryptorLua
    .replace(/\bB_k1\b/g, `${decPrefix}k1`)
    .replace(/\bB_k2\b/g, `${decPrefix}k2`)
    .replace(/\bB_rm\b/g, `${decPrefix}rm`)
    .replace(/\bB_decode\b/g, `${decPrefix}decode`);

  const hardPreds = Array(8).fill(0).map(() => generateHardPredicate());
  const simplePreds = generateOpaquePredicates(10);
  const preds = [...hardPreds, ...simplePreds].sort(() => Math.random() - 0.5);

  const ops = nameToNum;
  const randomLoopCount = Math.floor(Math.random() * 200) + 50;

  const escapeStr = (str) => str.replace(/"/g, '\\"');

  const parseNumVariants = [
    `local ${V.val}=(${V.b}[${V.i}] or 0)*16777216 + (${V.b}[${V.i}+1] or 0)*65536 + (${V.b}[${V.i}+2] or 0)*256 + (${V.b}[${V.i}+3] or 0)`,
    `local ${V.val}=0;do local _=${V.b}[${V.i}] or 0;${V.val}=_*16777216;end;do local _=${V.b}[${V.i}+1] or 0;${V.val}=${V.val}+_*65536;end;do local _=${V.b}[${V.i}+2] or 0;${V.val}=${V.val}+_*256;end;do local _=${V.b}[${V.i}+3] or 0;${V.val}=${V.val}+_;end`,
    `local ${V.val}=bit32.lshift(${V.b}[${V.i}] or 0, 24) + bit32.lshift(${V.b}[${V.i}+1] or 0, 16) + bit32.lshift(${V.b}[${V.i}+2] or 0, 8) + (${V.b}[${V.i}+3] or 0)`
  ];
  const chosenParseNum = parseNumVariants[Math.floor(Math.random() * parseNumVariants.length)];

  const vm = `
-- Protected by: Sttar Albiola
-- Facebook: Sttar Albiola

local ${V.encBC}="${encryptedBytecode}"
local ${V.encKST}="${encryptedConstants}"

${patchedDecryptor}

if (${preds[0]}) then
  local ${randomVar('z')} = {[0]=-1, [1]=2, [2]=-3}
  local ${randomVar('i')} = 0
  for ${randomVar('x')}=1, ${Math.floor(Math.random() * 500) + 100} do
    ${randomVar('i')} = (${randomVar('i')} + ${randomVar('x')}) % 9999
    if (${preds[1]}) then
      ${randomVar('z')}[${randomVar('i') % 3}] = ${randomVar('x')} * ${randomVar('i')}
    end
  end
end

local function ${V.parseNum}(${V.b},${V.i})
  ${chosenParseNum}
  return ${V.val}, ${V.i}+4
end

local function ${V.decodeK}(${V.b})
  local ${V.kst}={}
  local ${V.i}=1
  local ${V.a},_=${V.parseNum}(${V.b},${V.i})
  ${V.i}=${V.i}+4
  local ${V.tmp}=${V.a}
  for ${V.op}=1,${V.tmp} do
    local len,_=${V.parseNum}(${V.b},${V.i})
    ${V.i}=${V.i}+4
    local tag=${V.b}[${V.i}] or 0
    ${V.i}=${V.i}+1
    
    if (${preds[2]} and tag==0) then
      ${V.kst}[${V.op}]=nil
    elseif ((not ${preds[3]}) and tag==1) then
      ${V.kst}[${V.op}]=(${V.b}[${V.i}] or 0)==1
      ${V.i}=${V.i}+1
    elseif tag==2 or tag==3 then
      local slen,_=${V.parseNum}(${V.b},${V.i})
      ${V.i}=${V.i}+4
      local s=""
      for ${V.tmp2}=1,slen do
        local c=${V.b}[${V.i}] or 0
        c = bit32.bxor(c, ${Math.floor(Math.random() * 250) + 1})
        s=s..string.char(c)
        ${V.i}=${V.i}+1
      end
      ${V.kst}[${V.op}]=tag==2 and tonumber(s) or s
    else
      ${V.kst}[${V.op}]=nil
    end
    
    if (${preds[4]}) then local _ = {}; _.x = ${V.op} + len; end
  end
  return ${V.kst}
end

local function ${V.readBytes}(${V.b})
  local instList={}
  local ${V.i}=1
  local count,_=${V.parseNum}(${V.b},${V.i})
  ${V.i}=${V.i}+4
  for ${V.op}=1,count do
    local full,_=${V.parseNum}(${V.b},${V.i})
    ${V.i}=${V.i}+4
    local opcode = bit32.extract(full, 0, 6)
    local regA = bit32.extract(full, 6, 8)
    local regB = bit32.extract(full, 14, 9)
    local regC = bit32.extract(full, 23, 9)
    instList[${V.op}] = {op=opcode,a=regA,b=regB,c=regC}
    
    if (${preds[5]}) then
      local x = opcode + regA + regB + regC
      x = x * 2
      x = x / 2
    end
  end
  return instList
end

do
  local ${randomVar('d')}=true
  if (${preds[6]}) then
    for ${randomVar('k')}=1,${randomLoopCount} do
      local a=math.random(1,1000)
      local b=math.random(1,1000)
      local c=a+b
      c=a-b
      c=a*b
      c=a/b
    end
  end
end

local ${V.bc}=${V.readBytes}(${decPrefix}decode(${V.encBC}))
local ${V.kst}=${V.decodeK}(${decPrefix}decode(${V.encKST}))
local ${V.stack}={}
local ${V.env}=getfenv and getfenv(1) or _G
local ${V.pc}=1
local ${V.running}=true

local ${V.dispatch}={
  [${ops['LOADK']}]=function(${V.a},${V.b},${V.c})
    ${V.stack}[${V.a}]=${V.kst}[(${obfuscateMath(`${V.b} + 1`, '+')})]
  end,
  [${ops['LOADNIL']}]=function(${V.a},${V.b},${V.c})
    for ${V.i}=${V.a},${V.b} do ${V.stack}[${V.i}]=nil end
  end,
  [${ops['LOADBOOL']}]=function(${V.a},${V.b},${V.c})
    ${V.stack}[${V.a}]=(${obfuscateMath(`${V.b} ~= 0`, '*')})
    if ${V.c}~=0 then ${V.pc}=(${obfuscateMath(`${V.pc} + 1`, '+')}) end
  end,
  [${ops['MOVE']}]=function(${V.a},${V.b},${V.c})
    ${V.stack}[${V.a}]=${V.stack}[${V.b}]
  end,
  [${ops['GETGLOBAL']}]=function(${V.a},${V.b},${V.c})
    local k=${V.kst}[(${obfuscateMath(`${V.b} + 1`, '+')})]
    ${V.stack}[${V.a}]=${V.env}[k]
  end,
  [${ops['SETGLOBAL']}]=function(${V.a},${V.b},${V.c})
    local k=${V.kst}[(${obfuscateMath(`${V.b} + 1`, '+')})]
    ${V.env}[k]=${V.stack}[${V.a}]
  end,
  [${ops['GETTABLE']}]=function(${V.a},${V.b},${V.c})
    local tbl=${V.stack}[${V.b}]
    local key=(${V.c}>=256) and ${V.kst}[(${obfuscateMath(`${V.c} - 255`, '-')})] or ${V.stack}[${V.c}]
    if tbl~=nil and type(tbl)=="table" then ${V.stack}[${V.a}]=tbl[key] else ${V.stack}[${V.a}]=nil end
  end,
  [${ops['SETTABLE']}]=function(${V.a},${V.b},${V.c})
    local tbl=${V.stack}[${V.a}]
    local key=(${V.b}>=256) and ${V.kst}[(${obfuscateMath(`${V.b} - 255`, '-')})] or ${V.stack}[${V.b}]
    local val=(${V.c}>=256) and ${V.kst}[(${obfuscateMath(`${V.c} - 255`, '-')})] or ${V.stack}[${V.c}]
    if tbl~=nil and type(tbl)=="table" then tbl[key]=val end
  end,
  [${ops['NEWTABLE']}]=function(${V.a},${V.b},${V.c})${V.stack}[${V.a}] = {} end,
  [${ops['SELF']}]=function(${V.a},${V.b},${V.c})
    local tbl=${V.stack}[${V.b}]
    local key=${V.kst}[(${obfuscateMath(`${V.c} + 1`, '+')})]
    ${V.stack}[${V.a}+1]=tbl
    ${V.stack}[${V.a}]=tbl and tbl[key] or nil
  end,
  [${ops['ADD']}]=function(${V.a},${V.b},${V.c})
    local x=${V.stack}[${V.b}] or 0 local y=${V.stack}[${V.c}] or 0
    ${V.stack}[${V.a}]=(${obfuscateMath('x + y', '+')})
  end,
  [${ops['SUB']}]=function(${V.a},${V.b},${V.c})
    local x=${V.stack}[${V.b}] or 0 local y=${V.stack}[${V.c}] or 0
    ${V.stack}[${V.a}]=(${obfuscateMath('x - y', '-')})
  end,
  [${ops['MUL']}]=function(${V.a},${V.b},${V.c})
    local x=${V.stack}[${V.b}] or 0 local y=${V.stack}[${V.c}] or 0
    ${V.stack}[${V.a}]=(${obfuscateMath('x * y', '*')})
  end,
  [${ops['DIV']}]=function(${V.a},${V.b},${V.c})
    local x=${V.stack}[${V.b}] or 0 local y=${V.stack}[${V.c}] or 1
    ${V.stack}[${V.a}]=(${obfuscateMath('x / y', '/')})
  end,
  [${ops['MOD']}]=function(${V.a},${V.b},${V.c})
    local x=${V.stack}[${V.b}] or 0 local y=${V.stack}[${V.c}] or 1
    ${V.stack}[${V.a}]=math.fmod(x, (y==0 and 1 or y))
  end,
  [${ops['POW']}]=function(${V.a},${V.b},${V.c})
    local x=${V.stack}[${V.b}] or 0 local y=${V.stack}[${V.c}] or 0
    ${V.stack}[${V.a}]=x^y
  end,
  [${ops['UNM']}]=function(${V.a},${V.b},${V.c})
    ${V.stack}[${V.a}]=-(${V.stack}[${V.b}] or 0)
  end,
  [${ops['NOT']}]=function(${V.a},${V.b},${V.c})
    ${V.stack}[${V.a}]=not not ${V.stack}[${V.b}]
  end,
  [${ops['LEN']}]=function(${V.a},${V.b},${V.c})
    local val=${V.stack}[${V.b}] or ""
    ${V.stack}[${V.a}]=(type(val)=="table" or type(val)=="string") and #val or 0
  end,
  [${ops['CONCAT']}]=function(${V.a},${V.b},${V.c})
    local parts={}
    for ${V.i}=${V.b},${V.c} do parts[#parts+1]=tostring(${V.stack}[${V.i}] or "")end
    ${V.stack}[${V.a}]=table.concat(parts)
  end,
  [${ops['JMP']}]=function(${V.a},${V.b},${V.c})
    ${V.pc}=(${obfuscateMath(`${V.pc} + ${V.b} - 1`, '+')})
  end,
  [${ops['EQ']}]=function(${V.a},${V.b},${V.c})
    local res=(${V.stack}[${V.b}]==${V.stack}[${V.c}]) if res~=(${V.a}~=0) then ${V.pc}=${V.pc}+1 end
  end,
  [${ops['LT']}]=function(${V.a},${V.b},${V.c})
    local res=(${V.stack}[${V.b}]<${V.stack}[${V.c}]) if res~=(${V.a}~=0) then ${V.pc}=${V.pc}+1 end
  end,
  [${ops['LE']}]=function(${V.a},${V.b},${V.c})
    local res=(${V.stack}[${V.b}]<=${V.stack}[${V.c}]) if res~=(${V.a}~=0) then ${V.pc}=${V.pc}+1 end
  end,
  [${ops['TEST']}]=function(${V.a},${V.b},${V.c})
    local res=not not ${V.stack}[${V.a}] if res==(${V.b}~=0) then ${V.pc}=${V.pc}+1 end
  end,
  [${ops['CALL']}]=function(${V.a},${V.b},${V.c})
    local fn=${V.stack}[${V.a}]
    if type(fn)~="function" then return end
    local args={}
    local nargs=${V.b}-1
    for ${V.i}=1,nargs do args[${V.i}]=${V.stack}[${V.a}+${V.i}]end
    local callRes={pcall(fn,(unpack or table.unpack)(args))}
    local ok=callRes[1]
    if ok then
      local nres=${V.c}==0 and math.max(#callRes-1,1) or ${V.c}
      for ${V.i}=1,nres do ${V.stack}[${V.a}+${V.i}-1]=callRes[${V.i}+1] end
    end
  end,
  [${ops['RETURN']}]=function(${V.a},${V.b},${V.c})${V.running}=false end,
  [${ops['FORPREP']}]=function(${V.a},${V.b},${V.c})
    local init=${V.stack}[${V.a}] or 0
    local step=${V.stack}[${V.a}+2] or 1
    ${V.stack}[${V.a}]=(${obfuscateMath('init - step', '-')})
  end,
  [${ops['FORLOOP']}]=function(${V.a},${V.b},${V.c})
    local idx=${V.stack}[${V.a}] or 0
    local limit=${V.stack}[${V.a}+1] or 0
    local step=${V.stack}[${V.a}+2] or 1
    idx=(${obfuscateMath('idx + step', '+')})
    local ok=(step>=0 and idx<=limit) or (step<0 and idx>=limit)
    if ok then
      ${V.stack}[${V.a}]=idx
      ${V.stack}[${V.a}+3]=idx
      ${V.pc}=(${obfuscateMath(`${V.pc} + ${V.b} - 1`, '+')})
    end
  end,
  [${ops['TFORLOOP']}]=function(${V.a},${V.b},${V.c})
    local fn=${V.stack}[${V.a}]
    local state=${V.stack}[${V.a}+1]
    local ctrl=${V.stack}[${V.a}+2]
    if type(fn)=="function" then
      local res={pcall(fn,state,ctrl)}
      if res[1] and res[2]~=nil then
        ${V.stack}[${V.a}+2]=res[2]
        for ${V.i}=1,${V.b} do ${V.stack}[${V.a}+2+${V.i}]=res[${V.i}+1]end
      else
        ${V.pc}=${V.pc}+1
      end
    end
  end,
  [${ops['CLOSURE']}]=function(${V.a},${V.b},${V.c})
    ${V.stack}[${V.a}]=function(...) return end
  end,
  [${ops['VARARG']}]=function(${V.a},${V.b},${V.c})
    local args={...}
    for ${V.i}=1,${V.b} do ${V.stack}[${V.a}+${V.i}-1]=args[${V.i}] end
  end,
}

if not bit32 then bit32={
  extract=function(x,f,w) return math.floor(x/(2^f))%(2^w) end,
  lshift=function(x,n) return x*(2^n) end,
  bxor=function(a,b) return a~=b and 1 or 0 end
} end

while (${V.running} and ${V.pc}<=#${V.bc} and ${preds[7]}) do
  ${V.inst}=${V.bc}[${V.pc}]
  ${V.pc}=${V.pc}+1
  if ${V.inst} and ${preds[8]} then
    ${V.op}=${V.inst}.op
    ${V.a}=${V.inst}.a or 0
    ${V.b}=${V.inst}.b or 0
    ${V.c}=${V.inst}.c or 0
    local ${V.tmp}=${V.dispatch}[${V.op}]
    if ${V.tmp} and ${preds[9]} then ${V.tmp}(${V.a},${V.b},${V.c})end
  end
end
`;

  return vm;
}

module.exports = { generateVM, randomVar };
