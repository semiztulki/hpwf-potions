const state={ingredients:[],actions:[],mechanics:null,limits:null,potions:{},recipes:{}};
const $=id=>document.getElementById(id);
const labels={rarity:{common:"Обычный",seasonal:"Сезонный редкий",very_rare:"Особо редкий"},season:{winter:"Зима",spring:"Весна",summer:"Лето",autumn:"Осень"}};
const fmt=n=>new Intl.NumberFormat("ru-RU").format(n);
const norm=v=>String(v??"").toLowerCase().replaceAll("ё","е").trim();
const formatXp=v=>v===1?"1 опыт":v===0.5?"1/2 опыта":Math.abs(v-1/3)<0.0001?"1/3 опыта":Math.abs(v-2/3)<0.0001?"2/3 опыта":String(v);
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const durationOrder=["5m","1h","5h","1w","1mo","2mo"];
const effectLabels={concentration:"Концентрация",resistance:"Устойчивость",efficiency:"Эффективность",mana:"Мана"};
const effectWords={concentration:"концентрации",resistance:"устойчивости",efficiency:"эффективности",mana:"маны"};
let recipeView="special";
const potionCollator=new Intl.Collator("ru",{numeric:true,sensitivity:"base"});
let accessMode="locked";

function showPortalScreen(id){
  for(const screenId of ["accessScreen","homeScreen","functionalScreen"]) $(screenId).hidden=screenId!==id;
}
function updateAccessChrome(){
  const authenticated=accessMode==="authenticated";
  const text=authenticated?"Вы открыли магический замок":"Вы в гостевой каморке";
  $("homeAccessText").textContent=text;
  $("functionalAccessText").textContent=text;
  $("homeAuthAction").textContent=authenticated?"Выйти":"Войти";
  $("functionalAuthAction").textContent=authenticated?"Выйти":"Войти";
  $("footerAuthAction").textContent=authenticated?"Выйти":"Войти";
  document.querySelectorAll("[data-auth-only]").forEach(x=>x.hidden=!authenticated);
}
function showHome(mode=accessMode){
  accessMode=mode;
  updateAccessChrome();
  showPortalScreen("homeScreen");
}
function showAccessScreen(){
  accessMode="locked";
  showPortalScreen("accessScreen");
  $("entryPassword").value="";
  $("entryLoginStatus").textContent="";
}
function openFunctionalTab(id){
  if(["potions","add-recipe","review"].includes(id)&&accessMode!=="authenticated") return showAccessScreen();
  document.querySelectorAll(".tab,.tab-panel").forEach(x=>x.classList.remove("active"));
  const navButton=document.querySelector('.tab[data-tab="'+id+'"]');
  if(navButton) navButton.classList.add("active");
  $(id).classList.add("active");
  updateAccessChrome();
  showPortalScreen("functionalScreen");
  window.scrollTo({top:0,behavior:"instant"});
}

