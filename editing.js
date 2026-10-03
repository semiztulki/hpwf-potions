const potionEditState={ready:false,authKey:"",generation:0,mode:null,potion:null,recipe:null,sequence:[],busy:false,effectSnapshot:null};
const editFieldNames={name:"Название",number:"Номер",level:"Уровень",duration:"Длительность",toxicity:"Токсикация",value:"Ценность",effects:"Эффекты",description:"Комментарий автора",author:"Автор",imageUrl:"Картинка",notes:"Примечание",sequence:"Рецепт"};
const editEffectTypes=["concentration","resistance","efficiency","mana"];
function canEditPotions(){return !!(potionEditState.ready&&adminState.password&&adminState.writePassword);}
function refreshEditLinks(){renderRecipeBrowser();renderWanted();}
async function hpwfEditAuthChanged(){
  const key=JSON.stringify([adminState.password,adminState.writePassword]);
  if(key===potionEditState.authKey) return;
  potionEditState.authKey=key;potionEditState.ready=false;
  const generation=++potionEditState.generation;
  if($("potionEditDialog")?.open) $("potionEditDialog").close();
  refreshEditLinks();
  if(!adminState.password||!adminState.writePassword) return;
  try{
    const capabilities=await adminApiCall("/editor-capabilities",{});
    if(generation!==potionEditState.generation) return;
    potionEditState.ready=capabilities.editing===true;
    refreshEditLinks();
  }catch{
    // Older server versions keep the editing controls hidden until the API is upgraded.
    if(generation===potionEditState.generation) potionEditState.ready=false;
  }
}
function editAllPotions(){return [...Object.values(state.potions).flat(),...(state.wanted||[])];}
function editFindPotion(id){return editAllPotions().find(p=>p.id===id);}
function editFindRecipe(id){return Object.values(state.recipes).flat().find(r=>r.id===id);}
function editClone(value){return JSON.parse(JSON.stringify(value));}
function editExpected(p){return Object.fromEntries(Object.keys(editFieldNames).filter(k=>k!=="sequence").map(k=>[k,p[k]??null]));}
function editStatus(message,error=false){$("potionEditStatus").textContent=message;$("potionEditStatus").classList.toggle("is-error",error);}
function editField(key,label,value,type="text",extra=""){
  return '<label class="field"><span>'+esc(label)+'</span><input name="'+key+'" type="'+type+'" value="'+esc(value??"")+'" '+extra+'></label>';
}
function editEffectValues(p){
  return Object.fromEntries([...editEffectTypes.map(type=>[type,(p.effects||[]).find(e=>e.type===type&&e.unit!=="text")?.value??""]),["custom",(p.effects||[]).filter(e=>e.type==="custom"||e.unit==="text").map(e=>e.value).join("\n")]]);
}
function editPotionForm(p){
  const effects=editEffectValues(p);potionEditState.effectSnapshot=effects;
  const standard=["standard_new","standard_old"].includes(p.category);
  return '<div class="edit-fields">'
    +editField("name","Название",p.name)
    +editField("number","Номер",p.number,"number",'min="1" step="1"'+(standard?' required':''))
    +'<label class="field"><span>Уровень</span><select name="level"'+(standard?' required':'')+'><option value="">Не указан</option>'+[1,2,3].map(n=>'<option value="'+n+'"'+(p.level===n?' selected':'')+'>'+n+'</option>').join("")+'</select></label>'
    +'<label class="field"><span>Длительность</span><select name="duration"><option value="">Не указана</option>'+[...new Set([...durationOrder,...(p.duration?[p.duration]:[])])].map(d=>'<option value="'+esc(d)+'"'+(p.duration===d?' selected':'')+'>'+esc(state.mechanics?.toxicity?.durationLabels?.[d]||d)+'</option>').join("")+'</select></label>'
    +editField("toxicity","Токсикация",p.toxicity,"number",'step="any"')
    +editField("value","Ценность",p.value,"number",'min="0" step="any"')
    +editEffectTypes.map(type=>editField("effect-"+type,effectLabels[type],effects[type],"number",'step="any"')).join("")
    +'<label class="field edit-wide"><span>Особые эффекты</span><textarea name="effect-custom" rows="3">'+esc(effects.custom)+'</textarea></label>'
    +editField("author","Автор",p.author)
    +editField("imageUrl","Ссылка на картинку",p.imageUrl)
    +'<label class="field edit-wide"><span>Комментарий автора</span><textarea name="description" rows="5">'+esc(p.description)+'</textarea></label>'
    +'<label class="field edit-wide"><span>Примечание</span><textarea name="notes" rows="2">'+esc(p.notes)+'</textarea></label></div>';
}
function editItem(item){return (item.type==="ingredient"?state.ingredients:state.actions).find(x=>x.id===item.ref);}
function editRecipeForm(){
  const choices=(items,type)=>items.map(item=>'<button type="button" class="test-brew-choice" data-edit-add="'+esc(item.id)+'" data-edit-type="'+type+'" title="'+esc(item.name)+'" aria-label="Добавить: '+esc(item.name)+'">'+(item.imageUrl?'<img src="'+esc(item.imageUrl)+'" alt="">':esc(item.name))+'</button>').join("");
  return '<p class="edit-hint">Меняй порядок стрелками, убирай элементы крестиком и добавляй из списка ниже.</p><ol id="editRecipeSequence" class="edit-sequence"></ol>'
    +[1,2,3].map(level=>'<details class="edit-palette"'+(level===1?' open':'')+'><summary>Ингредиенты '+level+' уровня</summary><div class="test-brew-choice-row">'+choices(state.ingredients.filter(i=>i.level===level),"ingredient")+'</div></details>').join("")
    +'<details class="edit-palette" open><summary>Действия и Луна</summary><div class="test-brew-choice-row">'+state.actions.map(a=>choices([a],a.kind)).join("")+'</div></details>';
}
function editRenderSequence(){
  if(potionEditState.mode!=="recipe") return;
  $("editRecipeSequence").innerHTML=potionEditState.sequence.map((x,i)=>{
    const item=editItem(x);
    return '<li>'+(item?.imageUrl?'<img src="'+esc(item.imageUrl)+'" alt="">':"")+'<span>'+esc(item?.name||x.ref)+'</span><div class="edit-step-actions">'
      +'<button type="button" data-edit-move="'+i+'" data-direction="-1" aria-label="Выше: '+esc(item?.name||x.ref)+'"'+(!i?' disabled':'')+'>↑</button>'
      +'<button type="button" data-edit-move="'+i+'" data-direction="1" aria-label="Ниже: '+esc(item?.name||x.ref)+'"'+(i===potionEditState.sequence.length-1?' disabled':'')+'>↓</button>'
      +'<button type="button" data-edit-remove="'+i+'" aria-label="Убрать: '+esc(item?.name||x.ref)+'">×</button></div></li>';
  }).join("");
}
function editOpen(mode,id){
  if(!canEditPotions()) return;
  const recipe=mode==="recipe"?editFindRecipe(id):null,potion=editFindPotion(recipe?.potionId||id);
  if(!potion||(mode==="recipe"&&!recipe)) return;
  potionEditState.mode=mode;potionEditState.potion=editClone(potion);potionEditState.recipe=recipe?editClone(recipe):null;
  potionEditState.sequence=recipe?editClone(recipe.sequence):[];
  $("potionEditTitle").textContent=mode==="recipe"?"Изменить рецепт":"Изменить данные зелья";
  $("potionEditName").textContent=potionTitle(potion);
  $("potionEditFields").innerHTML=mode==="recipe"?editRecipeForm():editPotionForm(potion);
  $("potionEditSave").disabled=false;editStatus("");editRenderSequence();
  if(!$("potionEditDialog").open) $("potionEditDialog").showModal();
  editLoadHistory();
}
function editPotionPatch(form){
  const fields=editExpected(potionEditState.potion),draft={};
  for(const key of Object.keys(fields)){
    if(key==="effects") continue;
    const value=form.elements.namedItem(key).value.trim();
    draft[key]=["number","level","toxicity","value"].includes(key)?(value===""?null:Number(value)):(value||null);
    if(!["number","level","toxicity","value"].includes(key)&&value===String(fields[key]??"").trim()) draft[key]=fields[key];
  }
  const effects=Object.fromEntries([...editEffectTypes.map(t=>[t,form.elements.namedItem("effect-"+t).value.trim()]),["custom",form.elements.namedItem("effect-custom").value.trim()]]);
  const unchanged=Object.keys(effects).every(k=>String(potionEditState.effectSnapshot[k]).trim()===effects[k]);
  draft.effects=unchanged?fields.effects:[
    ...editEffectTypes.flatMap(t=>effects[t]===""?[]:[{type:t,value:Number(effects[t]),unit:(potionEditState.potion.effects||[]).find(e=>e.type===t&&e.unit!=="text")?.unit||(t==="efficiency"?"percent":"points")}]),
    ...(effects.custom?[{type:"custom",value:effects.custom,unit:"text"}]:[])
  ];
  return Object.fromEntries(Object.entries(draft).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(fields[k])));
}
async function editSave(event){
  event.preventDefault();if(potionEditState.busy||!canEditPotions()) return;
  potionEditState.busy=true;$("potionEditSave").disabled=true;editStatus("Сохраняю…");
  let saved=false;
  try{
    const recipeMode=potionEditState.mode==="recipe";
    const result=await adminApiCall(recipeMode?"/edit-recipe":"/edit-potion",recipeMode?{recipeId:potionEditState.recipe.id,expected:potionEditState.recipe.sequence,sequence:potionEditState.sequence}:{potionId:potionEditState.potion.id,expected:editExpected(potionEditState.potion),patch:editPotionPatch(event.currentTarget)});
    saved=true;
    if(result.unchanged){editStatus("Данные не изменились.");return;}
    const mode=potionEditState.mode,id=recipeMode?potionEditState.recipe.id:potionEditState.potion.id;
    await loadPrivateData(adminState.password);
    if(canEditPotions()){editOpen(mode,id);editStatus("Изменения сохранены.");}
  }catch(err){editStatus(saved?"Изменения сохранены. Не удалось обновить карточки — перезагрузи страницу.":err.message,true);}
  finally{potionEditState.busy=false;$("potionEditSave").disabled=saved&&!canEditPotions();}
}
function editHistoryValue(value,key){
  if(value==null||value==="") return "Не указано";
  if(key==="sequence") return value.map(x=>editItem(x)?.name||x.ref).join(" → ");
  if(key==="effects") return value.map(e=>e.type==="custom"||e.unit==="text"?e.value:(effectLabels[e.type]||e.type)+": "+e.value+(e.unit==="percent"?"%":"")).join("; ");
  if(key==="duration") return state.mechanics?.toxicity?.durationLabels?.[value]||value;
  return String(value);
}
async function editLoadHistory(){
  const potionId=potionEditState.potion.id;
  $("potionEditHistory").textContent="Загружаю историю…";
  try{
    const {entries}=await adminApiCall("/edit-history",{potionId});
    if(potionEditState.potion?.id!==potionId||!canEditPotions()) return;
    $("potionEditHistory").innerHTML=entries.length?entries.map(e=>{
      const change=e.changes.find(c=>c.kind===(e.kind==="recipe"?"recipes":"potions"));
      return '<details class="edit-history-entry"><summary>'+esc(new Date(e.time).toLocaleString("ru-RU"))+" · "+esc(e.undoOf?"Отмена изменения":e.kind==="recipe"?"Рецепт":"Данные зелья")+'</summary>'
        +'<dl>'+e.fields.map(k=>'<dt>'+esc(editFieldNames[k]||k)+'</dt><dd><span class="edit-before">Было: '+esc(editHistoryValue(change.before[k],k))+'</span><span>Стало: '+esc(editHistoryValue(change.after[k],k))+'</span></dd>').join("")+'</dl>'
        +(!e.undoOf&&!e.undoneAt?'<button type="button" class="potion-edit-link" data-edit-undo="'+esc(e.id)+'">Отменить это изменение</button>':e.undoneAt?'<p class="edit-hint">Изменение отменено.</p>':"")+'</details>';
    }).join(""):'<p class="edit-hint">Изменений пока нет.</p>';
  }catch(err){if(potionEditState.potion?.id===potionId) $("potionEditHistory").textContent=err.message;}
}
async function editUndo(historyId){
  if(potionEditState.busy||!canEditPotions()) return;
  potionEditState.busy=true;$("potionEditSave").disabled=true;editStatus("Отменяю изменение…");
  let saved=false;
  try{
    await adminApiCall("/undo-edit",{historyId});saved=true;
    const mode=potionEditState.mode,id=mode==="recipe"?potionEditState.recipe.id:potionEditState.potion.id;
    await loadPrivateData(adminState.password);
    if(canEditPotions()){editOpen(mode,id);editStatus("Изменение отменено.");}
  }catch(err){editStatus(saved?"Изменение отменено. Перезагрузи страницу, чтобы обновить карточки.":err.message,true);}
  finally{potionEditState.busy=false;$("potionEditSave").disabled=!canEditPotions();}
}
function initPotionEditing(){
  document.body.insertAdjacentHTML("beforeend",'<dialog id="potionEditDialog" class="potion-edit-dialog" aria-labelledby="potionEditTitle"><form id="potionEditForm"><div class="edit-dialog-head"><div><h2 id="potionEditTitle"></h2><p id="potionEditName"></p></div><button type="button" id="potionEditClose" aria-label="Закрыть">×</button></div><div id="potionEditFields"></div><p id="potionEditStatus" role="status" aria-live="polite"></p><div class="edit-save-row"><button type="submit" id="potionEditSave" class="primary-button">Сохранить изменения</button></div></form><details class="edit-history"><summary>История изменений</summary><div id="potionEditHistory"></div></details></dialog>');
  $("potionEditForm").addEventListener("submit",editSave);
  $("potionEditClose").addEventListener("click",()=>{if(!potionEditState.busy) $("potionEditDialog").close();});
  $("potionEditDialog").addEventListener("cancel",e=>{if(potionEditState.busy)e.preventDefault();});
  document.addEventListener("click",e=>{
    const button=e.target.closest("button");if(!button||!canEditPotions())return;
    if(button.dataset.editPotion) editOpen("potion",button.dataset.editPotion);
    if(button.dataset.editRecipe) editOpen("recipe",button.dataset.editRecipe);
    if(!$("potionEditDialog").contains(button)||potionEditState.busy) return;
    if(button.dataset.editAdd){
      potionEditState.sequence.push({type:button.dataset.editType,ref:button.dataset.editAdd});editRenderSequence();editStatus("");
    }
    if(button.dataset.editRemove!==undefined){potionEditState.sequence.splice(Number(button.dataset.editRemove),1);editRenderSequence();}
    if(button.dataset.editMove!==undefined){
      const i=Number(button.dataset.editMove),j=i+Number(button.dataset.direction),s=potionEditState.sequence;
      if(j>=0&&j<s.length){[s[i],s[j]]=[s[j],s[i]];editRenderSequence();}
    }
    if(button.dataset.editUndo) editUndo(button.dataset.editUndo);
  });
  hpwfEditAuthChanged();
}
initPotionEditing();
