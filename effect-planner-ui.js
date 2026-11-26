"use strict";
const effectPlannerState={result:null,query:null,limit:12,revision:0};
function plannerDurations(){
  const level=Number($("plannerLevel").value),previous=$("plannerDuration").value;
  const options=Object.keys(state.mechanics?.value?.effectDivisors?.[level]||{});
  $("plannerDuration").innerHTML=options.map(d=>'<option value="'+d+'">'+esc(calculatorDurationLabels[d]||d)+'</option>').join("");
  if(options.includes(previous))$("plannerDuration").value=previous;
}
function plannerGroupTile(group,count){
  const kind={common:"Обычный",seasonal:"Сезонный",very_rare:"Особо редкий"}[group.rarity];
  const label=kind+" ингредиент "+group.level+" уровня";
  const first=group.ingredients[0].imageUrl||"",gif="assets/groups/"+group.key+".gif";
  return '<div class="planner-group" tabindex="0" role="group" aria-label="'+esc(label)+', '+count+' шт."><div class="planner-group-picture"><picture><source media="(prefers-reduced-motion: reduce)" srcset="'+esc(first)+'"><img src="'+gif+'" width="56" height="56" alt="'+esc(label)+'" loading="lazy"></picture><strong>×'+count+'</strong></div><span class="planner-group-label">'+esc(kind)+' · '+group.level+' ур.</span><div class="planner-tip" role="tooltip"><strong>'+esc(label)+'</strong><p>'+group.ingredients.map(i=>esc(i.name)).join(", ")+'</p></div></div>';
}
function plannerRender(){
  const result=effectPlannerState.result,q=effectPlannerState.query;if(!result)return;
  const sorted=HpwfEffectPlanner.rank(result.candidates,$("plannerSort").value,{seasonal:$("plannerSeasonal").checked,veryRare:$("plannerRare").checked});
  $("plannerCount").textContent=fmt(sorted.length);
  $("plannerCompositions").innerHTML=sorted.slice(0,effectPlannerState.limit).map(c=>'<article class="panel planner-option"><div class="planner-option-head"><h3>'+c.count+' '+plural(c.count,"ингредиент","ингредиента","ингредиентов")+'</h3><span class="meta">'+(c.rareN?'Особо редких: '+c.rareN:'Без особо редких')+'</span></div><div class="planner-groups">'+result.groups.map((g,i)=>c.counts[i]?plannerGroupTile(g,c.counts[i]):"").join("")+'</div><p class="planner-value">Ценность: '+fmt(Math.round(c.base))+' <span class="meta">('+fmt(Math.round(c.minimum))+'–'+fmt(Math.round(c.maximum))+')</span></p><p class="potion-effect">Значение эффекта: '+c.from+'–'+c.to+'</p></article>').join("");
  if(!sorted.length)$("plannerCompositions").innerHTML='<div class="panel empty-state">Подходящих составов нет. Попробуй изменить фильтры или параметры зелья.</div>';
  $("plannerMore").hidden=effectPlannerState.limit>=sorted.length;
}
function plannerExisting(q){
  const all=[...Object.values(state.potions).flat(),...(state.wanted||[])];
  const seen=new Set(),potions=all.filter(p=>{
    if(seen.has(p.id))return false;seen.add(p.id);
    return p.category==="standard_new"&&Number(p.level)===q.level&&p.duration===q.duration&&p.effects?.length===1&&p.effects[0].type===q.type&&Number(p.effects[0].value)===q.value;
  });
  $("plannerFound").hidden=!potions.length;
  $("plannerFoundCards").innerHTML=potions.map(p=>{
    const recipes=Object.values(state.recipes).flat().filter(r=>r.potionId===p.id);
    return '<article class="panel"><h3>'+esc(potionTitle(p))+'</h3><p class="potion-effect">'+esc(potionEffectSummary(p))+'</p>'+recipes.map(r=>'<div class="recipe-sequence">'+recipeItems(r)+'</div>').join("")+'</article>';
  }).join("");
}
function plannerReset(){
  effectPlannerState.revision++;effectPlannerState.result=null;
  $("plannerOutput").hidden=true;$("plannerFound").hidden=true;$("plannerError").textContent="";$("plannerSubmit").disabled=false;
}
function initEffectPlanner(){
  $("plannerLevel").addEventListener("change",()=>{plannerDurations();plannerReset();});
  for(const id of ["plannerDuration","plannerType","plannerValue"])$(id).addEventListener("input",plannerReset);
  for(const id of ["plannerSort","plannerSeasonal","plannerRare"])$(id).addEventListener("change",()=>{effectPlannerState.limit=12;plannerRender();});
  $("plannerMore").addEventListener("click",()=>{effectPlannerState.limit+=12;plannerRender();});
  $("plannerForm").addEventListener("submit",event=>{
    event.preventDefault();plannerReset();
    const q={level:Number($("plannerLevel").value),duration:$("plannerDuration").value,type:$("plannerType").value,value:Number($("plannerValue").value)};
    try{HpwfEffectPlanner.target(q,state.mechanics);}catch(e){$("plannerError").textContent=e.message;return;}
    const revision=effectPlannerState.revision;$("plannerSubmit").disabled=true;$("plannerError").textContent="Подбираю сочетания…";
    window.setTimeout(()=>{
      if(revision!==effectPlannerState.revision)return;
      try{
        effectPlannerState.result=HpwfEffectPlanner.solve(q,state.ingredients,state.mechanics);effectPlannerState.query=q;effectPlannerState.limit=12;
        const r=effectPlannerState.result;
        $("plannerTarget").textContent="Нужная ценность: больше "+fmt(r.low)+" и не выше "+fmt(r.high);
        plannerExisting(q);plannerRender();$("plannerOutput").hidden=false;$("plannerError").textContent="";
      }catch(e){$("plannerError").textContent=e.message;}
      $("plannerSubmit").disabled=false;
    },0);
  });
  document.addEventListener("hpwf:data-ready",plannerDurations);
  document.addEventListener("hpwf:private-data-ready",plannerReset);
  if(state.mechanics)plannerDurations();
}
initEffectPlanner();
