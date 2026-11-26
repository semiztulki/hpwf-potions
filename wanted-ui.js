'use strict';
const wantedDiscovery={rows:[],limit:30,revision:0,cache:new Map(),ingredients:null,mechanics:null,compositionResult:null};
function wantedEditorAccess(){return accessMode==='authenticated'&&!!adminState.password&&!!adminState.writePassword;}
function wantedDurations(){
  const level=Number($('wantedLevel').value),previous=$('wantedDuration').value;
  const durations=Object.keys(state.mechanics?.value?.effectDivisors?.[level]||{});
  $('wantedDuration').innerHTML='<option value="all">Все длительности</option>'+durations.map(d=>'<option value="'+d+'">'+esc(calculatorDurationLabels[d]||d)+'</option>').join('');
  $('wantedDuration').value=(previous==='all'||durations.includes(previous))?previous:(durations.at(-1)||'');
}
function wantedRenderPage(){
  if(!wantedEditorAccess())return;
  if($('wantedMode').value==='compositions')return wantedRenderCompositions();
  $('wantedCards').classList.remove('wanted-compositions');
  $('wantedCount').textContent=fmt(wantedDiscovery.rows.length);
  $('wantedCards').innerHTML=wantedDiscovery.rows.slice(0,wantedDiscovery.limit).map((q,i)=>'<article class="panel wanted-card wanted-discovery-card"><h3>'+esc(effectLabels[q.type])+': +'+q.value+(q.type==='efficiency'?'%':'')+'</h3><div class="badges"><span class="badge">'+q.level+' уровень</span><span class="badge">'+esc(calculatorDurationLabels[q.duration]||q.duration)+'</span><span class="badge">'+['Обычные','Сезонные','Особо редкие'][q.tier]+'</span></div><button type="button" class="admin-secondary-btn wanted-how" data-wanted-how="'+i+'">Как сварить?</button></article>').join('')||'<div class="panel empty-state">В выбранном диапазоне нет неизвестных зелий.</div>';
  $('wantedMore').hidden=wantedDiscovery.limit>=wantedDiscovery.rows.length;
}
function renderDiscoveryWanted(){
  const revision=++wantedDiscovery.revision;
  if($('wantedOrder').options)$('wantedOrder').options[1].textContent=$('wantedMode').value==='compositions'?'Выше шанс открытия':'Больше пробелов рядом';
  if(!wantedEditorAccess()){
    wantedDiscovery.rows=[];wantedDiscovery.compositionResult=null;$('wantedCards').innerHTML='';$('wantedCount').textContent='0';$('wantedMore').hidden=true;return;
  }
  if(!state.mechanics||!state.ingredients.length)return;
  if(!$('wantedDuration').value)wantedDurations();
  const query={level:Number($('wantedLevel').value),duration:$('wantedDuration').value,type:$('wantedType').value};
  $('wantedCards').innerHTML='<p class="meta" role="status">Подбираю неизвестные зелья…</p>';$('wantedMore').hidden=true;
  window.setTimeout(()=>{
    if(revision!==wantedDiscovery.revision||!wantedEditorAccess())return;
    if(wantedDiscovery.ingredients!==state.ingredients||wantedDiscovery.mechanics!==state.mechanics){wantedDiscovery.cache.clear();wantedDiscovery.ingredients=state.ingredients;wantedDiscovery.mechanics=state.mechanics;}
    if(!wantedDiscovery.cache.has(query.level))wantedDiscovery.cache.set(query.level,HpwfEffectPlanner.valueRanges(query.level,state.ingredients,state.mechanics));
    const known=[...(state.catalogPotions||[]),...Object.values(state.potions).flat(),...(state.wanted||[])];
    if($('wantedMode').value==='compositions'){
      wantedDiscovery.compositionResult=HpwfWantedPlanner.compositions(HpwfEffectPlanner,state.ingredients,state.mechanics,known,query,$('wantedOrder').value,$('wantedRarity').value);
    }else{
      const common=state.ingredients.filter(i=>i.rarity==='common'),seasonal=state.ingredients.filter(i=>i.rarity!=='very_rare');
      for(const [name,items] of [['common',common],['seasonal',seasonal]])if(!wantedDiscovery.cache.has(query.level+name))wantedDiscovery.cache.set(query.level+name,HpwfEffectPlanner.valueRanges(query.level,items,state.mechanics));
      const durations=query.duration==='all'?Object.keys(state.mechanics.value.effectDivisors[query.level]):[query.duration];
      const rows=durations.flatMap(duration=>HpwfWantedPlanner.missing(wantedDiscovery.cache.get(query.level),state.mechanics,known,{...query,duration}));
      wantedDiscovery.rows=HpwfWantedPlanner.annotate(rows,wantedDiscovery.cache.get(query.level+'common'),wantedDiscovery.cache.get(query.level+'seasonal'),state.mechanics)
        .filter(q=>$('wantedRarity').value==='common'?q.tier===0:$('wantedRarity').value==='seasonal'?q.tier<2:true)
        .sort((a,b)=>$('wantedOrder').value==='coverage'?b.gap-a.gap||a.tier-b.tier||a.value-b.value:a.tier-b.tier||b.gap-a.gap||a.value-b.value);
    }
    wantedDiscovery.limit=30;wantedRenderPage();
  },0);
}
function wantedOpenCalculation(index){
  if(!wantedEditorAccess())return;
  const q=wantedDiscovery.rows[index];if(!q)return;
  wantedCalculate(q);
}
function wantedCalculate(q){
  if(!wantedEditorAccess())return;
  openFunctionalTab('effect-planner');
  $('plannerLevel').value=String(q.level);plannerDurations();
  $('plannerDuration').value=q.duration;$('plannerType').value=q.type;$('plannerValue').value=String(q.value);
  $('plannerSeasonal').checked=true;$('plannerRare').checked=true;
  plannerReset();$('plannerForm').requestSubmit();
}
$('wantedLevel').addEventListener('change',()=>{wantedDurations();renderDiscoveryWanted();});
for(const id of ['wantedDuration','wantedType','wantedOrder','wantedRarity'])$(id).addEventListener('change',renderDiscoveryWanted);
$('wantedMode').addEventListener('change',()=>{if($('wantedMode').value==='compositions')$('wantedDuration').value='all';renderDiscoveryWanted();});
$('wantedMore').addEventListener('click',()=>{wantedDiscovery.limit+=30;wantedRenderPage();});
$('wantedCards').addEventListener('click',event=>{
  const button=event.target.closest('[data-wanted-how]');
  if(button)wantedOpenCalculation(Number(button.dataset.wantedHow));
  const target=event.target.closest('[data-wanted-outcome]');
  if(target&&wantedEditorAccess()){const [i,j]=target.dataset.wantedOutcome.split(':').map(Number),o=wantedDiscovery.compositionResult?.candidates[i]?.outcomes[j];if(o)wantedCalculate({level:Number($('wantedLevel').value),duration:o.duration,type:o.type,value:o.gaps[0][0]});}
});
document.addEventListener('hpwf:data-ready',()=>{wantedDurations();renderDiscoveryWanted();});
document.addEventListener('hpwf:private-data-ready',renderDiscoveryWanted);
document.addEventListener('hpwf:access-changed',renderDiscoveryWanted);
if(state.mechanics){wantedDurations();renderDiscoveryWanted();}

