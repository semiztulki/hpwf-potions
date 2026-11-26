(function(root){
  'use strict';
  function key(p,type,value){return [Number(p.level),p.duration,type,Number(value)].join('|');}
  function singleKnownEffect(p,level){
    if(!['standard_new','special'].includes(p.category))return null;
    const effects=p.effects||[];
    if(effects.length!==1)return null;
    const e=effects[0];
    if(!['concentration','efficiency','resistance'].includes(e.type)||!Number.isFinite(Number(e.value))||Number(e.value)<=0)return null;
    const recorded=Number(p.level);
    if(recorded!==level&&!(p.category==='special'&&![1,2,3].includes(recorded)))return null;
    return e;
  }
  function catalog(potions,recipes,ingredients,mechanics){
    const im=new Map(ingredients.map(i=>[i.id,Number(i.level)])),levels=new Map();
    for(const r of recipes){
      const refs=(r.sequence||[]).filter(x=>x.type==='ingredient').map(x=>im.get(x.ref));
      if(!refs.length||refs.some(l=>![1,2,3].includes(l)))continue;
      if(!levels.has(r.potionId))levels.set(r.potionId,new Set());
      levels.get(r.potionId).add(Math.max(...refs));
    }
    return potions.flatMap(p=>{
      if(p.category!=='special'||[1,2,3].includes(Number(p.level)))return [p];
      let candidates=[...(levels.get(p.id)||[])];
      if(!candidates.length&&mechanics){
        candidates=[1,2,3].filter(level=>mechanics.value?.effectDivisors?.[level]?.[p.duration]);
        const e=p.effects?.length===1?p.effects[0]:null,value=Number(p.value);
        if(e&&value>0&&Number.isFinite(value)){
          const fitted=candidates.filter(level=>{
            const divisor=mechanics.value.effectDivisors[level][p.duration][e.type];
            return divisor>0&&Math.ceil(value/divisor)===Number(e.value);
          });
          if(fitted.length)candidates=fitted;
        }
      }
      return candidates.length?candidates.map(level=>({...p,level})):[p];
    });
  }
  function missing(ranges,mechanics,potions,query){
    const {level,duration,type}=query,divisors=mechanics.value?.effectDivisors?.[level]?.[duration];
    if(!divisors)return [];
    const known=new Set();
    for(const p of potions){
      const e=singleKnownEffect(p,level);
      if(e)known.add(key({level,duration:p.duration},e.type,e.value));
    }
    const result=[];
    for(const effect of ['concentration','efficiency','resistance']){
      if(type!=='all'&&effect!==type)continue;
      const divisor=divisors[effect];if(!(divisor>0))continue;
      const seen=new Set();
      for(const [low,high] of ranges){
        for(let value=Math.max(1,Math.ceil(low/divisor));value<=Math.ceil(high/divisor);value++){
          if(seen.has(value))continue;seen.add(value);
          const p={level,duration};
          if(!known.has(key(p,effect,value)))result.push({level,duration,type:effect,value});
        }
      }
    }
    return result.sort((a,b)=>a.value-b.value||a.type.localeCompare(b.type));
  }
  function annotate(rows,commonRanges,seasonalRanges,mechanics){
    const contains=(ranges,q)=>{const d=mechanics.value.effectDivisors[q.level][q.duration][q.type];return ranges.some(([a,b])=>b>(q.value-1)*d&&a<=q.value*d);};
    const groups=new Map();
    for(const q of rows){const k=q.duration+'|'+q.type;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(q);}
    for(const list of groups.values()){
      list.sort((a,b)=>a.value-b.value);let start=0;
      for(let i=1;i<=list.length;i++)if(i===list.length||list[i].value!==list[i-1].value+1){for(let j=start;j<i;j++)list[j].gap=i-start;start=i;}
    }
    return rows.map(q=>({...q,tier:contains(commonRanges,q)?0:contains(seasonalRanges,q)?1:2}));
  }
  function scenarios(mechanics,potions,query){
    const byKey=new Map();
    for(const p of potions){
      const e=singleKnownEffect(p,query.level);if(!e)continue;
      const k=p.duration+'|'+e.type;if(!byKey.has(k))byKey.set(k,new Set());byKey.get(k).add(Number(e.value));
    }
    const rows=[],durationCount=Object.keys(mechanics.value.effectDivisors[query.level]||{}).length;
    for(const [duration,divisors] of Object.entries(mechanics.value.effectDivisors[query.level]||{})){
      if(query.duration!=='all'&&query.duration!==duration)continue;
      for(const type of ['concentration','efficiency','resistance'])if((query.type==='all'||type===query.type)&&divisors[type]>0)rows.push({duration,type,divisor:divisors[type],weight:1/durationCount/Object.values(divisors).filter(d=>d>0).length,known:[...(byKey.get(duration+'|'+type)||[])].sort((a,b)=>a-b)});
    }
    return rows;
  }
  function bound(a,x){let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<x)lo=m+1;else hi=m;}return lo;}
  function coverage(c,scenes,details=false){
    let unknown=0,total=0,probability=0;const outcomes=[];
    for(const s of scenes){
      const from=Math.max(1,Math.ceil(c.minimum/s.divisor)),to=Math.ceil(c.maximum/s.divisor);
      const count=to-from+1,known=bound(s.known,to+1)-bound(s.known,from),missing=count-known;
      total+=count;unknown+=missing;
      const width=c.maximum-c.minimum;
      let knownWidth=0;
      for(let i=bound(s.known,from);i<s.known.length&&s.known[i]<=to;i++){
        const value=s.known[i];knownWidth+=Math.max(0,Math.min(c.maximum,value*s.divisor)-Math.max(c.minimum,(value-1)*s.divisor));
      }
      const fresh=width>0?Math.max(0,Math.min(1,1-knownWidth/width)):(s.known.includes(Math.ceil(c.minimum/s.divisor))?0:1);
      probability+=fresh*(s.weight??1/scenes.length);
      if(details&&missing){
        const gaps=[];let start=from;
        for(const n of s.known){if(n<from)continue;if(n>to)break;if(start<n)gaps.push([start,n-1]);start=n+1;}
        if(start<=to)gaps.push([start,to]);
        outcomes.push({duration:s.duration,type:s.type,gaps,count:missing});
      }
    }
    return {unknown,total,probability,outcomes};
  }
  function exhaustedSingles(ingredients,actions,recipes){
    const signatures=new Set(recipes.filter(r=>r.sequence?.length).map(r=>JSON.stringify(r.sequence.map(x=>[x.type,x.ref]))));
    const groups=new Map();
    for(const i of ingredients){const k=i.level+'-'+i.rarity;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
    const exhausted=new Set();
    for(const [key,items] of groups)if(items.every(i=>[null,...actions.filter(a=>a.kind==='action')].every(a=>signatures.has(JSON.stringify([['ingredient',i.id],...(a?[['action',a.id]]:[])])))))exhausted.add(key);
    return exhausted;
  }
  function enumerationOptions(exhausted=new Set()){
    return {moon:'all',exclude:(c,groups)=>!c.moon&&c.count===1&&groups.some((g,i)=>c.counts[i]&&exhausted.has(g.key))};
  }
  function compositions(planner,ingredients,mechanics,potions,query,order='rare',rarity='all',limit=60,options={}){
    const scenes=scenarios(mechanics,potions,query),best=[];
    const selected=ingredients.filter(i=>rarity==='common'?i.rarity==='common':rarity==='seasonal'?i.rarity!=='very_rare':true);
    const compare=(a,b)=>order==='coverage'?b.probability-a.probability||b.unknown-a.unknown||a.rareN-b.rareN||a.seasonalN-b.seasonalN:a.rareN-b.rareN||a.seasonalN-b.seasonalN||b.probability-a.probability||b.unknown-a.unknown;
    const groups=planner.eachComposition(query.level,selected,mechanics,c=>{
      const score=coverage(c,scenes);if(!score.unknown)return;
      const candidate={...c,unknown:score.unknown,total:score.total,probability:score.probability};
      if(best.length===limit&&compare(candidate,best.at(-1))>=0)return;
      candidate.counts=c.counts.slice();
      let at=0;while(at<best.length&&compare(best[at],candidate)<=0)at++;
      best.splice(at,0,candidate);if(best.length>limit)best.pop();
    },options);
    for(const c of best)c.outcomes=coverage(c,scenes,true).outcomes;
    return {groups,candidates:best};
  }
  const api={missing,key,catalog,singleKnownEffect,exhaustedSingles,enumerationOptions,annotate,scenarios,coverage,compositions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HpwfWantedPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this);
