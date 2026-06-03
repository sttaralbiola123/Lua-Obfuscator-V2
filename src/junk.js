function generateOpaquePredicates(count = 10) {
  const predicates = [];
  
  for (let i = 0; i < count; i++) {
    const type = Math.random() > 0.5;
    const a = Math.floor(Math.random() * 1000) + 1;
    const b = Math.floor(Math.random() * 1000) + 1;
    const c = Math.floor(Math.random() * 1000) + 1;
    
    if (type) {
      // Always true predicate
      predicates.push(`((${a} * ${b} + ${c}) == (${a * b} + ${c}))`);
    } else {
      // Always false predicate  
      predicates.push(`((${a} + ${b}) == (${a + b + 1}))`);
    }
  }
  
  return predicates;
}

function generateDeadCode() {
  const patterns = [
    `local _=math.random(1,1000) local __=_*2 _=__/2`,
    `do local t={} for i=1,10 do t[i]=i end end`,
    `local function f(x) return x*x end local y=f(5)`
  ];
  
  return patterns[Math.floor(Math.random() * patterns.length)];
}

module.exports = { generateOpaquePredicates, generateDeadCode };
