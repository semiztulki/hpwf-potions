const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test');
const planner=require('../effect-planner.js'),wanted=require('../wanted-planner.js');
const ingredients=require('../data/ingredients.json'),mechanics=require('../data/mechanics.json');
const potion=(value,extra={})=>({id:'p'+value,category:'standard_new',level:3,duration:'2mo',effects:[{type:'efficiency',value}],...extra});
test('known cards are excluded even without a recipe, image or non-draft status',()=>{
 const known=[potion(2),potion(3,{draft:true}),potion(4,{imageUrl:null})];
 const rows=wanted.missing([[800,4000]],mechanics,known,{level:3,duration:'2mo',type:'efficiency'});
 assert.deepEqual(rows.map(r=>r.value),[1,5]);
});
test('identity includes level, duration and effect type; duplicates do not hide other targets',()=>{
 const known=[potion(2,{level:2}),potion(2,{duration:'1mo'}),potion(2,{effects:[{type:'resistance',value:2}]})];
 const rows=wanted.missing([[1600,1600]],mechanics,known,{level:3,duration:'2mo',type:'all'});
 assert.deepEqual(rows.map(r=>r.type).sort(),['concentration','efficiency']);
});
test('range gaps and rounding boundaries do not create impossible targets',()=>{
 const rows=wanted.missing([[800,800],[2400,2400],[2400,2400]],mechanics,[],{level:3,duration:'2mo',type:'efficiency'});
 assert.deepEqual(rows.map(r=>r.value),[1,3]);
});
test('discovery and calculator use identical attainable ranges on each level',()=>{
 for(const level of [1,2,3]){
  const ranges=planner.valueRanges(level,ingredients,mechanics);
  for(const duration of Object.keys(mechanics.value.effectDivisors[level])){
   for(const type of ['concentration','efficiency','resistance']){
    const rows=wanted.missing(ranges,mechanics,[],{level,duration,type});
    assert.ok(rows.length);
    for(const q of [rows[0],rows[Math.floor(rows.length/2)],rows.at(-1)])assert.ok(planner.solve(q,ingredients,mechanics).candidates.length,JSON.stringify(q));
   }
  }
 }
});
function uiFixture(){
 const nodes=new Map(),events=new Map(),calls=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,innerHTML:'',addEventListener(){},requestSubmit(){calls.push('submit');}});return nodes.get(id);};
 const c={$,accessMode:'authenticated',adminState:{password:'test',writePassword:'test'},state:{mechanics:null,ingredients:[],potions:{},wanted:[]},document:{addEventListener(type,fn){events.set(type,fn);}},openFunctionalTab:id=>calls.push(id),plannerDurations:()=>calls.push('durations'),plannerReset:()=>calls.push('reset')};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../wanted-ui.js'),'utf8'),c);
 return {c,$,calls,run:s=>vm.runInContext(s,c)};
}
test('how-to button fills every planner field, resets rarity filters and submits automatically',()=>{
 const {$,calls,run}=uiFixture();
 run(`wantedDiscovery.rows=[{level:2,duration:'1mo',type:'resistance',value:31}];wantedOpenCalculation(0);`);
 assert.deepEqual(calls,['effect-planner','durations','reset','submit']);
 assert.equal($('plannerLevel').value,'2');assert.equal($('plannerDuration').value,'1mo');assert.equal($('plannerType').value,'resistance');assert.equal($('plannerValue').value,'31');
 assert.ok($('plannerSeasonal').checked&&$('plannerRare').checked);
});
test('guest and first-level password cannot render discovery or open target calculations',()=>{
 for(const mode of ['guest','reader']){
  const {c,$,calls,run}=uiFixture();if(mode==='guest')c.accessMode='guest';else c.adminState.writePassword='';
  run(`wantedDiscovery.rows=[{level:3,duration:'2mo',type:'efficiency',value:200}];renderDiscoveryWanted();wantedOpenCalculation(0);`);
  assert.equal($('wantedCards').innerHTML,'');assert.deepEqual(calls,[]);
 }
});

test('estimated chance uses interval widths, including partial edge bins',()=>{
 const scenes=[{duration:'x',type:'efficiency',divisor:100,weight:1,known:[2]}];
 const c={minimum:150,maximum:350};
 const score=wanted.coverage(c,scenes,true);
 assert.equal(score.unknown,2);assert.equal(score.total,3);
 assert.equal(score.probability,.75); // Only 150..200 is known; the rest is new.
 assert.deepEqual(score.outcomes[0].gaps,[[3,4]]);
});
test('type/duration filters keep unconditional chance instead of overstating it',()=>{
 const m={value:{effectDivisors:{1:{a:{concentration:100,efficiency:100,resistance:100},b:{concentration:100,efficiency:100,resistance:100}}}}};
 const scenes=wanted.scenarios(m,[],{level:1,duration:'a',type:'efficiency'});
 assert.equal(scenes.length,1);assert.equal(wanted.coverage({minimum:100,maximum:200},scenes).probability,1/6);
 const all=wanted.scenarios(m,[],{level:1,duration:'all',type:'all'});
 assert.ok(Math.abs(wanted.coverage({minimum:100,maximum:200},all).probability-1)<1e-12);
});
test('zero-width values, duplicate known cards, and gap annotations behave consistently',()=>{
 const scenes=[{duration:'x',type:'efficiency',divisor:100,weight:1,known:[2]}];
 assert.equal(wanted.coverage({minimum:200,maximum:200},scenes).probability,0);
 assert.equal(wanted.coverage({minimum:201,maximum:201},scenes).probability,1);
 const rows=[1,2,3,5].map(value=>({level:3,duration:'2mo',type:'efficiency',value}));
 const annotated=wanted.annotate(rows,[[800,2400]],[[800,4000]],mechanics);
 assert.deepEqual(annotated.map(q=>q.gap),[3,3,3,1]);assert.deepEqual(annotated.map(q=>q.tier),[0,0,0,1]);
});
test('composition ranking uses rarity first or approximate chance, as selected',()=>{
 const m={value:{effectDivisors:{1:{a:{concentration:100,efficiency:100,resistance:100}}},modifierModel:{byRarity:{common:{relativeSpread:.15},seasonal:{relativeSpread:.05},very_rare:{relativeSpread:.01}}}}};
 const ing=[{id:'c',level:1,rarity:'common',basePower:100},{id:'s',level:1,rarity:'seasonal',basePower:200},{id:'r',level:1,rarity:'very_rare',basePower:500}];
 const q={level:1,duration:'all',type:'all'};
 const r=wanted.compositions(planner,ing,m,[],q,'rare','all',10);
 assert.ok(r.candidates.length);assert.equal(r.candidates[0].rareN,0);assert.equal(r.candidates[0].seasonalN,0);
 const common=wanted.compositions(planner,ing,m,[],q,'coverage','common',10);
 assert.ok(common.candidates.every(c=>c.rareN===0&&c.seasonalN===0));
 for(const c of common.candidates)assert.ok(Math.abs(c.probability-1)<1e-12);
});