function initTabs(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>openFunctionalTab(btn.dataset.tab)));
  document.querySelectorAll("[data-home-tab]").forEach(btn=>btn.addEventListener("click",()=>openFunctionalTab(btn.dataset.homeTab)));
  $("functionalHomeButton").addEventListener("click",()=>showHome());
  $("footerHomeAction").addEventListener("click",()=>showHome());
  $("footerTopAction").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
}
function ingredientRow(x){
  const img=x.imageUrl?'<img class="catalog-icon" src="'+x.imageUrl+'" alt="">':'<span class="catalog-icon-placeholder">✦</span>';
  return '<tr><td><div class="catalog-name">'+img+'<span>'+esc(x.name)+'</span></div></td>'
    +'<td>'+x.level+'</td><td>'+labels.rarity[x.rarity]+'</td><td>'+(x.season?labels.season[x.season]:"—")+'</td>'
    +'<td class="numeric">'+fmt(x.basePower)+'</td><td class="numeric">'+x.pauseSeconds+' сек.</td><td class="numeric">'+(x.approxQuestDropRate||"—")+'</td></tr>';
}
function renderIngredients(){
  const selected=name=>{const all=document.querySelector('input[name="'+name+'"][data-filter-all]');return all.checked?null:[...document.querySelectorAll('input[name="'+name+'"]:checked')].map(x=>x.value).filter(Boolean);};
  const levels=selected("ingredient-level"),rarities=selected("ingredient-rarity"),seasons=selected("ingredient-season");
  const list=state.ingredients.filter(x=>(levels===null||levels.includes(String(x.level)))&&(rarities===null||rarities.includes(x.rarity))&&(x.rarity!=="seasonal"||seasons===null||seasons.includes(x.season)));
  $("ingredientCount").textContent=list.length+" из "+state.ingredients.length;
  $("ingredientCards").innerHTML=list.length?'<table class="catalog-table"><thead><tr><th>Ингредиент</th><th>Уровень</th><th>Категория</th><th>Сезон</th><th>Сила</th><th>Усвоение</th><th>Шанс выпадения</th></tr></thead><tbody>'+list.map(ingredientRow).join("")+'</tbody></table>':'<div class="panel empty-state">По этим фильтрам ингредиентов нет.</div>';
}
function actionRow(x){
  const img=x.imageUrl?'<img class="catalog-icon" src="'+x.imageUrl+'" alt="">':'<span class="catalog-icon-placeholder">✦</span>';
  const moon=x.kind==="moon";
  return '<tr><td><div class="catalog-name">'+img+'<span>'+esc(x.name)+(moon?'*':'')+'</span></div></td>'
    +'<td>'+x.level+'</td><td class="numeric">'+x.pauseSeconds+' сек.</td></tr>';
}
function renderActions(){
  $("actionCards").innerHTML='<table class="catalog-table action-table"><thead><tr><th>Действие</th><th>Уровень</th><th>Усвоение</th></tr></thead><tbody>'+state.actions.map(actionRow).join("")+'</tbody></table>';
}

