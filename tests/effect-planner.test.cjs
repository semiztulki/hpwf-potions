const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const planner=require('../effect-planner.js');
const model=require('../value-model.js');
const ingredients=require('../data/ingredients.json');
const mechanics=require('../data/mechanics.json');
const I=Object.fromEntries(ingredients.map(i=>[i.id,i]));
const query={level:3,duration:'2mo',type:'efficiency',value:200};
const result=planner.solve(query,ingredients,mechanics);
assert.equal(result.low,159200);assert.equal(result.high,160000);
assert.ok(result.candidates.length>1);
assert.ok(result.candidates.every(c=>c.rareN>=3));
const identities=new Set();
for(const c of result.candidates){
  assert.ok(c.count>0&&c.count<=11);assert.ok(c.maximum>result.low&&c.minimum<=result.high);
  const items=result.groups.map((g,i)=>({ingredient:g.ingredients[0],count:c.counts[i]}));
  const estimate=model.estimate(items,false,mechanics),final=estimate.empirical||estimate;
  assert.ok(Math.abs(final.minimum-c.minimum)<1e-7);assert.ok(Math.abs(final.maximum-c.maximum)<1e-7);
  assert.equal(Math.max(...items.filter(i=>i.count).map(i=>i.ingredient.level)),3);
  const key=c.counts.join(',');assert.ok(!identities.has(key));identities.add(key);
}
const sorted=planner.rank(result.candidates,'count');assert.equal(sorted[0].count,Math.min(...sorted.map(c=>c.count)));
assert.throws(()=>planner.solve({...query,value:0},ingredients,mechanics));
assert.throws(()=>planner.solve({...query,value:1.5},ingredients,mechanics));
assert.throws(()=>planner.solve({...query,duration:'5m'},ingredients,mechanics));
const tiny=[{id:'x',name:'X',level:1,rarity:'common',basePower:100}];
const exact={value:{effectDivisors:{1:{test:{efficiency:100}}},modifierModel:{byRarity:{common:{relativeSpread:0}}}}};
const a=planner.solve({level:1,duration:'test',type:'efficiency',value:1},tiny,exact);
assert.equal(a.candidates.length,1);assert.equal(a.candidates[0].count,1);
const b=planner.solve({level:1,duration:'test',type:'efficiency',value:2},tiny,exact);
assert.equal(b.candidates.length,1);assert.equal(b.candidates[0].count,2);
assert.equal(planner.solve({...query,value:1000000},ingredients,mechanics).candidates.length,0);
// Each rarity group is represented by a real multi-frame GIF.
for(const g of planner.groups(ingredients,3))assert.equal(fs.readFileSync(path.join(__dirname,'../assets/groups',g.key+'.gif')).subarray(0,3).toString(),'GIF');
console.log('Planner boundary, composition, range, sorting and GIF checks passed.');
if(process.env.HPWF_CALIBRATION_CORPUS){
  const corpus=JSON.parse(fs.readFileSync(process.env.HPWF_CALIBRATION_CORPUS));
  const cache=new Map();let comparable=0,compatible=0,unsupported=0,outside=0;const missing=[];
  for(const row of corpus){
    const q={level:row.level,duration:row.duration,type:row.type,value:row.value};
    let t;try{t=planner.target(q,mechanics);}catch{unsupported++;continue;}
    if(row.seq.some(x=>!['ingredient','action'].includes(x.type))){unsupported++;continue;}
    const refs=row.seq.filter(x=>x.type==='ingredient').map(x=>x.ref);
    if(!refs.length||refs.length>11||refs.some(ref=>!I[ref])||Math.max(...refs.map(ref=>I[ref].level))!==q.level){unsupported++;continue;}
    comparable++;
    const estimate=model.sequence(row.seq,ingredients,mechanics),bounds=estimate.empirical||estimate;
    if(bounds.maximum<=t.low||bounds.minimum>t.high){outside++;continue;}
    compatible++;
    const key=JSON.stringify(q);
    if(!cache.has(key)){
      const r=planner.solve(q,ingredients,mechanics);
      cache.set(key,{groups:r.groups,keys:new Set(r.candidates.map(c=>c.counts.join(',')))});
    }
    const r=cache.get(key),counts=r.groups.map(g=>refs.filter(ref=>I[ref].level===g.level&&I[ref].rarity===g.rarity).length);
    if(!r.keys.has(counts.join(',')))missing.push(row.id);
  }
  assert.deepEqual(missing,[]);
  console.log(JSON.stringify({databaseRecipes:corpus.length,comparable,compatible,knownModelMismatches:outside,unsupportedOrMoon:unsupported,uniqueQueries:cache.size,missingCompositions:missing.length}));
}
