const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
function fixture(){
 const nodes=new Map(),events=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,innerHTML:'',textContent:'',value:'',checked:true,addEventListener(){},classList:{add(){},remove(){}}});return nodes.get(id);};
 const tabs=new Map();
 const document={getElementById:node,querySelectorAll(){return[];},querySelector(selector){tabs.set(selector,true);return {classList:{add(){}}};},addEventListener(type,fn){events.set(type,fn);},dispatchEvent(e){events.get(e.type)?.(e);}};
 const c={document,window:{scrollTo(){}},CustomEvent:function(type){this.type=type;},HpwfEffectPlanner:require('../effect-planner.js'),potionTitle:p=>p.id,potionEffectSummary:()=>'+200',recipeItems:()=>'<b>private-recipe</b>'};
 vm.createContext(c);
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 vm.runInContext(app.slice(0,app.indexOf('function initTabs()')),c);
 vm.runInContext(fs.readFileSync(require.resolve('../effect-planner-ui.js'),'utf8'),c);
 vm.runInContext(`state.potions={new:[{id:'private-potion',category:'standard_new',level:3,duration:'2mo',effects:[{type:'efficiency',value:200}]}]};state.recipes={new:[{potionId:'private-potion'}]};`,c);
 return {c,node,tabs,run:s=>vm.runInContext(s,c)};
}
test('guest can open planner with its own highlighted tab, while cauldron stays locked',()=>{
 const {node,tabs,run}=fixture();
 run(`showHome('guest');openFunctionalTab('effect-planner');`);
 assert.equal(node('functionalScreen').hidden,false);
 assert.ok(tabs.has('.tab[data-tab="effect-planner"]'));
 run(`openFunctionalTab('test-brew');`);
 assert.equal(node('accessScreen').hidden,false);
});
test('guest never renders private recipes even if private state remains in memory',()=>{
 const {node,run}=fixture();
 run(`accessMode='guest';plannerExisting({level:3,duration:'2mo',type:'efficiency',value:200});`);
 assert.equal(node('plannerFound').hidden,true);assert.equal(node('plannerFoundCards').innerHTML,'');
});
test('authenticated recipes are removed immediately when leaving authenticated mode',()=>{
 const {node,run}=fixture();
 run(`accessMode='authenticated';plannerExisting({level:3,duration:'2mo',type:'efficiency',value:200});`);
 assert.equal(node('plannerFound').hidden,false);assert.match(node('plannerFoundCards').innerHTML,/private-recipe/);
 run(`showAccessScreen();`);
 assert.equal(node('plannerFound').hidden,true);assert.equal(node('plannerFoundCards').innerHTML,'');
});
test('guest navigation is visible and names ingredient combinations accurately',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.match(html,/<button class="tab" data-tab="effect-planner">Хочу сварить<\/button>/);
 assert.match(html,/data-home-tab="effect-planner">Хочу сварить зелье с нужным эффектом/);
 assert.match(html,/Сочетания типов ингредиентов <span id="plannerCount"/);
});
