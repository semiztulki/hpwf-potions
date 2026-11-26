const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../admin.js'),'utf8');
const effect=(type,value=1)=>({type,value,unit:type==='efficiency'?'percent':'points'});
const potion=(type,number=37,extra={})=>({id:`pn-l3-${type}-${number}`,category:'standard_new',level:3,number,duration:'2mo',effects:[effect(type)],...extra});
const draft=(type,number=37)=>potion(type,number,{id:undefined,value:number===37?1382:2084,effects:[effect(type,number===37?2:3)]});
function fixture(){
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id)) nodes.set(id,{value:'',checked:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});
    return nodes.get(id);
  };
  const context={state:{ingredients:[],potions:{},wanted:[]},document:{getElementById:node,addEventListener(){},querySelectorAll(){return [];}},sessionStorage:{getItem(){return null;}},norm:v=>String(v??'').toLowerCase().replaceAll('ё','е').trim(),comparePotions:()=>0};
  vm.createContext(context);vm.runInContext(source,context);
  return {context,node};
}
test('efficiency 37 and resistance 44 are new when only other effect types exist',()=>{
  const {context:c}=fixture();
  assert.equal(c.adminFindPotion(draft('efficiency'),[potion('concentration'),potion('resistance')]).status,'new');
  assert.equal(c.adminFindPotion(draft('resistance',44),[potion('concentration',44),potion('efficiency',44,{duration:'1mo'})]).status,'new');
});
test('all three new-style effect types have separate identities',()=>{
  const {context:c}=fixture();
  const types=['concentration','resistance','efficiency'];
  for(const type of types){
    const d=draft(type),existing=potion(type,37,{effects:d.effects});
    const found=c.adminFindPotion(d,[...types.filter(t=>t!==type).map(t=>potion(t)),existing]);
    assert.equal(found.status,'existing');assert.equal(found.potion.id,existing.id);
  }
});
test('the same type and number still reject differing known properties',()=>{
  const {context:c}=fixture(),d=draft('efficiency');
  for(const extra of [{effects:[effect('efficiency',99)]},{effects:d.effects,duration:'1mo'},{effects:d.effects,value:9999}]){
    assert.equal(c.adminFindPotion(d,[potion('efficiency',37,extra)]).status,'conflict');
  }
});
test('old-style identity and special-name matching retain their behavior',()=>{
  const {context:c}=fixture();
  const old=potion('concentration',37,{id:'po-l3-37',category:'standard_old'});
  assert.equal(c.adminFindPotion({...old,effects:[effect('resistance')]},[old]).status,'conflict');
  const special={id:'ps-001',category:'special',name:'Зелье',effects:[]};
  assert.equal(c.adminFindPotion({...special,name:' ЗЕЛЬЕ '},[special]).status,'existing');
});
test('records without known effects remain available for completion',()=>{
  const {context:c}=fixture(),d=draft('resistance');
  assert.equal(c.adminFindPotion(d,[potion('resistance',37,{effects:[]})]).status,'existing');
  assert.equal(c.adminFindPotion({...d,effects:[]},[potion('concentration'),potion('resistance')]).status,'ambiguous');
});
test('wanted records are offered only once and suggestions respect the entered type',()=>{
  const {context:c,node}=fixture(),p=potion('resistance');
  c.state.potions['standard-new']=[potion('concentration'),p];c.state.wanted=[p];
  assert.equal(c.adminPotionsForKey('standard-new').length,2);
  for(const [id,value] of Object.entries({adminCategory:'standard_new',adminLevel:'3',adminNumber:'37',adminResistance:'1'}))node(id).value=value;
  const suggestions=c.adminSuggestionPotions();
  assert.equal(suggestions.length,1);assert.equal(suggestions[0].id,p.id);
});
test('changing the effect clears an earlier explicit potion selection',()=>{
  const {context:c,node}=fixture();
  for(const name of ['adminPopulateBuilder','adminSyncEffectMode','adminRenderSequence','adminRenderPotionMatch','adminRenderAuth','adminRenderValidation']) c[name]=()=>{};
  c.state.ingredients=[{}];c.initAdmin();
  for(const id of ['adminConcentration','adminResistance','adminEfficiency']){
    vm.runInContext('adminState.selectedPotionId="previous";adminState.confirmedPotionId="previous";',c);
    node(id).handlers.input();
    assert.equal(vm.runInContext('adminState.selectedPotionId',c),null);
    assert.equal(vm.runInContext('adminState.confirmedPotionId',c),null);
  }
});
