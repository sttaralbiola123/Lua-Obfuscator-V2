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
  const type = Math.random() > 0.5;
  const a = Math.floor(Math.random() * 10000) + 1000;
  const b = Math.floor(Math.random() * 10000) + 1000;
  const c = Math.floor(Math.random() * 10000) + 1000;
  const d = Math.floor(Math.random() * 10000) + 1000;

  if (type) {
    return `(((${a} * ${b}) - (${c} * ${d}) + (${c-d})) == ((-${d} * ${c}) + ${a*b} + ${c-d}))`;
  } else {
    return `(((${a} + ${b}) * ${c}) == (${a*c} + ${b*c + 1}))`;
  }
}

function generateVM(opcodeTable, encryptedBytecode, encryptedConstants, decryptorLua) {
  const { nameToNum } = opcodeTable;
  const V = {};
  const symbols = ['bc','kst','stack','pc','inst','op','a','b','c','dispatch','env','i','running','decodeK','parseNum','readBytes'];
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

  return `
-- Protected by: Sttar Albiola
-- Facebook: Sttar Albiola

local ${V.encBC}="${encryptedBytecode}"
local ${V.encKST}="${encryptedConstants}"

${patchedDecryptor}

local function ${V.parseNum}(${V.b},${V.i})
  local val=(${V.b}[${V.i}]or 0)*16777216+(${V.b}[${V.i}+1]or 0)*65536+(${V.b}[${V.i}+2]or 0)*256+(${V.b}[${V.i}+3]or 0)
  return val,${V.i}+4
end

local function ${V.decodeK}(${V.b})
  local kst={}
  local i=1
  local a,_=${V.parseNum}(${V.b},i)
  i=i+4
  for op=1,a do
    local len,_=${V.parseNum}(${V.b},i)
    i=i+4
    local tag=${V.b}[i]or 0
    i=i+1
    if tag==0 then
      kst[op]=nil
    elseif tag==1 then
      kst[op]=(${V.b}[i]or 0)==1
      i=i+1
    elseif tag==2 or tag==3 then
      local slen,_=${V.parseNum}(${V.b},i)
      i=i+4
      local s=""
      for _=1,slen do
        local c=${V.b}[i]or 0
        c=bit32.bxor(c,${Math.floor(Math.random()*250)+1})
        s=s..string.char(c)
        i=i+1
      end
      kst[op]=tag==2 and tonumber(s)or s
    end
  end
  return kst
end

local function ${V.readBytes}(${V.b})
  local list={}
  local i=1
  local count,_=${V.parseNum}(${V.b},i)
  i=i+4
  for op=1,count do
    local full,_=${V.parseNum}(${V.b},i)
    i=i+4
    local opcode=bit32.extract(full,0,6)
    local regA=bit32.extract(full,6,8)
    local regB=bit32.extract(full,14,9)
    local regC=bit32.extract(full,23,9)
    list[op]={op=opcode,a=regA,b=regB,c=regC}
  end
  return list
end

local bc=${V.readBytes}(${decPrefix}decode(${V.encBC}))
local kst=${V.decodeK}(${decPrefix}decode(${V.encKST}))
local stack={}
local env=getfenv and getfenv(1)or _G
local pc=1
local running=true

local dispatch={
  [${ops.LOADK}]=function(a,b,c)stack[a]=kst[b+1]end,
  [${ops.LOADNIL}]=function(a,b,c)for i=a,b do stack[i]=nil end end,
  [${ops.LOADBOOL}]=function(a,b,c)stack[a]=b~=0 if c~=0 then pc=pc+1 end end,
  [${ops.MOVE}]=function(a,b,c)stack[a]=stack[b]end,
  [${ops.GETGLOBAL}]=function(a,b,c)stack[a]=env[kst[b+1]]end,
  [${ops.SETGLOBAL}]=function(a,b,c)env[kst[b+1]]=stack[a]end,
  [${ops.GETTABLE}]=function(a,b,c)local tbl=stack[b]local key=(c>=256)and kst[c-255]or stack[c]stack[a]=tbl and tbl[key]or nil end,
  [${ops.SETTABLE}]=function(a,b,c)local tbl=stack[a]local key=(b>=256)and kst[b-255]or stack[b]local val=(c>=256)and kst[c-255]or stack[c]if tbl then tbl[key]=val end end,
  [${ops.NEWTABLE}]=function(a,b,c)stack[a]={}end,
  [${ops.ADD}]=function(a,b,c)stack[a]=(stack[b]or 0)+(stack[c]or 0)end,
  [${ops.SUB}]=function(a,b,c)stack[a]=(stack[b]or 0)-(stack[c]or 0)end,
  [${ops.MUL}]=function(a,b,c)stack[a]=(stack[b]or 0)*(stack[c]or 0)end,
  [${ops.DIV}]=function(a,b,c)stack[a]=(stack[b]or 0)/(stack[c]or 1)end,
  [${ops.MOD}]=function(a,b,c)stack[a]=math.fmod(stack[b]or 0,(stack[c]or 1)==0 and 1 or(stack[c]or 1))end,
  [${ops.POW}]=function(a,b,c)stack[a]=(stack[b]or 0)^(stack[c]or 0)end,
  [${ops.EQ}]=function(a,b,c)if(stack[b]==stack[c])~=(a~=0)then pc=pc+1 end end,
  [${ops.LT}]=function(a,b,c)if(stack[b]<stack[c])~=(a~=0)then pc=pc+1 end end,
  [${ops.LE}]=function(a,b,c)if(stack[b]<=stack[c])~=(a~=0)then pc=pc+1 end end,
  [${ops.JMP}]=function(a,b,c)pc=pc+b-1 end,
  [${ops.CALL}]=function(a,b,c)local fn=stack[a]if type(fn)~="function"then return end local args={}for i=1,b-1 do args[i]=stack[a+i]end local ok,res=pcall(fn,table.unpack(args))if ok then local nres=c==0 and 1 or c for i=1,nres do stack[a+i-1]=res end end end,
  [${ops.RETURN}]=function(a,b,c)running=false end,
  [${ops.CLOSURE}]=function(a,b,c)stack[a]=function()end end,
}

if not bit32 then bit32={extract=function(x,f,w)return math.floor(x/(2^f))%(2^w)end}end

while running and pc<=#bc do
  local inst=bc[pc]
  pc=pc+1
  if inst then
    local op=inst.op
    local a=inst.a or 0
    local b=inst.b or 0
    local c=inst.c or 0
    local h=dispatch[op]
    if h then h(a,b,c)end
  end
end
`;
}

module.exports = { generateVM, randomVar };