// Астрономический расчёт по формулам SunCalc; сетевых запросов не требует.
const moonRad=Math.PI/180,moonDay=86400000,moonJ1970=2440588,moonJ2000=2451545,moonEarthObliquity=moonRad*23.4397;
const moonRightAscension=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(moonEarthObliquity)-Math.tan(b)*Math.sin(moonEarthObliquity),Math.cos(l));
const moonDeclination=(l,b)=>Math.asin(Math.sin(b)*Math.cos(moonEarthObliquity)+Math.cos(b)*Math.sin(moonEarthObliquity)*Math.sin(l));
function moonSunCoords(d){const M=moonRad*(357.5291+0.98560028*d),C=moonRad*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M)),L=M+C+moonRad*102.9372+Math.PI;return {dec:moonDeclination(L,0),ra:moonRightAscension(L,0)};}
function moonCoords(d){const L=moonRad*(218.316+13.176396*d),M=moonRad*(134.963+13.064993*d),F=moonRad*(93.272+13.22935*d),l=L+moonRad*6.289*Math.sin(M),b=moonRad*5.128*Math.sin(F);return {ra:moonRightAscension(l,b),dec:moonDeclination(l,b),dist:385001-20905*Math.cos(M)};}
function moonIllumination(date){
  const d=date.valueOf()/moonDay-.5+moonJ1970-moonJ2000,s=moonSunCoords(d),m=moonCoords(d);
  const phi=Math.acos(Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(s.ra-m.ra));
  const inc=Math.atan2(149598000*Math.sin(phi),m.dist-149598000*Math.cos(phi));
  const angle=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  return {fraction:(1+Math.cos(inc))/2,phase:.5+.5*inc*(angle<0?-1:1)/Math.PI};
}
function fullMoonCandidates(now){
  const step=3*3600000,start=now.valueOf()-35*moonDay,end=now.valueOf()+40*moonDay,samples=[];
  for(let t=start;t<=end;t+=step)samples.push({t,f:moonIllumination(new Date(t)).fraction});
  const peaks=[];
  for(let i=1;i<samples.length-1;i++)if(samples[i].f>=samples[i-1].f&&samples[i].f>=samples[i+1].f){
    let left=samples[i].t-step,right=samples[i].t+step;
    for(let n=0;n<35;n++){const a=left+(right-left)/3,b=right-(right-left)/3;if(moonIllumination(new Date(a)).fraction<moonIllumination(new Date(b)).fraction)left=a;else right=b;}
    peaks.push(new Date((left+right)/2));
  }
  return peaks;
}
function forumDate(date,withTime=false){
  const d=new Date(date.valueOf()+3600000),pad=n=>String(n).padStart(2,"0");
  return pad(d.getUTCDate())+"."+pad(d.getUTCMonth()+1)+(withTime?", "+pad(d.getUTCHours())+":"+pad(d.getUTCMinutes()):"");
}
function renderMoonStatus(){
  const now=new Date(),peaks=fullMoonCandidates(now),half=36*3600000;
  const active=peaks.find(p=>now>=p-half&&now<=p.valueOf()+half);
  let text;
  if(active){const end=new Date(active.valueOf()+half),hours=Math.max(1,Math.ceil((end-now)/3600000));text='<strong>Полнолуние сейчас, скорее загружай котлы!</strong> Оно продлится до '+forumDate(end)+', осталось '+hours+' '+plural(hours,"час","часа","часов")+'.';}
  else{
    const next=peaks.find(p=>p.valueOf()-half>now)||peaks[peaks.length-1],start=new Date(next.valueOf()-half),end=new Date(next.valueOf()+half),days=Math.max(1,Math.ceil((start-now)/moonDay)),phase=moonIllumination(now).phase;
    const phaseText=phase<.035||phase>.965?"Сейчас новолуние.":phase<.5?"Сейчас Луна растёт.":"Сейчас Луна убывает.";
    text=phaseText+' Ближайшее полнолуние будет с '+forumDate(start)+' по '+forumDate(end)+'. До начала осталось '+days+' '+plural(days,"день","дня","дней")+'.';
  }
  $("moonStatus").innerHTML='<p>'+text+'</p>';
}
function plural(n,one,few,many){const n10=n%10,n100=n%100;return n10===1&&n100!==11?one:n10>=2&&n10<=4&&(n100<12||n100>14)?few:many;}
function renderMechanics(){
  const m=state.mechanics;
  const d=m.toxicity.durationLabels;
  const toxRows=["5m","1h","5h","1w","1mo","2mo"].map(k=>{
    const v1=m.toxicity.byLevel["1"][k],v2=m.toxicity.byLevel["2"][k],v3=m.toxicity.byLevel["3"][k];
    const show=v=>v==null?"—":v;
    return '<tr><td>'+d[k]+'</td><td>'+show(v1)+'</td><td>'+show(v2)+'</td><td>'+show(v3)+'</td></tr>';
  }).join("");
  $("mechanicsContent").innerHTML=
    '<article class="mechanic-card"><p class="eyebrow">Рецепт</p><h3>Структура</h3><ul class="rules"><li>До '+m.recipe.maxIngredients+' ингредиентов.</li><li>До '+m.recipe.maxMoonElements+' Света полной луны.</li><li>Максимум '+m.recipe.maxSequenceElements+' элементов последовательности.</li><li>'+m.recipe.levelRule+'</li></ul></article>'
    +'<article class="mechanic-card"><p class="eyebrow">Ценность</p><h3>Рабочая модель</h3><ul class="rules"><li>У каждого ингредиента есть базовая сила.</li><li>К каждому экземпляру применяется случайный модификатор.</li><li>Разброс наибольший у обычных, меньше у сезонных и еще меньше у особо редких.</li><li>Сумма базовых сил без наблюдаемой ценности — расчетная оценка, а не точный результат.</li><li>Луна добавляет отдельные 0–450.</li></ul></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Токсикация</p><h3>Токсикация по уровню и длительности</h3><p>Суммарный предел активных зелий: '+m.toxicity.maxTotal+'.</p><div class="table-wrap"><table><thead><tr><th>Длительность</th><th>1 уровень</th><th>2 уровень</th><th>3 уровень</th></tr></thead><tbody>'+toxRows+'</tbody></table></div></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Последовательность</p><h3>Правила рецепта</h3><ul class="rules">'+m.recipe.sequenceRules.map(r=>'<li>'+r+'</li>').join("")+'</ul></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Опыт</p><h3>Опыт зельеварения</h3><p class="callout">'+m.brewingExperienceNote+'</p><div class="table-wrap"><table><thead><tr><th>Уровень зельевара</th><th>Порог опыта</th><th>Ингредиент 1 уровня</th><th>Ингредиент 2 уровня</th><th>Ингредиент 3 уровня</th></tr></thead><tbody>'
      +m.brewingExperience.map(x=>'<tr><td>'+x.brewerLevel+'</td><td>'+x.thresholdXp+'</td><td>'+(x.xpPerIngredient["1"]==null?"—":formatXp(x.xpPerIngredient["1"]))+'</td><td>'+(x.xpPerIngredient["2"]==null?"—":formatXp(x.xpPerIngredient["2"]))+'</td><td>'+(x.xpPerIngredient["3"]==null?"—":formatXp(x.xpPerIngredient["3"]))+'</td></tr>').join("")
      +'</tbody></table></div></article>'
    +'<article class="mechanic-card"><p class="eyebrow">Сбор</p><h3>Уровни сбора</h3><ul class="rules">'+m.gatheringLevels.map(x=>'<li>Уровень '+x.level+': '+x.thresholdXp+' опыта'+(x.questDifficulty?', сложность ВП '+x.questDifficulty:'')+'.</li>').join("")+'</ul></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Наборы</p><h3>Набор алхимика</h3><p>'+m.ingredientSets.rule+'</p><ul class="rules">'+m.ingredientSets.extraItem.map(r=>'<li>'+r+'</li>').join("")+'</ul></article>';
}