function wantedRenderCompositions(){
  const r=wantedDiscovery.compositionResult;if(!r)return;
  $('wantedCount').textContent=fmt(r.candidates.length);
  $('wantedCards').classList.add('wanted-compositions');
  $('wantedCards').innerHTML=r.candidates.slice(0,wantedDiscovery.limit).map((c,i)=>'<article class="panel wanted-card"><h3 title="Оценка при равных шансах видов эффекта и доступных длительностей, равномерной ценности внутри расчётного диапазона.">Шанс нового зелья: ≈'+new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:1}).format(c.probability)+'</h3><p class="meta">Новых целей: '+fmt(c.unknown)+'</p><div class="planner-groups">'+r.groups.map((g,j)=>c.counts[j]?plannerGroupTile(g,c.counts[j]):'').join('')+'</div><p class="meta">Ценность: '+fmt(Math.round(c.minimum))+'–'+fmt(Math.round(c.maximum))+'</p><details class="wanted-outcomes"><summary>Возможные открытия</summary>'+c.outcomes.map((o,j)=>'<div><strong>'+esc(calculatorDurationLabels[o.duration])+' · '+esc(effectLabels[o.type])+'</strong><p>'+o.gaps.map(([a,b])=>a===b?String(a):a+'–'+b).join(', ')+(o.type==='efficiency'?'%':'')+'</p><button type="button" class="wanted-add-link" data-wanted-outcome="'+i+':'+j+'">Как сварить?</button></div>').join('')+'</details></article>').join('')||'<div class="panel empty-state">Для этих фильтров нет новых целей.</div>';
  $('wantedMore').hidden=wantedDiscovery.limit>=r.candidates.length;
}
