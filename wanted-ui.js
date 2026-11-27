'use strict';
const wantedDiscovery={rows:[],limit:30,revision:0,cache:new Map(),ingredients:null,mechanics:null,compositionResult:null};
function wantedEditorAccess(){return accessMode==='authenticated'&&!!adminState.password;}
function wantedResetFilters(){
  for(const id of ['wantedLevel','wantedDuration','wantedType','wantedRarity'])$(id).value='all';
  $('wantedMode').value='targets';$('wantedOrder').value='rare';$('wantedNoMoon').checked=false;
  wantedDurations();
}
function wantedDurations(){
  const level=$('wantedLevel').value,previous=$('wantedDuration').value;
  const levels=level==='all'?[1,2,3]:[Number(level)];
  const durations=[...new Set(levels.flatMap(l=>Object.keys(state.mechanics?.value?.effectDivisors?.[l]||{})))];
  $('wantedDuration').innerHTML='<option value="all">все длительности</option>'+durations.map(d=>'<option value="'+d+'">'+esc(calculatorDurationLabels[d]||d)+'</option>').join('');
  $('wantedDuration').value=previous==='all'||durations.includes(previous)?previous:'all';
}
function wantedControlLabels(){
  const compositions=$('wantedMode').value==='compositions';
  $('wantedDurationField').hidden=compositions;$('wantedTypeField').hidden=compositions;
  if($('wantedOrder').options)$('wantedOrder').options[1].textContent='больший шанс наварить кросивое';
  $('wantedModeTip').textContent=compositions?'лучшие сочетания ингредиентов для твоих будущих открытий':'этого эффекта нет в факультетской базе';
  const orderHelp=$('wantedOrder').value==='rare';
  const orderButton=document.querySelector('[aria-controls="wantedOrderTip"]');
  orderButton.hidden=!orderHelp;
  if(!orderHelp){orderButton.setAttribute('aria-expanded','false');$('wantedOrderTip').hidden=true;}
}
function wantedRenderPage(){
  if(!wantedEditorAccess())return;
  if($('wantedMode').value==='compositions')return wantedRenderCompositions();
  $('wantedCards').classList.remove('wanted-compositions');
  $('wantedCount').textContent=fmt(wantedDiscovery.rows.length);
  $('wantedCards').innerHTML=wantedDiscovery.rows.slice(0,wantedDiscovery.limit).map((q,i)=>'<article class="panel wanted-card wanted-discovery-card wanted-effect-'+q.type+'"><h3>'+esc(effectLabels[q.type])+': +'+q.value+(q.type==='efficiency'?'%':'')+'</h3><div class="badges"><span class="badge">'+q.level+' уровень</span><span class="badge">'+esc(calculatorDurationLabels[q.duration]||q.duration)+'</span><span class="badge">'+['Обычные','Сезонные','Особо редкие'][q.tier]+'</span></div><button type="button" class="admin-secondary-btn wanted-how" data-wanted-how="'+i+'">Как сварить?</button></article>').join('')||'<div class="panel empty-state">В выбранном диапазоне нет неизвестных зелий.</div>';
  $('wantedMore').hidden=wantedDiscovery.limit>=wantedDiscovery.rows.length;
}
function renderDiscoveryWanted(){
  const revision=++wantedDiscovery.revision;
  wantedControlLabels();
  if(!wantedEditorAccess()){
    wantedDiscovery.rows=[];wantedDiscovery.compositionResult=null;$('wantedCards').innerHTML='';$('wantedCount').textContent='0';$('wantedMore').hidden=true;return;
  }
  if(!state.mechanics||!state.ingredients.length)return;
  if(!$('wantedDuration').value)wantedDurations();
  const compositionMode=$('wantedMode').value==='compositions',levels=$('wantedLevel').value==='all'?[1,2,3]:[Number($('wantedLevel').value)];
  const filter={duration:compositionMode?'all':$('wantedDuration').value,type:compositionMode?'all':$('wantedType').value};
  $('wantedCards').innerHTML='<p class="meta" role="status">Подбираю неизвестные зелья…</p>';$('wantedMore').hidden=true;
  window.setTimeout(()=>{
    if(revision!==wantedDiscovery.revision||!wantedEditorAccess())return;
    if(wantedDiscovery.ingredients!==state.ingredients||wantedDiscovery.mechanics!==state.mechanics){wantedDiscovery.cache.clear();wantedDiscovery.ingredients=state.ingredients;wantedDiscovery.mechanics=state.mechanics;}
    const exhausted=HpwfWantedPlanner.exhaustedSingles(state.ingredients,state.actions,Object.values(state.recipes).flat()),options=HpwfWantedPlanner.enumerationOptions(exhausted);
    if($('wantedNoMoon').checked)options.moon=false;
    const known=HpwfWantedPlanner.catalog([...(state.catalogPotions||[]),...Object.values(state.potions).flat(),...(state.wanted||[])],Object.values(state.recipes).flat(),state.ingredients,state.mechanics);
    const rows=[],compositions=[];
    for(const level of levels){
      const query={level,...filter};
      if(compositionMode){
        const result=HpwfWantedPlanner.compositions(HpwfEffectPlanner,state.ingredients,state.mechanics,known,query,$('wantedOrder').value,$('wantedRarity').value,60,options);
        compositions.push(...result.candidates.map(c=>({...c,level,groups:result.groups})));
      }else{
        const ranges=HpwfEffectPlanner.valueRanges(level,state.ingredients,state.mechanics,options);
        const common=HpwfEffectPlanner.valueRanges(level,state.ingredients.filter(i=>i.rarity==='common'),state.mechanics,options);
        const seasonal=HpwfEffectPlanner.valueRanges(level,state.ingredients.filter(i=>i.rarity!=='very_rare'),state.mechanics,options);
        const durations=query.duration==='all'?Object.keys(state.mechanics.value.effectDivisors[level]):[query.duration];
        const missing=durations.flatMap(duration=>HpwfWantedPlanner.missing(ranges,state.mechanics,known,{...query,duration}));
        rows.push(...HpwfWantedPlanner.annotate(missing,common,seasonal,state.mechanics));
      }
    }
    if(compositionMode){
      const compare=(a,b)=>$('wantedOrder').value==='coverage'?b.probability-a.probability||b.unknown-a.unknown||a.rareN-b.rareN||a.seasonalN-b.seasonalN:a.rareN-b.rareN||a.seasonalN-b.seasonalN||b.probability-a.probability||b.unknown-a.unknown;
      wantedDiscovery.compositionResult={candidates:compositions.sort(compare).slice(0,60)};
    }else wantedDiscovery.rows=rows.filter(q=>$('wantedRarity').value==='common'?q.tier===0:$('wantedRarity').value==='seasonal'?q.tier<2:true)
      .sort((a,b)=>$('wantedOrder').value==='coverage'?b.gap-a.gap||a.tier-b.tier||a.level-b.level||a.value-b.value:a.tier-b.tier||b.gap-a.gap||a.level-b.level||a.value-b.value);
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
for(const id of ['wantedDuration','wantedType','wantedOrder','wantedRarity','wantedNoMoon'])$(id).addEventListener('change',renderDiscoveryWanted);
$('wantedMode').addEventListener('change',()=>{if($('wantedMode').value==='compositions'){$('wantedDuration').value='all';$('wantedType').value='all';}renderDiscoveryWanted();});
$('wantedMore').addEventListener('click',()=>{wantedDiscovery.limit+=30;wantedRenderPage();});
$('wantedCards').addEventListener('click',event=>{
  const button=event.target.closest('[data-wanted-how]');
  if(button)wantedOpenCalculation(Number(button.dataset.wantedHow));
  const target=event.target.closest('[data-wanted-outcome]');
  if(target&&wantedEditorAccess()){const [i,j]=target.dataset.wantedOutcome.split(':').map(Number),o=wantedDiscovery.compositionResult?.candidates[i]?.outcomes[j];if(o)wantedCalculate({level:wantedDiscovery.compositionResult.candidates[i].level,duration:o.duration,type:o.type,value:o.gaps[0][0]});}
});
document.addEventListener('hpwf:data-ready',()=>{wantedDurations();renderDiscoveryWanted();});
document.addEventListener('hpwf:private-data-ready',renderDiscoveryWanted);
document.addEventListener('hpwf:access-changed',renderDiscoveryWanted);
if(state.mechanics){wantedDurations();renderDiscoveryWanted();}

function wantedRenderCompositions(){
  const r=wantedDiscovery.compositionResult;if(!r)return;
  $('wantedCount').textContent=fmt(r.candidates.length);
  $('wantedCards').classList.add('wanted-compositions');
  $('wantedCards').innerHTML=r.candidates.slice(0,wantedDiscovery.limit).map((c,i)=>'<article class="panel wanted-card"><h3 title="Оценка при равных шансах видов эффекта и доступных длительностей, равномерной ценности внутри расчётного диапазона.">Шанс сварить что-то новенькое: ≈'+new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:1}).format(c.probability)+'</h3><p class="meta">'+c.level+' уровень</p><div class="planner-groups">'+c.groups.map((g,j)=>c.counts[j]?plannerGroupTile(g,c.counts[j]):'').join('')+(c.moon?plannerMoonTile():'')+'</div><p class="meta">Ценность: '+fmt(Math.round(c.minimum))+'–'+fmt(Math.round(c.maximum))+'</p><details class="wanted-outcomes"><summary>Какие зелья мы пытаемся сварить</summary>'+c.outcomes.map((o,j)=>'<div><strong>'+esc(calculatorDurationLabels[o.duration])+' · '+esc(effectLabels[o.type])+'</strong><p>'+o.gaps.map(([a,b])=>a===b?String(a):a+'–'+b).join(', ')+(o.type==='efficiency'?'%':'')+'</p><button type="button" class="wanted-add-link" data-wanted-outcome="'+i+':'+j+'">Как сварить?</button></div>').join('')+'</details></article>').join('')||'<div class="panel empty-state">Для этих фильтров нет новых целей.</div>';
  $('wantedMore').hidden=wantedDiscovery.limit>=r.candidates.length;
}

function wantedCloseHelp(except){
  document.querySelectorAll('.info-button[aria-controls]').forEach(button=>{
    if(button===except)return;
    button.setAttribute('aria-expanded','false');
    $(button.getAttribute('aria-controls')).hidden=true;
  });
}
document.querySelectorAll('.info-button[aria-controls]').forEach(button=>{
  button.addEventListener('click',()=>{
    const open=button.getAttribute('aria-expanded')!=='true';
    wantedCloseHelp();
    button.setAttribute('aria-expanded',String(open));
    $(button.getAttribute('aria-controls')).hidden=!open;
  });
});
for(const eventName of ['pointerdown','focusin'])document.addEventListener(eventName,event=>{
  if(!event.target.closest('.info-button'))wantedCloseHelp();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')wantedCloseHelp();});