function renderCatalogLimits(){
  const d=state.mechanics.toxicity.durationLabels,rows=[];
  ["1","2","3"].forEach(level=>{
    const durations=state.limits.durationOrderByLevel[level],observed=state.limits.observedDurationsByLevel[level]||[];
    ["efficiency","resistance","concentration"].forEach(effect=>{
      const e=state.limits.effects[effect],vals=e.byLevel[level];
      const cells=vals.map((v,i)=>observed.includes(durations[i])?'<td>'+v+(e.unit==="percent"?"%":"")+'<br><span class="meta">'+d[durations[i]]+'</span></td>':'<td class="limit-missing">—</td>').join("");
      rows.push('<tr><td>'+level+'</td><td>'+e.label+'</td>'+cells+'</tr>');
    });
  });
  $("catalogLimits").innerHTML='<h2>Пределы эффектов зелий на обычных инграх</h2><div class="table-wrap"><table><thead><tr><th>Уровень</th><th>Эффект</th><th>Длительность 1</th><th>Длительность 2</th><th>Длительность 3</th><th>Длительность 4</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
}

function potionTitle(p){
  if(p.name) return p.name;
  if(p.category==="standard_old") return "Зелье старого образца №"+(p.number??"—");
  const e=(p.effects||[])[0];
  if(e&&p.number!=null) return "Зелье "+(effectLabels[e.type]||e.type).toLowerCase()+" №"+p.number;
  return p.number!=null?"Зелье №"+p.number:"Зелье без названия";
}
function comparePotions(a,b){
  const byTitle=potionCollator.compare(potionTitle(a),potionTitle(b));
  if(byTitle) return byTitle;
  const byNumber=(a.number??Number.MAX_SAFE_INTEGER)-(b.number??Number.MAX_SAFE_INTEGER);
  if(byNumber) return byNumber;
  const byDuration=durationOrder.indexOf(a.duration)-durationOrder.indexOf(b.duration);
  if(byDuration) return byDuration;
  return potionCollator.compare(potionEffectSummary(a),potionEffectSummary(b));
}
function effectValue(p,type){
  const e=(p.effects||[]).find(x=>x.type===type);
  return e?Number(e.value):-Infinity;
}
function effectLine(e){
  if(!e) return "";
  const unit=e.unit==="percent"?"%":"";
  return "+"+e.value+unit+" "+(effectWords[e.type]||e.type);
}
function potionEffectSummary(p){
  return (p.effects||[]).map(effectLine).join(" · ");
}
function recipeItems(r){
  const im=Object.fromEntries(state.ingredients.map(x=>[x.id,x]));
  const am=Object.fromEntries(state.actions.map(x=>[x.id,x]));
  return (r.sequence||[]).map(item=>{
    if(item.type==="ingredient") return '<span class="recipe-ingredient">'+esc(im[item.ref]?.name||item.ref||"неизвестный ингредиент")+'</span>';
    if(item.type==="action") return '<span class="recipe-action">'+esc(am[item.ref]?.name||item.ref||"действие")+'</span>';
    if(item.type==="moon") return '<span class="recipe-moon">Свет полной луны</span>';
    if(item.type==="unresolved") return '<span class="recipe-unresolved">['+esc(item.raw||item.label||item.value||item.ref||"неизвестный элемент")+']</span>';
    return '<span class="recipe-unresolved">['+esc(item.ref||item.raw||item.type||"неизвестный элемент")+']</span>';
  }).join('<span class="recipe-plus"> + </span>');
}
function nominalRecipeValue(r){
  const im=Object.fromEntries(state.ingredients.map(x=>[x.id,x]));
  let total=0,moon=false;
  for(const item of (r.sequence||[])){
    if(item.type==="ingredient") total+=Number(im[item.ref]?.basePower||0);
    if(item.type==="moon") moon=true;
  }
  return {total,moon};
}
function recipesForPotion(potionId){
  return Object.values(state.recipes).flat().filter(r=>r.potionId===potionId);
}
function potionSearchText(p,recipes){
  const im=Object.fromEntries(state.ingredients.map(x=>[x.id,x]));
  const am=Object.fromEntries(state.actions.map(x=>[x.id,x]));
  const bits=[potionTitle(p),p.number,p.duration,potionEffectSummary(p)];
  for(const r of recipes) for(const item of (r.sequence||[])){
    if(item.type==="ingredient") bits.push(im[item.ref]?.name||item.ref);
    else if(item.type==="action") bits.push(am[item.ref]?.name||item.ref);
    else if(item.type==="moon") bits.push("свет полной луны луна");
    else bits.push(item.raw||item.label||item.value||item.ref);
  }
  return norm(bits.join(" "));
}
function renderPotionCard(p){
  const rs=recipesForPotion(p.id);
  const observed=p.value!=null;
  const recipeHtml=rs.map((r,i)=>{
    const est=nominalRecipeValue(r);
    const estimate=!observed?'<div class="recipe-estimate">Расчетная ценность: '+fmt(est.total)+(est.moon?' + Луна 0–450':'')+'</div>':"";
    return '<div class="recipe-line"><span class="recipe-number">'+(rs.length>1?(i+1)+".":"")+'</span><div><div class="recipe-sequence">'+recipeItems(r)+'</div>'+estimate+'</div></div>';
  }).join("");
  const valueHtml=observed?'<p class="potion-value">Ценность: '+fmt(p.value)+'</p>':"";
  const meta=[state.mechanics?.toxicity?.durationLabels?.[p.duration]||p.duration,p.toxicity==null?null:"токсикация "+p.toxicity].filter(Boolean);
  return '<article class="potion-card">'
    +'<div class="potion-card-head"><div><h4>'+esc(potionTitle(p))+'</h4><p class="potion-effect">'+esc(potionEffectSummary(p))+'</p></div>'
    +'<div class="badges">'+meta.map(x=>'<span class="badge">'+esc(x)+'</span>').join("")+'</div></div>'
    +'<div class="potion-recipes"><p class="recipe-label">'+(rs.length===1?"Рецепт":"Рецепты")+'</p>'+recipeHtml+'</div>'
    +valueHtml+'</article>';
}
function durationBlock(title,potions,sorter){
  if(!potions.length) return "";
  const q=norm($("recipeSearch").value);
  const sorted=[...potions].sort(sorter);
  return '<details class="duration-block"'+(q?' open':'')+'><summary><span>'+esc(title)+'</span><span class="duration-count">'+sorted.length+' '+(sorted.length===1?"зелье":"зелий")+'</span></summary><div class="duration-content">'+sorted.map(renderPotionCard).join("")+'</div></details>';
}
function filterPotions(list){
  const q=norm($("recipeSearch").value);
  if(!q) return list;
  return list.filter(p=>potionSearchText(p,recipesForPotion(p.id)).includes(q));
}
function effectSection(title,type,potions){
  const filtered=filterPotions(potions.filter(p=>(p.effects||[]).some(e=>e.type===type)));
  if(!filtered.length) return "";
  const blocks=durationOrder.map(d=>durationBlock(state.mechanics.toxicity.durationLabels[d],filtered.filter(p=>p.duration===d),(a,b)=>effectValue(a,type)-effectValue(b,type)||(a.number??999999)-(b.number??999999))).join("");
  return blocks?'<section class="recipe-effect-section"><h3>'+esc(title)+'</h3>'+blocks+'</section>':"";
}
function oldSection(level){
  const list=filterPotions((state.potions["standard-old"]||[]).filter(p=>p.level===level));
  if(!list.length) return "";
  const blocks=durationOrder.map(d=>durationBlock(state.mechanics.toxicity.durationLabels[d],list.filter(p=>p.duration===d),(a,b)=>(a.number??999999)-(b.number??999999))).join("");
  return blocks?'<section class="recipe-effect-section recipe-old-section"><h3>Старого образца</h3>'+blocks+'</section>':"";
}
function renderLevelView(level){
  const list=(state.potions["standard-new"]||[]).filter(p=>p.level===level);
  return '<div class="recipe-page-title"><p class="eyebrow">Рецепты</p><h2>Рецепты зелий '+level+' уровня</h2></div>'
    +effectSection("Концентрация","concentration",list)
    +effectSection("Устойчивость","resistance",list)
    +effectSection("Эффективность","efficiency",list)
    +oldSection(level);
}
function specialGroupKey(p){
  if(p.category==="mana"||(p.effects||[]).some(e=>e.type==="mana")) return "mana";
  const types=[...new Set((p.effects||[]).map(e=>e.type))];
  if(types.length===0) return "other";
  if(types.length>1) return "mixed";
  return ["concentration","resistance","efficiency"].includes(types[0])?types[0]:"other";
}
function specialSection(title,key,list){
  const filtered=filterPotions(list.filter(p=>specialGroupKey(p)===key));
  if(!filtered.length) return "";
  const blocks=durationOrder.map(d=>durationBlock(state.mechanics.toxicity.durationLabels[d],filtered.filter(p=>p.duration===d),(a,b)=>{
    if(["concentration","resistance","efficiency"].includes(key)) return effectValue(a,key)-effectValue(b,key)||String(potionTitle(a)).localeCompare(potionTitle(b),"ru");
    return String(potionTitle(a)).localeCompare(potionTitle(b),"ru");
  })).join("");
  return blocks?'<section class="recipe-effect-section"><h3>'+esc(title)+'</h3>'+blocks+'</section>':"";
}
function renderSpecialView(){
  const list=[...(state.potions.special||[]),...(state.potions.mana||[])];
  return '<div class="recipe-page-title"><p class="eyebrow">Рецепты</p><h2>Именные и особые зелья</h2></div>'
    +specialSection("Концентрация","concentration",list)
    +specialSection("Устойчивость","resistance",list)
    +specialSection("Эффективность","efficiency",list)
    +specialSection("Несколько эффектов","mixed",list)
    +specialSection("Зелья маны","mana",list)
    +specialSection("Прочие","other",list);
}
function visiblePotionCount(){
  const q=norm($("recipeSearch").value);
  let list=recipeView==="special"?[...(state.potions.special||[]),...(state.potions.mana||[])]:[
    ...(state.potions["standard-new"]||[]),...(state.potions["standard-old"]||[])
  ].filter(p=>p.level===Number(recipeView.replace("level","")));
  return q?list.filter(p=>potionSearchText(p,recipesForPotion(p.id)).includes(q)).length:list.length;
}
function renderRecipeSearchResults(){
  const level=Number(recipeView.replace("level",""));
  const list=recipeView==="special"?[...(state.potions.special||[]),...(state.potions.mana||[])]:[
    ...(state.potions["standard-new"]||[]),...(state.potions["standard-old"]||[])
  ].filter(p=>p.level===level);
  const found=filterPotions(list).sort(comparePotions);
  if(!found.length) return '<div class="panel empty-state">По этому запросу ничего не найдено.</div>';
  return '<div class="recipe-page-title"><p class="eyebrow">Поиск</p><h2>Результаты по порядку названий</h2></div><div class="duration-content">'+found.map(renderPotionCard).join("")+'</div>';
}
function renderRecipeBrowser(){
  const searching=norm($("recipeSearch").value)!=="";
  $("recipeBrowser").innerHTML=searching?renderRecipeSearchResults():(recipeView==="special"?renderSpecialView():renderLevelView(Number(recipeView.replace("level",""))));
  $("recipeCount").textContent=visiblePotionCount()+" зелий";
  if(!$("recipeBrowser").innerHTML.trim()) $("recipeBrowser").innerHTML='<div class="panel empty-state">По этому запросу ничего не найдено.</div>';
}

