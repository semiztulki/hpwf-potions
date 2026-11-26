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
