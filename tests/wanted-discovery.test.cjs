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
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,innerHTML:'',dataset:{},setAttribute(name,value){this[name]=value;},addEventListener(){},requestSubmit(){calls.push('submit');}});return nodes.get(id);};
 const c={$,accessMode:'authenticated',adminState:{password:'test',writePassword:'test'},state:{mechanics:null,ingredients:[],potions:{},wanted:[]},document:{querySelectorAll(){return [];},querySelector(){return $('wantedOrderInfo');},addEventListener(type,fn){events.set(type,fn);}},openFunctionalTab:id=>calls.push(id),plannerDurations:()=>calls.push('durations'),plannerReset:()=>calls.push('reset')};
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
test('guest cannot render discovery or open target calculations',()=>{
 for(const mode of ['guest']){
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

test('named single-effect potions exclude the same target and reduce discovery chance',()=>{
 const named=potion(2,{category:'special',name:'Весенний суп',draft:true});
 const query={level:3,duration:'2mo',type:'efficiency'};
 const rows=wanted.missing([[800,2400]],mechanics,[named],query);
 assert.deepEqual(rows.map(r=>r.value),[1,3]);
 const scenes=wanted.scenarios(mechanics,[named],query);
 assert.deepEqual(scenes[0].known,[2]);
 const score=wanted.coverage({minimum:800,maximum:2400},scenes);
 assert.equal(score.probability,scenes[0].weight*.5);
});
test('mixed named effects never block any individual single-effect potion',()=>{
 const mixed=potion(2,{category:'special',effects:[{type:'efficiency',value:2},{type:'resistance',value:3}]});
 const rows=wanted.missing([[800,2400]],mechanics,[mixed],{level:3,duration:'2mo',type:'all'});
 assert.ok(rows.some(q=>q.type==='efficiency'&&q.value===2));
 assert.ok(rows.some(q=>q.type==='resistance'&&q.value===3));
 assert.ok(wanted.scenarios(mechanics,[mixed],{level:3,duration:'2mo',type:'all'}).every(s=>!s.known.length));
});
test('named levels use recipe ingredients, without mutating original records',()=>{
 const p=potion(2,{category:'special',level:null});
 const records=wanted.catalog([p],[{potionId:p.id,sequence:[{type:'ingredient',ref:'a'},{type:'action',ref:'high-level-action'}]}],[{id:'a',level:2}]);
 assert.equal(records[0].level,2);assert.equal(p.level,null);
 assert.equal(wanted.singleKnownEffect(records[0],3),null);
 assert.ok(wanted.singleKnownEffect(records[0],2));
});
test('unknown named level is conservatively treated as known on matching effect/duration',()=>{
 const p=potion(2,{category:'special',level:null});
 for(const level of [1,2,3])assert.ok(wanted.singleKnownEffect(p,level));
 const rows=wanted.missing([[800,2400]],mechanics,[p],{level:3,duration:'2mo',type:'efficiency'});
 assert.ok(!rows.some(q=>q.value===2));
 assert.ok(wanted.missing([[800,2400]],mechanics,[{...p,duration:'1mo'}],{level:3,duration:'2mo',type:'efficiency'}).some(q=>q.value===2));
});

test('named level can be estimated from value, effect and duration without inventing a unique level',()=>{
 const card=potion(9,{category:'special',level:null,duration:'1h',value:300});
 const estimated=wanted.catalog([card],[],[],mechanics);
 assert.deepEqual(estimated.map(p=>p.level),[1]);
});

test('ambiguous duration-only estimates retain all compatible levels and recipes take priority',()=>{
 const card=potion(10,{category:'special',level:null,duration:'1mo',value:null});
 assert.deepEqual(wanted.catalog([card],[],[],mechanics).map(p=>p.level),[2,3]);
 const r=[{potionId:card.id,sequence:[{type:'ingredient',ref:'one'}]}];
 assert.deepEqual(wanted.catalog([card],r,[{id:'one',level:1}],mechanics).map(p=>p.level),[1]);
 assert.equal(card.level,null);
});

test('faculty password opens calculations without editor password',()=>{
 const {c,$,calls,run}=uiFixture();c.adminState.writePassword='';
 run(`wantedDiscovery.rows=[{level:1,duration:'1w',type:'efficiency',value:2}];wantedOpenCalculation(0);`);
 assert.deepEqual(calls,['effect-planner','durations','reset','submit']);
});
test('Moon supplies a separate 0..450 bonus and is retained for exhausted single ingredients',()=>{
 const ing=[{id:'c',level:1,rarity:'common',basePower:100}];
 const m={value:{effectDivisors:{1:{a:{efficiency:100}}},modifierModel:{byRarity:{common:{relativeSpread:0}}}}};
 const q={level:1,duration:'a',type:'efficiency',value:5};
 const r=planner.solve(q,ing,m);
 const moon=r.candidates.find(c=>c.count===1&&c.moon);assert.ok(moon);assert.equal(moon.minimum,100);assert.equal(moon.maximum,550);assert.equal(moon.base,325);
 assert.ok(!r.candidates.some(c=>c.count===1&&!c.moon));
 const actions=[{id:'stir',kind:'action'}],recipes=[{sequence:[{type:'ingredient',ref:'c'}]},{sequence:[{type:'ingredient',ref:'c'},{type:'action',ref:'stir'}]}];
 const exhausted=wanted.exhaustedSingles(ing,actions,recipes);assert.ok(exhausted.has('1-common'));
 const seen=[];planner.eachComposition(1,ing,m,c=>seen.push({...c}),wanted.enumerationOptions(exhausted));
 assert.ok(!seen.some(c=>c.count===1&&!c.moon));assert.ok(seen.some(c=>c.count===1&&c.moon));
 assert.equal(wanted.exhaustedSingles(ing,actions,recipes.slice(0,1)).size,0);
});

test('entering Wanted resets all filters and hides unused composition fields',()=>{
 const {$,run}=uiFixture();
 for(const id of ['wantedLevel','wantedDuration','wantedType','wantedMode','wantedOrder','wantedRarity'])$(id).value='changed';
 $('wantedNoMoon').checked=true;run('wantedResetFilters();wantedControlLabels();');
 for(const id of ['wantedLevel','wantedDuration','wantedType','wantedRarity'])assert.equal($(id).value,'all');
 assert.equal($('wantedMode').value,'targets');assert.equal($('wantedNoMoon').checked,false);
 $('wantedMode').value='compositions';run('wantedControlLabels();');
 assert.equal($('wantedDurationField').hidden,true);assert.equal($('wantedTypeField').hidden,true);
});

test('empirical duration weights include named outcomes, keep effect thirds and do not renormalize filters',()=>{
 const q={level:1,duration:'all',type:'all'},s=wanted.scenarios(mechanics,[],q);
 assert.ok(Math.abs(s.reduce((n,x)=>n+x.weight,0)-1)<1e-12);
 const week=s.filter(x=>x.duration==='1w');
 assert.ok(week.reduce((n,x)=>n+x.weight,0)>.73);
 assert.equal(week[0].weight,week[1].weight);
 const filtered=wanted.scenarios(mechanics,[],{...q,duration:'1w',type:'resistance'});
 assert.equal(filtered[0].weight,week.find(x=>x.type==='resistance').weight);
 const l3=wanted.scenarios(mechanics,[],{...q,level:3});
 assert.ok(l3.find(x=>x.duration==='5h').weight>0); // No observations is not an impossible duration.
});
test('scripted and mixed potions never close ordinary effects; renamed single effects do',()=>{
 const q={level:3,duration:'2mo',type:'efficiency'};
 const named=potion(2,{category:'special',name:'Авторское зелье'});
 for(const card of [{...named,scripted:true},{...named,discoveryExcluded:true},{...named,generation:'scripted'},potion(2,{category:'mana'}),potion(2,{category:'standard_old'})]){
  assert.ok(wanted.missing([[1600,1600]],mechanics,[card],q).length);
 }
 assert.equal(wanted.missing([[1600,1600]],mechanics,[named],q).length,0);
});
const fixtureIngredients=[{id:'a',level:1,rarity:'common',basePower:100},{id:'b',level:1,rarity:'common',basePower:100}];
const fixtureActions=[{id:'stir',kind:'action'},{id:'spell',kind:'action'},{id:'moon',kind:'moon'}];
const step=(type,ref)=>({type,ref});
test('counts agree with exhaustive ordered sequences, including actions around Moon',()=>{
 const sequences=[];
 function visit(seq,n,moon){
  if(n===2)sequences.push(seq);
  if(seq.length>=6)return;
  if(n<2)for(const i of fixtureIngredients)visit([...seq,step('ingredient',i.id)],n+1,moon);
  if(seq.length&&seq.at(-1).type!=='action')for(const a of fixtureActions.filter(a=>a.kind==='action'))visit([...seq,step('action',a.id)],n,moon);
  if(!moon)visit([...seq,step('moon','moon')],n,true);
 }
 visit([],0,false);
 const groups=planner.groups(fixtureIngredients,1),available=wanted.sequenceAvailability(fixtureIngredients,fixtureActions,[]);
 for(const moon of [false,true]){
  const matching=sequences.filter(s=>s.some(x=>x.type==='moon')===moon);
  const c={count:2,counts:[2],moon};
  assert.equal(available(c,groups).total,matching.length);
  const records=matching.map(sequence=>({sequence}));
  const closed=wanted.sequenceAvailability(fixtureIngredients,fixtureActions,[...records,...records]);
  assert.equal(closed(c,groups).known,matching.length);
  assert.equal(closed(c,groups).remaining,0);
 }
});
test('partial exhaustion discounts one-ingredient scores; all potion categories block exact sequences',()=>{
 const groups=planner.groups(fixtureIngredients,1),c={count:1,counts:[1],moon:false};
 const records=[{potionId:'old',sequence:[step('ingredient','a')]},{potionId:'soup',sequence:[step('ingredient','b'),step('action','stir')]}];
 const availability=wanted.sequenceAvailability(fixtureIngredients,fixtureActions,[...records,records[0]]);
 assert.deepEqual(availability(c,groups),{total:6,known:2,remaining:4,fraction:1-2/6});
 assert.equal(availability({...c,moon:true},groups).known,0);
 const m={value:{effectDivisors:{1:{x:{concentration:100,efficiency:100,resistance:100}}}}};
 const result=wanted.compositions(planner,fixtureIngredients,m,[],{level:1,duration:'all',type:'all'},'coverage','all',100,wanted.enumerationOptions(new Set(),availability));
 const one=result.candidates.find(x=>x.count===1&&!x.moon);
 assert.ok(Math.abs(one.probability-2/3)<1e-12);
 const more=wanted.sequenceAvailability(fixtureIngredients,fixtureActions,[...records,{sequence:[step('ingredient','a'),step('action','spell')]}]);
 assert.ok(more(c,groups).fraction<availability(c,groups).fraction);
});
test('ingredient repetition, group ordering, and the 11th-ingredient boundary are counted',()=>{
 const gs=planner.groups([...fixtureIngredients,{id:'s',level:1,rarity:'seasonal',basePower:1000}],1);
 const a=wanted.sequenceAvailability([...fixtureIngredients,{id:'s',level:1,rarity:'seasonal'}],fixtureActions,[]);
 assert.equal(a({count:3,counts:[2,1],moon:false},gs).total,3*4*27);
 const single=planner.groups([fixtureIngredients[0]],1),available=wanted.sequenceAvailability([fixtureIngredients[0]],fixtureActions,[]);
 assert.equal(available({count:11,counts:[11],moon:false},single).total,3**10);
 assert.equal(available({count:11,counts:[11],moon:true},single).total,11*3**11);
 const invalid=[...Array.from({length:11},()=>step('ingredient','a')),step('moon','moon')];
 assert.equal(wanted.sequenceAvailability([fixtureIngredients[0]],fixtureActions,[{sequence:invalid}])({count:11,counts:[11],moon:true},single).known,0);
});

test('unrecorded compositions skip sequence totals in exclusion and probability paths',()=>{
 const availability=wanted.sequenceAvailability(fixtureIngredients,fixtureActions,[]);
 const groups=[{key:'1-common',get ingredients(){throw new Error('Sequence total must not be calculated');}}];
 const options=wanted.enumerationOptions(new Set(),availability);
 for(const moon of [false,true])for(const count of [1,2,11]){
  const c={count,counts:[count],moon};
  assert.equal(options.exclude(c,groups),false);
  assert.equal(availability.fraction(c,groups),1);
 }
});
test('exclusion and scoring share sequence totals for a recorded composition',()=>{
 let reads=0;
 const groups=[{key:'1-common',get ingredients(){reads++;return fixtureIngredients;}}];
 const availability=wanted.sequenceAvailability(fixtureIngredients,fixtureActions,[{sequence:[step('ingredient','a')]}]);
 const c={count:1,counts:[1],moon:false},options=wanted.enumerationOptions(new Set(),availability);
 assert.equal(options.exclude(c,groups),false);assert.equal(reads,1);
 assert.equal(availability.fraction(c,groups),5/6);assert.equal(reads,1);
 assert.equal(availability(c,groups).known,1);assert.equal(reads,1);
});
test('composition keys preserve group identity, count, Moon, subset and reordered group lists',()=>{
 const ing=[];for(const level of [1,2,3])for(const rarity of ['common','seasonal','very_rare'])ing.push({id:level+'-'+rarity,level,rarity,basePower:100});
 const availability=wanted.sequenceAvailability(ing,fixtureActions,[
  {sequence:[step('ingredient','3-very_rare'),step('moon','moon')]},
  {sequence:Array.from({length:11},()=>step('ingredient','1-common'))}
 ]);
 const groups=planner.groups(ing,3),single=key=>groups.map(g=>Number(g.key===key));
 for(const list of [groups,[...groups].reverse()]){
  const counts=list.map(g=>Number(g.key==='3-very_rare')),c={count:1,counts,moon:true};
  assert.equal(availability(c,list).known,1);
  assert.equal(availability.exhausted(c,list),false);
  assert.equal(availability({...c,moon:false},list).known,0);
 }
 const subset=groups.filter(g=>g.key==='3-very_rare');
 assert.equal(availability({count:1,counts:[1],moon:true},subset).known,1);
 assert.equal(availability({count:1,counts:single('2-common'),moon:true},groups).known,0);
 assert.equal(availability({count:11,counts:single('1-common').map(n=>11*n),moon:false},groups).known,1);
 assert.equal(availability.fraction({count:1,counts:single('1-seasonal'),moon:false},groups),1);
});
test('custom availability functions without fast paths remain supported',()=>{
 const availability=()=>({remaining:0,fraction:0});
 assert.equal(wanted.enumerationOptions(new Set(),availability).exclude({},[]),true);
 const m={value:{effectDivisors:{1:{x:{concentration:100}}}}};
 assert.equal(wanted.compositions(planner,fixtureIngredients,m,[],{level:1,duration:'all',type:'all'},'rare','all',60,{availability}).candidates.length,0);
});
