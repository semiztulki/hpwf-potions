'use strict';
const wantedDiscovery={rows:[],limit:30,revision:0,cache:new Map(),ingredients:null,mechanics:null};
function wantedEditorAccess(){return accessMode==='authenticated'&&!!adminState.password&&!!adminState.writePassword;}
function wantedDurations(){
  const level=Number($('wantedLevel').value),previous=$('wantedDuration').value;
  const durations=Object.keys(state.mechanics?.value?.effectDivisors?.[level]||{});
  $('wantedDuration').innerHTML=durations.map(d=>'<option value="'+d+'">'+esc(calculatorDurationLabels[d]||d)+'</option>').join('');
  $('wantedDuration').value=durations.includes(previous)?previous:(durations.at(-1)||'');
}
function wantedRenderPage(){
  if(!wantedEditorAccess())return;
  $('wantedCount').textContent=fmt(wantedDiscovery.rows.length);
  $('wantedCards').innerHTML=wantedDiscovery.rows.slice(0,wantedDiscovery.limit).map((q,i)=>'<article class="panel wanted-card wanted-discovery-card"><h3>'+esc(effectLabels[q.type])+': +'+q.value+(q.type==='efficiency'?'%':'')+'</h3><div class="badges"><span class="badge">'+q.level+' уровень</span><span class="badge">'+esc(calculatorDurationLabels[q.duration]||q.duration)+'</span></div><button type="button" class="admin-secondary-btn wanted-how" data-wanted-how="'+i+'">Как сварить?</button></article>').join('')||'<div class="panel empty-state">В выбранном диапазоне нет неизвестных зелий.</div>';
  $('wantedMore').hidden=wantedDiscovery.limit>=wantedDiscovery.rows.length;
}
function renderDiscoveryWanted(){
  const revision=++wantedDiscovery.revision;
  if(!wantedEditorAccess()){
    wantedDiscovery.rows=[];$('wantedCards').innerHTML='';$('wantedCount').textContent='0';$('wantedMore').hidden=true;return;
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
    wantedDiscovery.rows=HpwfWantedPlanner.missing(wantedDiscovery.cache.get(query.level),state.mechanics,known,query);
    wantedDiscovery.limit=30;wantedRenderPage();
  },0);
}
function wantedOpenCalculation(index){
  if(!wantedEditorAccess())return;
  const q=wantedDiscovery.rows[index];if(!q)return;
  openFunctionalTab('effect-planner');
  $('plannerLevel').value=String(q.level);plannerDurations();
  $('plannerDuration').value=q.duration;$('plannerType').value=q.type;$('plannerValue').value=String(q.value);
  $('plannerSeasonal').checked=true;$('plannerRare').checked=true;
  plannerReset();$('plannerForm').requestSubmit();
}
$('wantedLevel').addEventListener('change',()=>{wantedDurations();renderDiscoveryWanted();});
for(const id of ['wantedDuration','wantedType'])$(id).addEventListener('change',renderDiscoveryWanted);
$('wantedMore').addEventListener('click',()=>{wantedDiscovery.limit+=30;wantedRenderPage();});
$('wantedCards').addEventListener('click',event=>{
  const button=event.target.closest('[data-wanted-how]');
  if(button)wantedOpenCalculation(Number(button.dataset.wantedHow));
});
document.addEventListener('hpwf:data-ready',()=>{wantedDurations();renderDiscoveryWanted();});
document.addEventListener('hpwf:private-data-ready',renderDiscoveryWanted);
document.addEventListener('hpwf:access-changed',renderDiscoveryWanted);
if(state.mechanics){wantedDurations();renderDiscoveryWanted();}
