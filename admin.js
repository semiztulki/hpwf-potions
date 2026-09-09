const adminState={sequence:[],ready:false,password:sessionStorage.getItem("hpwf-editor-password")||"",confirmedPotionId:null};
const a$=id=>document.getElementById(id);
const adminApi="https://hpwf-potions-editor-api-siidraen-3125.vercel.app/api";

function adminStateKey(category){
  return category==="standard_new"?"standard-new":category==="standard_old"?"standard-old":category;
}
function adminPaths(category,level){
  if(category==="standard_new") return {potions:"data/potions/standard-new-l"+level+".json",recipes:"data/recipes/standard-new-l"+level+".json"};
  if(category==="standard_old") return {potions:"data/potions/standard-old-l"+level+".json",recipes:"data/recipes/standard-old-l"+level+".json"};
  if(category==="special") return {potions:"data/potions/special.json",recipes:"data/recipes/special.json"};
  throw new Error("Неизвестный раздел базы.");
}
function adminCategoryLabel(category){
  return {standard_new:"Новый образец",standard_old:"Старый образец",special:"Именное / особое"}[category]||category;
}
function adminRarityLabel(rarity){
  return {common:"обычный",seasonal:"сезонный",very_rare:"особо редкий"}[rarity]||rarity;
}
function adminNumber(id){
  const v=a$(id).value.trim();
  return v===""?null:Number(v);
}
function adminEffectsDraft(){
  const fields=[
    ["adminConcentration","concentration","points"],
    ["adminResistance","resistance","points"],
    ["adminEfficiency","efficiency","percent"]
  ];
  return fields.flatMap(([id,type,unit])=>{
    const v=a$(id).value.trim();
    return v===""?[]:[{type,value:Number(v),unit}];
  });
}
function adminDraft(){
  const category=a$("adminCategory").value;
  const level=adminNumber("adminLevel");
  const duration=a$("adminDuration").value||null;
  const value=adminNumber("adminObservedValue");
  const toxicity=(level&&duration)?state.mechanics?.toxicity?.byLevel?.[String(level)]?.[duration]??null:null;
  return {
    category,
    level,
    number:adminNumber("adminNumber"),
    name:a$("adminName").value.trim()||null,
    duration,
    toxicity,
    value,
    valueStatus:value==null?"unknown":"observed",
    effects:adminEffectsDraft(),
    description:a$("adminDescription").value.trim()||null,
    author:a$("adminAuthor").value.trim()||null
  };
}
function adminPopulateBuilder(){
  a$("adminIngredientSelect").innerHTML=state.ingredients.slice()
    .sort((a,b)=>a.level-b.level||a.rarity.localeCompare(b.rarity)||a.name.localeCompare(b.name,"ru"))
    .map(x=>'<option value="'+esc(x.id)+'">'+x.level+' уровень · '+esc(adminRarityLabel(x.rarity))+' — '+esc(x.name)+'</option>')
    .join("");
  a$("adminActionSelect").innerHTML=state.actions.filter(x=>x.kind==="action").sort((a,b)=>a.level-b.level)
    .map(x=>'<option value="'+esc(x.id)+'">'+x.level+' уровень — '+esc(x.name)+'</option>').join("");
}
function adminEffectMap(effects){
  return Object.fromEntries((effects||[]).map(e=>[e.type,e]));
}
function adminSameEffectValues(a,b){
  const am=adminEffectMap(a),bm=adminEffectMap(b);
  const keys=new Set([...Object.keys(am),...Object.keys(bm)]);
  for(const k of keys){
    if(!am[k]||!bm[k]) return false;
    if(Number(am[k].value)!==Number(bm[k].value)) return false;
    if((am[k].unit||"")!==(bm[k].unit||"")) return false;
  }
  return true;
}
function adminIdentityCandidates(d,potions){
  if(d.category==="standard_new"||d.category==="standard_old"){
    if(!d.level||d.number==null) return [];
    return potions.filter(p=>p.category===d.category&&Number(p.level)===Number(d.level)&&Number(p.number)===Number(d.number));
  }
  if(d.category==="special"){
    if(!d.name) return [];
    return potions.filter(p=>p.category===d.category&&norm(p.name)===norm(d.name));
  }
  return [];
}
function adminPotionConflicts(d,p){
  const conflicts=[];
  if(d.duration&&p.duration&&d.duration!==p.duration) conflicts.push("длительность");
  if(d.level!=null&&p.level!=null&&Number(d.level)!==Number(p.level)) conflicts.push("уровень");
  if(d.effects.length&&p.effects?.length&&!adminSameEffectValues(d.effects,p.effects)) conflicts.push("эффекты");
  if(d.value!=null&&p.value!=null&&Number(d.value)!==Number(p.value)) conflicts.push("наблюдаемая ценность");
  return conflicts;
}
function adminFindPotion(d,potions){
  const candidates=adminIdentityCandidates(d,potions);
  if(!candidates.length) return {status:"new",potion:null,candidates:[]};
  if(candidates.length===1){
    const conflicts=adminPotionConflicts(d,candidates[0]);
    return conflicts.length?{status:"conflict",potion:candidates[0],candidates,conflicts}:{status:"existing",potion:candidates[0],candidates};
  }
  const compatible=candidates.filter(p=>adminPotionConflicts(d,p).length===0);
  if(compatible.length===1) return {status:"existing",potion:compatible[0],candidates};
  if(compatible.length>1) return {status:"ambiguous",potion:null,candidates:compatible};
  return {status:"conflict",potion:null,candidates,conflicts:["в базе есть несколько записей с тем же идентификатором, но их параметры не совпадают с введенными"]};
}
function adminLocalMatch(){
  const d=adminDraft();
  const key=adminStateKey(d.category);
  return adminFindPotion(d,state.potions?.[key]||[]);
}
function adminSetIfEmpty(id,value){
  const input=a$(id);
  if((input.value===""||input.value==null)&&value!==null&&value!==undefined) input.value=String(value);
}
function adminConfirmExistingPotion(){
  const match=adminLocalMatch();
  if(match.status!=="existing") return;
  const p=match.potion,effects=adminEffectMap(p.effects);
  adminSetIfEmpty("adminLevel",p.level);
  adminSetIfEmpty("adminNumber",p.number);
  adminSetIfEmpty("adminName",p.name);
  adminSetIfEmpty("adminDuration",p.duration);
  adminSetIfEmpty("adminObservedValue",p.value);
  adminSetIfEmpty("adminConcentration",effects.concentration?.value);
  adminSetIfEmpty("adminResistance",effects.resistance?.value);
  adminSetIfEmpty("adminEfficiency",effects.efficiency?.value);
  adminSetIfEmpty("adminDescription",p.description);
  adminSetIfEmpty("adminAuthor",p.author);
  adminState.confirmedPotionId=p.id;
  adminRenderValidation();
}
function adminRenderPotionMatch(){
  const box=a$("adminPotionMatch"),d=adminDraft();
  const enough=(["standard_new","standard_old"].includes(d.category)?d.level&&d.number!=null:!!d.name);
  if(!enough){
    box.innerHTML='<div class="admin-message warning">Заполните основные данные зелья — форма сама проверит, есть ли оно уже в базе.</div>';
    return;
  }
  const m=adminLocalMatch();
  if(m.status==="existing"){
    const p=m.potion;
    const meta=[adminCategoryLabel(p.category),p.level?p.level+" уровень":null,p.duration?state.mechanics?.toxicity?.durationLabels?.[p.duration]:null,p.toxicity==null?null:"токсикация "+p.toxicity].filter(Boolean).join(" · ");
    const confirmed=adminState.confirmedPotionId===p.id;
    box.innerHTML='<div class="admin-selected-card"><p class="eyebrow">Найдено в базе</p><h4>'+esc(potionTitle(p))+'</h4><div class="meta">'+esc(meta)+'</div>'+(potionEffectSummary(p)?'<div class="potion-effect">'+esc(potionEffectSummary(p))+'</div>':"")+(confirmed?'<p class="meta admin-match-note">Зелье подтверждено. Известные свойства подставлены; пустые поля можно дополнить.</p>':'<p class="meta admin-match-note">Вы хотите добавить новый рецепт к этому зелью?</p><button type="button" class="admin-secondary-btn" data-confirm-existing>Да, добавить рецепт</button>')+'</div>';
  }else if(m.status==="new"){
    box.innerHTML='<div class="admin-message ok">Такого зелья в базе не найдено. При сохранении оно будет создано автоматически.</div>';
  }else if(m.status==="ambiguous"){
    box.innerHTML='<div class="admin-message error">Найдено несколько подходящих зелий. Уточните данные, чтобы совпадение стало однозначным.</div>';
  }else{
    box.innerHTML='<div class="admin-message error">Зелье с таким номером или названием уже есть, но не совпадают: '+esc((m.conflicts||[]).join(", "))+'. Проверьте введенные данные.</div>';
  }
}
function adminItemLabel(item){
  if(item.type==="ingredient") return state.ingredients.find(x=>x.id===item.ref)?.name||item.ref;
  if(item.type==="action") return state.actions.find(x=>x.id===item.ref)?.name||item.ref;
  if(item.type==="moon") return "Свет полной луны";
  return item.ref||item.type;
}
function adminItemKind(item){
  if(item.type==="ingredient") return "ингредиент";
  if(item.type==="action") return "действие";
  if(item.type==="moon") return "Луна";
  return "элемент";
}
function adminRenderSequence(){
  const box=a$("adminSequence");
  const count=adminState.sequence.filter(x=>x.type==="ingredient").length;
  a$("adminIngredientCount").textContent=count+" / 11";
  if(!adminState.sequence.length){
    box.className="admin-sequence empty";
    box.textContent="Рецепт пока пуст.";
    adminRenderValidation();
    return;
  }
  box.className="admin-sequence";
  box.innerHTML=adminState.sequence.map((item,i)=>
    '<div class="admin-seq-item" data-index="'+i+'"><div class="admin-seq-index">'+(i+1)+'</div><div class="admin-seq-main"><span>'+esc(adminItemLabel(item))+'</span><span class="admin-seq-kind">'+esc(adminItemKind(item))+'</span></div><div class="admin-seq-controls"><button type="button" class="admin-seq-btn" data-seq-action="up" title="Выше">↑</button><button type="button" class="admin-seq-btn" data-seq-action="down" title="Ниже">↓</button><button type="button" class="admin-seq-btn" data-seq-action="remove" title="Удалить">×</button></div></div>'
  ).join("");
  adminRenderValidation();
}
function adminSequenceSignature(sequence){
  return JSON.stringify((sequence||[]).map(x=>({type:x.type,ref:x.ref})));
}
function adminValidatePotionDraft(d){
  const errors=[];
  if(["standard_new","standard_old"].includes(d.category)){
    if(!d.level) errors.push("Укажите уровень зелья.");
    if(d.number==null) errors.push("Укажите номер зелья.");
    if(!d.duration) errors.push("Укажите длительность.");
  }
  if(d.category==="standard_new"){
    const normal=d.effects.filter(x=>["concentration","resistance","efficiency"].includes(x.type));
    if(normal.length!==1||d.effects.some(x=>x.type==="mana")) errors.push("Для зелья нового образца укажите ровно один эффект: концентрацию, устойчивость или эффективность.");
  }
  if(d.category==="standard_old"&&!d.effects.length) errors.push("Для зелья старого образца укажите хотя бы один эффект.");
  if(d.category==="special"){
    if(!d.name) errors.push("Для именного / особого зелья укажите название.");
    if(!d.duration) errors.push("Укажите длительность именного / особого зелья.");
  }
  return errors;
}
function adminValidation(){
  const errors=[],warnings=[],info=[],seq=adminState.sequence,d=adminDraft();
  errors.push(...adminValidatePotionDraft(d));

  const match=adminLocalMatch();
  if(match.status==="existing"&&adminState.confirmedPotionId!==match.potion.id) errors.push("Подтвердите, что хотите добавить новый рецепт к найденному зелью.");
  if(match.status==="conflict") errors.push("Введенные данные противоречат уже существующему зелью: "+(match.conflicts||[]).join(", ")+".");
  if(match.status==="ambiguous") errors.push("По введенным данным найдено несколько зелий. Нужно уточнить параметры.");

  const ingredientCount=seq.filter(x=>x.type==="ingredient").length;
  const moonCount=seq.filter(x=>x.type==="moon").length;
  if(!seq.length) errors.push("Добавьте хотя бы один элемент рецепта.");
  if(ingredientCount>11) errors.push("В рецепте больше 11 ингредиентов.");
  if(moonCount>1) errors.push("Свет полной луны можно добавить только один раз.");

  let seenIng=0,eleventhIndex=-1;
  seq.forEach((x,i)=>{if(x.type==="ingredient"){seenIng++;if(seenIng===11)eleventhIndex=i;}});
  if(eleventhIndex>=0&&eleventhIndex<seq.length-1) errors.push("После 11-го ингредиента есть дополнительные элементы: варка уже должна завершиться.");
  for(let i=0;i<seq.length-1;i++) if(seq[i].type==="action"&&seq[i+1].type==="action") errors.push("Два обычных действия стоят подряд.");

  const im=Object.fromEntries(state.ingredients.map(x=>[x.id,x]));
  const am=Object.fromEntries(state.actions.map(x=>[x.id,x]));
  const maxIng=Math.max(0,...seq.filter(x=>x.type==="ingredient").map(x=>im[x.ref]?.level||0));
  const maxAction=Math.max(0,...seq.filter(x=>x.type==="action").map(x=>am[x.ref]?.level||0));
  const targetLevel=match.status==="existing"?(match.potion.level??d.level):d.level;
  if(targetLevel&&maxIng>targetLevel) errors.push("В рецепте есть ингредиент "+maxIng+" уровня, а зелье относится к "+targetLevel+" уровню.");

  if(match.status==="existing"&&seq.length){
    const sig=adminSequenceSignature(seq);
    const duplicate=Object.values(state.recipes).flat().some(r=>r.potionId===match.potion.id&&adminSequenceSignature(r.sequence)===sig);
    if(duplicate) errors.push("Такой рецепт у этого зелья уже есть в базе.");
  }

  const nominal=seq.reduce((sum,x)=>sum+(x.type==="ingredient"?Number(im[x.ref]?.basePower||0):0),0);
  if(seq.length&&errors.length===0){
    info.push("Расчетная базовая ценность: "+fmt(nominal)+(moonCount?" + Луна 0–450":"")+".");
    if(targetLevel) info.push("Уровень зелья: "+targetLevel+".");
    info.push(match.status==="existing"?"Рецепт будет добавлен к существующему зелью.":"Будет создано новое зелье и добавлен его первый рецепт.");
  }
  return {errors,warnings,info};
}
function adminRenderValidation(){
  adminRenderPotionMatch();
  const box=a$("adminValidation"),v=adminValidation();
  box.innerHTML=[
    ...v.errors.map(x=>'<div class="admin-message error">'+esc(x)+'</div>'),
    ...v.warnings.map(x=>'<div class="admin-message warning">'+esc(x)+'</div>'),
    ...(!v.errors.length?v.info.map(x=>'<div class="admin-message ok">'+esc(x)+'</div>'):[])
  ].join("");
  a$("adminSubmit").disabled=v.errors.length>0;
  return v;
}
function adminAdd(item){
  adminState.sequence.push(item);
  adminRenderSequence();
}
function adminNextNumericId(arr,prefix,pad){
  let max=0;
  for(const x of arr){
    const id=String(x.id||"");
    if(!id.startsWith(prefix)) continue;
    const n=Number(id.slice(prefix.length));
    if(Number.isInteger(n)) max=Math.max(max,n);
  }
  return prefix+String(max+1).padStart(pad,"0");
}
function adminPotionId(d,current){
  if(d.category==="standard_new") return "pn-l"+d.level+"-"+d.effects[0].type+"-"+d.number;
  if(d.category==="standard_old") return "po-l"+d.level+"-"+d.number;
  if(d.category==="special") return adminNextNumericId(current,"ps-",3);
  throw new Error("Не удалось определить ID зелья.");
}
function adminRecipeId(category,level,current){
  if(category==="standard_new") return adminNextNumericId(current,"rn-l"+level+"-",4);
  if(category==="standard_old") return adminNextNumericId(current,"ro-l"+level+"-",4);
  if(category==="special") return adminNextNumericId(current,"rs-",4);
  throw new Error("Не удалось определить ID рецепта.");
}
async function adminApiCall(path,body){
  const r=await fetch(adminApi+path,{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Editor-Password":adminState.password},
    body:JSON.stringify(body||{})
  });
  let data={}; try{data=await r.json();}catch(e){}
  if(!r.ok) throw new Error(data.error||("Ошибка сервера: "+r.status));
  return data;
}
async function adminAuthenticate(password){
  if(!password) throw new Error("Введите пароль.");
  adminState.password=password;
  try{
    await adminApiCall("/auth",{});
    await loadPrivateData(password);
  }catch(err){
    adminState.password="";
    throw err;
  }
  sessionStorage.setItem("hpwf-editor-password",password);
  adminRenderAuth();
}
async function adminLogin(){
  const password=a$("editorPassword").value;
  await adminAuthenticate(password);
  a$("editorPassword").value="";
}
async function databaseLogin(){
  const password=a$("databasePassword").value;
  await adminAuthenticate(password);
  a$("databasePassword").value="";
}
function adminLogout(){
  adminState.password="";
  state.potions={};state.recipes={};
  if(typeof reviewState!=="undefined") reviewState.rows=[];
  sessionStorage.removeItem("hpwf-editor-password");
  adminRenderAuth();
}
function adminRenderAuth(){
  const logged=!!adminState.password;
  a$("editorGate").hidden=logged;
  a$("adminRecipeForm").hidden=!logged;
  a$("editorLoginStatus").textContent="";
  const databaseGate=a$("databaseGate"),databaseContent=a$("databaseContent"),databaseStatus=a$("databaseLoginStatus");
  if(databaseGate) databaseGate.hidden=logged;
  if(databaseContent) databaseContent.hidden=!logged;
  const recipeCount=a$("recipeCount");
  if(recipeCount) recipeCount.hidden=!logged;
  const reviewPanel=a$("reviewPrivateContent"),reviewCount=a$("reviewCount");
  if(reviewPanel) reviewPanel.hidden=!logged;
  if(reviewCount) reviewCount.hidden=!logged;
  if(databaseStatus&&logged) databaseStatus.textContent="";
}
async function adminSubmitRecipe(){
  const validation=adminValidation();
  if(validation.errors.length) throw new Error("Исправьте ошибки формы перед сохранением.");
  if(!adminState.password) throw new Error("Сначала войдите с паролем редактора.");
  const d=adminDraft();
  const result=await adminApiCall("/add-recipe",{potion:d,sequence:adminState.sequence.map(x=>({...x}))});
  const key=adminStateKey(d.category);
  const localMatch=adminFindPotion(d,state.potions[key]||[]);
  let potion=localMatch.potion;
  if(result.created){
    potion={id:result.potionId,number:d.number,name:d.name,category:d.category,level:d.level,duration:d.duration,toxicity:d.toxicity,value:d.value,valueStatus:d.valueStatus,effects:d.effects,description:d.description,author:d.author,notes:null,sources:[{file:"Добавлено через форму",line:null}],validation:{status:"ok",issues:[]}};
    state.potions[key].push(potion);
  }else if(result.updated&&potion){
    for(const field of ["name","duration","toxicity","value","description","author"]){
      if((potion[field]==null||potion[field]==="")&&d[field]!=null&&d[field]!=="") potion[field]=d[field];
    }
    if((!potion.effects||!potion.effects.length)&&d.effects.length) potion.effects=d.effects;
    if(potion.value!=null) potion.valueStatus=d.valueStatus;
  }
  state.recipes[key].push({id:result.recipeId,potionId:result.potionId,sequence:adminState.sequence.map(x=>({...x})),source:{file:"Добавлено через форму",line:null},validation:{status:"ok",issues:[]}});
  renderRecipeBrowser();
  adminState.sequence=[];
  adminState.confirmedPotionId=null;
  adminRenderSequence();
  adminRenderPotionMatch();
  adminRenderAuth();
  return result;
}
function adminStatus(text,type=""){
  const el=a$("adminStatus");
  el.textContent=text;
  el.className="admin-status"+(type?" "+type:"");
}
function initAdmin(){
  if(adminState.ready||!state.ingredients?.length) return;
  adminState.ready=true;
  adminPopulateBuilder();

  ["adminCategory","adminLevel","adminNumber","adminName","adminDuration","adminObservedValue","adminConcentration","adminResistance","adminEfficiency","adminDescription","adminAuthor"]
    .forEach(id=>a$(id).addEventListener("input",adminRenderValidation));

  a$("adminPotionMatch").addEventListener("click",e=>{
    if(e.target.closest("[data-confirm-existing]")) adminConfirmExistingPotion();
  });

  a$("adminAddIngredient").addEventListener("click",()=>adminAdd({type:"ingredient",ref:a$("adminIngredientSelect").value}));
  a$("adminAddAction").addEventListener("click",()=>adminAdd({type:"action",ref:a$("adminActionSelect").value}));
  a$("adminAddMoon").addEventListener("click",()=>adminAdd({type:"moon",ref:"full-moon"}));

  a$("adminSequence").addEventListener("click",e=>{
    const btn=e.target.closest("[data-seq-action]");
    if(!btn) return;
    const row=btn.closest("[data-index]");
    const i=Number(row.dataset.index),action=btn.dataset.seqAction;
    if(action==="remove") adminState.sequence.splice(i,1);
    if(action==="up"&&i>0) [adminState.sequence[i-1],adminState.sequence[i]]=[adminState.sequence[i],adminState.sequence[i-1]];
    if(action==="down"&&i<adminState.sequence.length-1) [adminState.sequence[i+1],adminState.sequence[i]]=[adminState.sequence[i],adminState.sequence[i+1]];
    adminRenderSequence();
  });

  document.querySelectorAll("[data-password-toggle]").forEach(btn=>btn.addEventListener("click",()=>{
    const input=a$(btn.dataset.passwordToggle);
    const show=input.type==="password";
    input.type=show?"text":"password";
    btn.classList.toggle("active",show);
    btn.setAttribute("aria-label",show?"Скрыть пароль":"Показать пароль");
    btn.setAttribute("title",show?"Скрыть пароль":"Показать пароль");
  }));

  a$("editorLoginButton").addEventListener("click",async ()=>{
    const st=a$("editorLoginStatus"); st.textContent="Проверяю пароль…"; st.className="admin-status";
    try{await adminLogin();st.textContent="";}catch(err){adminState.password="";sessionStorage.removeItem("hpwf-editor-password");st.textContent=err.message||String(err);st.className="admin-status error";}
  });
  a$("editorPassword").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();a$("editorLoginButton").click();}});
  a$("editorLogoutButton").addEventListener("click",adminLogout);

  a$("databaseLoginButton").addEventListener("click",async ()=>{
    const st=a$("databaseLoginStatus"); st.textContent="Проверяю пароль…"; st.className="admin-status";
    try{await databaseLogin();}catch(err){sessionStorage.removeItem("hpwf-editor-password");st.textContent=err.message||String(err);st.className="admin-status error";}
  });
  a$("databasePassword").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();a$("databaseLoginButton").click();}});
  a$("databaseLogoutButton").addEventListener("click",adminLogout);

  a$("adminRecipeForm").addEventListener("submit",async e=>{
    e.preventDefault();
    adminStatus("Записываю в GitHub…");
    a$("adminSubmit").disabled=true;
    try{
      const r=await adminSubmitRecipe();
      adminStatus(r.created?"Создано новое зелье и добавлен рецепт.":"Рецепт добавлен к существующему зелью.","success");
    }catch(err){
      adminStatus(err.message||String(err),"error");
    }finally{
      adminRenderValidation();
    }
  });

  adminRenderSequence();
  adminRenderPotionMatch();
  adminRenderAuth();
  if(adminState.password) adminAuthenticate(adminState.password).catch(()=>adminLogout());
}
document.addEventListener("hpwf:data-ready",initAdmin);
if(typeof state!=="undefined"&&state.ingredients?.length) initAdmin();
