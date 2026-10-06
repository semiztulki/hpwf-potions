const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const model=require('../value-model.js');
const ingredients=JSON.parse(fs.readFileSync(path.join(root,'data/ingredients.json')));
const mechanics=JSON.parse(fs.readFileSync(path.join(root,'data/mechanics.json')));
const I=Object.fromEntries(ingredients.map(i=>[i.id,i]));
const items=counts=>Object.entries(counts).map(([ref,count])=>({ingredient:I[ref],count}));
const check=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

// The known control must reproduce both its value and its rounded effect.
const heart=model.estimate(items({'ing-033':11}),false,mechanics);
assert.equal(Math.round(heart.base),406398);check(heart.minimum,heart.base);check(heart.maximum,heart.base);
assert.equal(model.effect(heart.nominal,800),508);
const seasonal=model.estimate(items({'ing-006':11}),false,mechanics);
assert.equal(seasonal.minimum,11000);assert.equal(seasonal.maximum,11000);
const mixed=model.estimate(items({'ing-001':5,'ing-006':4,'ing-017':1,'ing-021':1}),false,mechanics);
assert.equal(Math.round(mixed.nominal),21310);check(mixed.minimum,mixed.nominal-150);check(mixed.maximum,mixed.nominal+150);
const moon=model.estimate(items({'ing-001':5,'ing-006':4,'ing-017':1,'ing-021':1}),true,mechanics);
check(moon.nominal,mixed.nominal+225);check(moon.minimum,mixed.minimum);check(moon.maximum,mixed.maximum+450);
const common=model.estimate(items({'ing-012':11}),false,mechanics);
check(common.minimum,5142.5);check(common.maximum,6957.5);
assert.equal(model.effect(800,800),1);assert.equal(model.effect(800.01,800),2);
assert.equal(model.sequence([{type:'unresolved',raw:'mana'}],ingredients,mechanics).partial,true);
assert.equal(model.sequence([{type:'ingredient',ref:'unknown'}],ingredients,mechanics).partial,true);
assert.equal(model.estimate(items({'ing-001':-1}),false,mechanics).partial,true);
// Every member of the same level and rarity is interchangeable.
for(const ingredient of ingredients){
  const group=ingredients.filter(i=>i.level===ingredient.level&&i.rarity===ingredient.rarity);
  for(const other of group)assert.equal(model.powerOf(ingredient),model.powerOf(other));
}
const pollen=model.estimate(items({'ing-032':11}),false,mechanics);
check(pollen.base,heart.base);
assert.equal(model.effect(pollen.base,800),508);
assert.equal(model.effect(model.estimate(items({'ing-032':11}),true,mechanics).maximum,800),509);
// Independent card values for pure seasonal and mixed rare controls.
assert.equal(Math.round(model.estimate(items({'ing-017':11}),false,mechanics).base),29901);
assert.equal(Math.round(model.estimate(items({'ing-028':11}),false,mechanics).base),81280);
assert.equal(Math.round(model.estimate(items({'ing-010':9,'ing-021':1,'ing-032':1}),false,mechanics).base),95537);

// Exercise the actual calculator and recipe renderer with a small DOM harness.
let inputs=[];
const nodes=new Map();
const node=id=>{
  if(nodes.has(id))return nodes.get(id);
  let html='';
  const value={value:'',hidden:false,disabled:false,textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},addEventListener(){},setAttribute(){},style:{setProperty(){}}};
  Object.defineProperty(value,'innerHTML',{get(){return html;},set(s){html=s;if(id==='calculatorIngredients')inputs=[...s.matchAll(/<input class="calculator-quantity"[^>]+>/g)].map(([tag])=>({value:'0',dataset:Object.fromEntries([...tag.matchAll(/data-(ref|rarity|level)="([^"]+)"/g)].map(([,k,v])=>[k,v])),classList:{toggle(){}},addEventListener(){}}));}});
  nodes.set(id,value);return value;
};
const document={getElementById:node,querySelectorAll:sel=>sel==='.calculator-quantity'?inputs:sel==='input[name="recipe-rarity"]:checked'?['common','seasonal','very_rare'].map(value=>({value})):sel==='input[name="recipe-moon"]:checked'?['with','without'].map(value=>({value})):[],querySelector:()=>node('query'),addEventListener(){},dispatchEvent(){}};
const context={document,window:{setInterval(){}},Intl,Map,Set,HpwfValueModel:model,console};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace('initTabs();load();',''),context);
context.fixtureIngredients=ingredients;context.fixtureMechanics=mechanics;
vm.runInContext('state.ingredients=fixtureIngredients;state.mechanics=fixtureMechanics;Object.assign(calculatorEffectDivisors,state.mechanics.value.effectDivisors);initValueCalculator();',context);
assert.equal(inputs.length,9);
const setCounts=counts=>{for(const input of inputs)input.value=String(counts[input.dataset.ref]||0);};
setCounts({'ing-032':11});node('calculatorDuration').value='2mo';
vm.runInContext('updateValueCalculator()',context);
assert.ok(node('calculatorResult').innerHTML.replace(/\s/g,'').includes('406398'));
assert.ok(node('calculatorEffects').innerHTML.includes('<strong>508</strong>'));
assert.ok(!node('calculatorEffects').innerHTML.includes('508–508'));
assert.equal(node('calculatorDetectedLevel').innerHTML.includes('третьего'),true);
setCounts({'ing-001':5,'ing-006':4,'ing-017':1,'ing-021':1});node('calculatorDuration').value='1mo';
vm.runInContext('updateValueCalculator()',context);
assert.ok(node('calculatorResult').innerHTML.includes('–'));
setCounts({'ing-032':12});vm.runInContext('updateValueCalculator()',context);
assert.equal(node('calculatorEffects').hidden,true);
assert.ok(node('calculatorResult').textContent.includes('больше 11'));
context.recipe={sequence:[{type:'ingredient',ref:'ing-033'}]};
const recipeEstimate=vm.runInContext('nominalRecipeValue(recipe)',context);
check(recipeEstimate.minimum,heart.base/11);check(recipeEstimate.maximum,heart.base/11);
context.potion={id:'control',category:'special',name:'Control',duration:'2mo',value:406398,effects:[{type:'efficiency',value:508,unit:'percent'}]};
vm.runInContext("state.recipes={special:[{potionId:'control',sequence:Array.from({length:11},()=>({type:'ingredient',ref:'ing-033'}))}]}",context);
const card=vm.runInContext('renderPotionCard(potion)',context);
assert.ok(card.includes('Расчётная ценность состава:'));
assert.ok(card.includes('Ценность:'));
assert.ok(card.includes('508'));
console.log('Value model and calculator integration checks passed.');
