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

function initTabs(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab,.tab-panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  }));
}
function ingredientCard(x){
  const img=x.imageUrl?'<img class="icon" src="'+x.imageUrl+'" alt="">':'<div class="icon-placeholder">✦</div>';
  const rarityNote=x.rarity==="common"?"Случайный модификатор имеет наибольший разброс.":x.rarity==="seasonal"?"Случайный модификатор имеет меньший разброс, чем у обычных ингредиентов.":"Случайный модификатор имеет наименьший предполагаемый разброс.";
  return '<article class="ingredient-card"><div class="card-head"><div><p class="eyebrow">Уровень '+x.level+'</p><h3 class="card-title">'+x.name+'</h3></div>'+img+'</div>'
    +'<div class="badges"><span class="badge">'+labels.rarity[x.rarity]+'</span>'+(x.season?'<span class="badge">'+labels.season[x.season]+'</span>':'')+'</div>'
    +'<div class="power">'+fmt(x.basePower)+' силы</div><div class="meta"><p>Пауза при добавлении: '+x.pauseSeconds+' сек.</p>'
    +(x.approxQuestDropRate?'<p>Ориентировочная вероятность выпадения из квестов: '+x.approxQuestDropRate+'.</p>':'')+'<p>'+rarityNote+'</p></div></article>';
}
function renderIngredients(){
  const q=norm($("ingredientSearch").value),level=$("ingredientLevel").value,rarity=$("ingredientRarity").value,season=$("ingredientSeason").value;
  const list=state.ingredients.filter(x=>(!q||norm(x.name).includes(q))&&(!level||String(x.level)===level)&&(!rarity||x.rarity===rarity)&&(!season||x.season===season));
  $("ingredientCount").textContent=list.length+" из "+state.ingredients.length;
  $("ingredientCards").innerHTML=list.map(ingredientCard).join("");
}
function actionCard(x){
  const img=x.imageUrl?'<img class="icon" src="'+x.imageUrl+'" alt="">':'';
  const moon=x.kind==="moon";
  return '<article class="action-card"><div class="card-head"><div><p class="eyebrow">'+(moon?"Особый элемент":"Действие")+' · уровень '+x.level+'</p><h3 class="card-title">'+x.name+'</h3></div>'+img+'</div>'
    +'<div class="badges"><span class="badge">'+x.pauseSeconds+' сек.</span><span class="badge">Сила: 0</span>'+(moon?'<span class="badge">Бонус 0–450</span>':'')+'</div>'
    +(x.availability?'<p class="callout">'+x.availability+'</p>':'')+'<ul class="rules">'+(x.rules||[]).map(r=>'<li>'+r+'</li>').join("")+'</ul></article>';
}
function renderMechanics(){
  const m=state.mechanics;
  const d=m.toxicity.durationLabels;
  const toxRows=["5m","1h","5h","1w","1mo","2mo"].map(k=>{
    const v1=m.toxicity.byLevel["1"][k],v2=m.toxicity.byLevel["2"][k],v3=m.toxicity.byLevel["3"][k];
    const show=v=>v==null?"—":v;
    return '<tr><td>'+d[k]+'</td><td>'+show(v1)+'</td><td>'+show(v2)+'</td><td>'+show(v3)+'</td></tr>';
  }).join("");
  const limitRows=[];
  ["1","2","3"].forEach(level=>{
    const durations=state.limits.durationOrderByLevel[level];
    ["efficiency","resistance","concentration"].forEach(effect=>{
      const e=state.limits.effects[effect],vals=e.byLevel[level];
      const cells=vals.map((v,i)=>'<td>'+v+(e.unit==="percent"?"%":"")+'<br><span class="meta">'+d[durations[i]]+'</span></td>').join("");
      limitRows.push('<tr><td>'+level+'</td><td>'+e.label+'</td>'+cells+'</tr>');
    });
  });
  $("mechanicsContent").innerHTML=
    '<article class="mechanic-card"><p class="eyebrow">Рецепт</p><h3>Структура</h3><ul class="rules"><li>До '+m.recipe.maxIngredients+' ингредиентов.</li><li>До '+m.recipe.maxMoonElements+' Света полной луны.</li><li>Максимум '+m.recipe.maxSequenceElements+' элементов последовательности.</li><li>'+m.recipe.levelRule+'</li></ul></article>'
    +'<article class="mechanic-card"><p class="eyebrow">Ценность</p><h3>Рабочая модель</h3><ul class="rules"><li>У каждого ингредиента есть базовая сила.</li><li>К каждому экземпляру применяется случайный модификатор.</li><li>Разброс наибольший у обычных, меньше у сезонных и еще меньше у особо редких.</li><li>Сумма базовых сил без наблюдаемой ценности — расчетная оценка, а не точный результат.</li><li>Луна добавляет отдельные 0–450.</li></ul></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Токсикация</p><h3>Токсикация по уровню и длительности</h3><p>Суммарный предел активных зелий: '+m.toxicity.maxTotal+'.</p><div class="table-wrap"><table><thead><tr><th>Длительность</th><th>1 уровень</th><th>2 уровень</th><th>3 уровень</th></tr></thead><tbody>'+toxRows+'</tbody></table></div></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Расчеты игроков</p><h3>Пределы эффектов без редких ингредиентов</h3><p class="callout">'+state.limits.note+'</p><div class="table-wrap"><table><thead><tr><th>Уровень</th><th>Эффект</th><th>Длительность 1</th><th>Длительность 2</th><th>Длительность 3</th><th>Длительность 4</th></tr></thead><tbody>'+limitRows.join("")+'</tbody></table></div></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Последовательность</p><h3>Правила рецепта</h3><ul class="rules">'+m.recipe.sequenceRules.map(r=>'<li>'+r+'</li>').join("")+'</ul></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Опыт</p><h3>Опыт зельеварения</h3><p class="callout">'+m.brewingExperienceNote+'</p><div class="table-wrap"><table><thead><tr><th>Уровень зельевара</th><th>Порог опыта</th><th>Ингредиент 1 уровня</th><th>Ингредиент 2 уровня</th><th>Ингредиент 3 уровня</th></tr></thead><tbody>'
      +m.brewingExperience.map(x=>'<tr><td>'+x.brewerLevel+'</td><td>'+x.thresholdXp+'</td><td>'+(x.xpPerIngredient["1"]==null?"—":formatXp(x.xpPerIngredient["1"]))+'</td><td>'+(x.xpPerIngredient["2"]==null?"—":formatXp(x.xpPerIngredient["2"]))+'</td><td>'+(x.xpPerIngredient["3"]==null?"—":formatXp(x.xpPerIngredient["3"]))+'</td></tr>').join("")
      +'</tbody></table></div></article>'
    +'<article class="mechanic-card"><p class="eyebrow">Сбор</p><h3>Уровни сбора</h3><ul class="rules">'+m.gatheringLevels.map(x=>'<li>Уровень '+x.level+': '+x.thresholdXp+' опыта'+(x.questDifficulty?', сложность ВП '+x.questDifficulty:'')+'.</li>').join("")+'</ul></article>'
    +'<article class="mechanic-card wide"><p class="eyebrow">Наборы</p><h3>Набор алхимика</h3><p>'+m.ingredientSets.rule+'</p><ul class="rules">'+m.ingredientSets.extraItem.map(r=>'<li>'+r+'</li>').join("")+'</ul></article>';
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
    const [i,a,m,l]=await Promise.all([fetch("data/ingredients.json"),fetch("data/actions.json"),fetch("data/mechanics.json"),fetch("data/calculated-limits.json")]);
    if(![i,a,m,l].every(r=>r.ok)) throw new Error("load");
    state.ingredients=await i.json(); state.actions=await a.json(); state.mechanics=await m.json(); state.limits=await l.json();
    $("dataStatus").textContent="Справочник загружен";renderIngredients();$("actionCards").innerHTML=state.actions.map(actionCard).join("");renderMechanics();document.dispatchEvent(new CustomEvent("hpwf:data-ready"));
  }catch(e){$("dataStatus").textContent="Ошибка загрузки";}
}
["ingredientSearch","ingredientLevel","ingredientRarity","ingredientSeason"].forEach(id=>$(id).addEventListener("input",renderIngredients));
$("recipeSearch").addEventListener("input",renderRecipeBrowser);
document.querySelectorAll(".recipe-view-btn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".recipe-view-btn").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  recipeView=btn.dataset.recipeView;
  renderRecipeBrowser();
}));
initTabs();load();
