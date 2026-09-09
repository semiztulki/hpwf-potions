const reviewState={rows:[]};
const reviewLabels={
  unresolved_token:"Компонент не описан",
  two_actions_in_row:"Два действия подряд",
  too_many_ingredients:"Слишком много ингредиентов",
  level_mismatch:"Ингредиент выше уровня зелья",
  source_uncertain:"Поврежден источник"
};
const escReview=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const normReview=v=>String(v??"").toLowerCase().replaceAll("ё","е").trim();
const fmtReview=n=>new Intl.NumberFormat("ru-RU").format(n);

function renderReviewQueue(){
  const q=normReview(document.getElementById("reviewSearch").value);
  const issue=document.getElementById("reviewIssue").value;
  const level=document.getElementById("reviewLevel").value;

  const rows=reviewState.rows.filter(r=>{
    const levelOk=!level||(level==="none"?r.level==null:String(r.level)===level);
    const issueOk=!issue||(r.issueCodes||[]).includes(issue);
    const hay=normReview([
      r.potionTitle,r.categoryLabel,r.effectsText,r.comment,r.recipeText,
      ...(r.issueLabels||[])
    ].join(" "));
    return levelOk&&issueOk&&(!q||hay.includes(q));
  });

  document.getElementById("reviewCount").textContent=rows.length+" из "+reviewState.rows.length;
  document.getElementById("reviewEmpty").hidden=rows.length!==0;

  document.getElementById("reviewCards").innerHTML=rows.map(r=>{
    const tags=(r.issueCodes||[]).map((code,i)=>
      '<span class="issue-tag">'+escReview((r.issueLabels||[])[i]||reviewLabels[code]||code)+'</span>'
    ).join("");

    const meta=[
      r.level==null?null:r.level+" уровень",
      r.durationLabel||null,
      r.toxicity==null?null:"токсикация "+r.toxicity,
      r.observedValue==null?null:"ценность "+fmtReview(r.observedValue)
    ].filter(Boolean);

    return '<article class="review-card">'
      +'<div class="review-card-head"><div><p class="eyebrow">'+escReview(r.categoryLabel||"Запись")+'</p><h3>'+escReview(r.potionTitle)+'</h3></div>'
      +'<div class="badges">'+meta.map(x=>'<span class="badge">'+escReview(x)+'</span>').join("")+'</div></div>'
      +(r.effectsText?'<p class="review-effects">'+escReview(r.effectsText)+'</p>':"")
      +'<div class="review-section"><p class="review-section-title">Рецепт</p><div class="review-recipe">'+escReview(r.recipeText)+'</div></div>'
      +'<div class="review-section review-problem"><div class="issue-tags">'+tags+'</div><p class="review-comment">'+escReview(r.comment)+'</p></div>'
      +'</article>';
  }).join("");
}

async function loadReviewQueue(){
  try{
    if(!adminState.password) return;
    const data=await adminApiCall("/file",{path:"data/review-queue.json"});
    reviewState.rows=data.rows||[];
    ["reviewSearch","reviewIssue","reviewLevel"].forEach(id=>document.getElementById(id).addEventListener("input",renderReviewQueue));
    renderReviewQueue();
  }catch(e){
    document.getElementById("reviewCount").textContent="ошибка";
    document.getElementById("reviewCards").innerHTML='<div class="panel empty-state">Не удалось загрузить очередь проверки.</div>';
  }
}
document.addEventListener("hpwf:private-data-ready",loadReviewQueue);