async function loadPrivateData(password){
  const call=async(path,body={})=>{
    const r=await fetch("https://hpwf-potions-editor-api-siidraen-3125.vercel.app/api"+path,{
      method:"POST",headers:{"Content-Type":"application/json","X-Editor-Password":password},
      body:JSON.stringify(body),cache:"no-store"
    });
    let data={};try{data=await r.json();}catch(e){}
    if(!r.ok) throw new Error(data.error||("Ошибка сервера: "+r.status));
    return data;
  };
  const catalog=await call("/catalog");
  async function loadMany(paths){return (await Promise.all(paths.map(path=>call("/file",{path})))).flat();}
  const potions={},recipes={};
  for(const key of ["standard-new","standard-old","special","mana"]){
    potions[key]=await loadMany(catalog.potions[key]||[]);
    recipes[key]=await loadMany(catalog.recipes[key]||[]);
  }
  state.potions=potions;state.recipes=recipes;
  renderRecipeBrowser();
  document.dispatchEvent(new CustomEvent("hpwf:private-data-ready"));
}

async function load(){
  try{
    const [i,a,m,l]=await Promise.all([fetch("data/ingredients.json?v=20260910-1"),fetch("data/actions.json?v=20260910-1"),fetch("data/mechanics.json"),fetch("data/calculated-limits.json?v=20260910-1")]);
    if(![i,a,m,l].every(r=>r.ok)) throw new Error("load");
    state.ingredients=await i.json(); state.actions=await a.json(); state.mechanics=await m.json(); state.limits=await l.json();
    renderIngredients();renderActions();renderCatalogLimits();renderMechanics();document.dispatchEvent(new CustomEvent("hpwf:data-ready"));
  }catch(e){$("dataStatus").title="Не удалось загрузить справочник";}
}
["dataStatus"].forEach(id=>$(id).addEventListener("click",showHome));
function updateCheckSelect(input){
  const root=input.closest(".check-select"),all=root.querySelector("[data-filter-all]"),specific=[...root.querySelectorAll(".ingredient-filter:not([data-filter-all])")];
  if(input===all&&all.checked) specific.forEach(x=>x.checked=false);
  if(input!==all&&input.checked) all.checked=false;
  const chosen=specific.filter(x=>x.checked);
  if(!chosen.length) all.checked=true;
  root.querySelector("[data-filter-summary]").textContent=all.checked?"Все":chosen.length===1?chosen[0].parentElement.textContent.trim():"Выбрано: "+chosen.length;
}
function updateSeasonFilterAvailability(){
  const root=document.querySelector('[data-filter-group="ingredient-season"]'),rarityAll=document.querySelector('input[name="ingredient-rarity"][data-filter-all]'),seasonal=document.querySelector('input[name="ingredient-rarity"][value="seasonal"]');
  const enabled=!rarityAll.checked&&seasonal.checked;
  root.classList.toggle("is-disabled",!enabled);
  root.setAttribute("aria-disabled",String(!enabled));
  root.querySelectorAll("input").forEach(input=>input.disabled=!enabled);
  if(!enabled){
    root.open=false;
    root.querySelectorAll("input").forEach(input=>input.checked=input.hasAttribute("data-filter-all"));
    root.querySelector("[data-filter-summary]").textContent="Все";
  }
}
document.querySelectorAll(".ingredient-filter").forEach(input=>input.addEventListener("change",()=>{updateCheckSelect(input);if(input.name==="ingredient-rarity")updateSeasonFilterAvailability();renderIngredients();}));
document.querySelectorAll(".check-select").forEach(select=>select.addEventListener("toggle",()=>{if(select.open)document.querySelectorAll(".check-select[open]").forEach(other=>{if(other!==select)other.open=false;});}));
document.querySelector('[data-filter-group="ingredient-season"] summary').addEventListener("click",e=>{if(e.currentTarget.parentElement.classList.contains("is-disabled"))e.preventDefault();});
document.addEventListener("click",e=>{if(!e.target.closest(".check-select"))document.querySelectorAll(".check-select[open]").forEach(select=>select.open=false);});
$("moonInfoToggle").addEventListener("click",()=>{const panel=$("moonStatus"),show=panel.hidden;panel.hidden=!show;$("moonInfoToggle").setAttribute("aria-expanded",String(show));if(show)renderMoonStatus();});
$("recipeSearch").addEventListener("input",renderRecipeBrowser);
document.querySelectorAll(".recipe-view-btn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".recipe-view-btn").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  recipeView=btn.dataset.recipeView;
  renderRecipeBrowser();
}));
initTabs();load();
