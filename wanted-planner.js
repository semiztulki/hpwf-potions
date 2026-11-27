(function(root){
  'use strict';
  function key(p,type,value){return [Number(p.level),p.duration,type,Number(value)].join('|');}
  function ordinaryOutcome(p){
    return ['standard_new','special'].includes(p.category)&&!p.scripted&&!p.discoveryExcluded&&p.generation!=='scripted';
  }
  function singleKnownEffect(p,level){
    if(!ordinaryOutcome(p))return null;
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
    const rows=[],durations=Object.keys(mechanics.value.effectDivisors[query.level]||{});
    const calibration=mechanics.value.discoveryDurationModel,counts=calibration?.counts?.[query.level];
    const prior=calibration?.pseudocount??0;
    const mass=durations.reduce((sum,d)=>sum+(counts?Math.max(0,Number(counts[d])||0)+prior:1),0);
    const durationWeight=d=>mass>0?(counts?Math.max(0,Number(counts[d])||0)+prior:1)/mass:1/durations.length;
    for(const [duration,divisors] of Object.entries(mechanics.value.effectDivisors[query.level]||{})){
      if(query.duration!=='all'&&query.duration!==duration)continue;
      for(const type of ['concentration','efficiency','resistance'])if((query.type==='all'||type===query.type)&&divisors[type]>0)rows.push({duration,type,divisor:divisors[type],weight:durationWeight(duration)/Object.values(divisors).filter(d=>d>0).length,known:[...(byKey.get(duration+'|'+type)||[])].sort((a,b)=>a-b)});
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
  function sequenceAvailability(ingredients,actions,recipes){
    const im=new Map(ingredients.map(i=>[i.id,i])),actionIds=new Set(actions.filter(a=>a.kind==='action').map(a=>a.id));
    const moonIds=new Set(actions.filter(a=>a.kind==='moon').map(a=>a.id));
    // At most 11 ingredients per group: base-12 digits cannot carry into another group.
    // The nine level/rarity groups fit exactly in a Number; the low bit marks Moon.
    const groupCodes=new Map(),groupSizes=new Map(),codesByGroups=new WeakMap();let nextCode=2;
    for(const i of ingredients){
      const key=i.level+'-'+i.rarity;
      if(!groupCodes.has(key)){groupCodes.set(key,nextCode);nextCode*=12;}
      groupSizes.set(key,(groupSizes.get(key)||0)+1);
    }
    function compositionKey(c,groups){
      let codes=codesByGroups.get(groups);
      if(!codes){codes=groups.map(g=>groupCodes.get(g.key));codesByGroups.set(groups,codes);}
      let key=c.moon?1:0;
      for(let i=0;i<codes.length;i++)key+=codes[i]*(c.counts[i]||0);
      return key;
    }
    const seen=new Set(),known=new Map(),minimumTotals=new Map(),cache=new Map();
    const tolerance=0.0001; // 0.01 percentage point of final discovery probability.
    function templateCount(count,moon){
      const slots=count===11?10:count,choices=actionIds.size+1;
      return moon?(slots+1)*Math.pow(choices,slots+1):Math.pow(choices,slots);
    }
    for(const recipe of recipes){
      const seq=recipe.sequence;if(!seq?.length||seq.length>23||seq[0].type==='action')continue;
      let key=0,n=0,moons=0,valid=true;
      for(let at=0;at<seq.length;at++){
        const x=seq[at];
        if(x.type==='ingredient'){
          const i=im.get(x.ref);if(!i){valid=false;break;}
          key+=groupCodes.get(i.level+'-'+i.rarity);
          if(++n>11||(n===11&&at!==seq.length-1)){valid=false;break;}
        }else if(x.type==='action'){
          if(!actionIds.has(x.ref)||seq[at-1]?.type==='action'){valid=false;break;}
        }else if(x.type==='moon'){
          if(!moonIds.has(x.ref)||++moons>1){valid=false;break;}
          key++;
        }else{valid=false;break;}
      }
      if(!valid||!n)continue;
      const signature=JSON.stringify(seq.map(x=>[x.type,x.ref]));if(seen.has(signature))continue;seen.add(signature);
      known.set(key,(known.get(key)||0)+1);
      if(!minimumTotals.has(key)){
        let choices=1;
        for(const x of seq)if(x.type==='ingredient'){
          const i=im.get(x.ref);choices*=groupSizes.get(i.level+'-'+i.rarity);
        }
        // Omitting permutations of different groups gives a safe lower bound on N.
        minimumTotals.set(key,choices*templateCount(n,moons));
      }
    }
    function calculate(c,groups,key){
      if(cache.has(key))return cache.get(key);
      // Ordered group slots, concrete ingredient choices (repetition allowed), then actions/Moon.
      let orders=1,used=0;
      groups.forEach((g,i)=>{
        const count=c.counts[i];
        for(let j=1;j<=count;j++)orders*=(used+j)/j;
        used+=count;orders*=Math.pow(g.ingredients.length,count);
      });
      const total=orders*templateCount(c.count,c.moon),recorded=known.get(key)||0;
      const result={total,known:recorded,remaining:Math.max(0,total-recorded),fraction:total>0?Math.max(0,1-recorded/total):0};
      cache.set(key,result);return result;
    }
    const availability=(c,groups)=>calculate(c,groups,compositionKey(c,groups));
    // Most compositions have no recorded sequences: no denominator is needed for them.
    availability.fraction=(c,groups,probability=1)=>{
      const key=compositionKey(c,groups);
      const recorded=known.get(key);if(!recorded)return 1;
      const minimum=minimumTotals.get(key);
      // Short-circuit before counting permutations only when even the upper error bound
      // is strictly below tolerance, and the composition cannot be exhausted.
      if(minimum>recorded&&probability*recorded/minimum<tolerance)return 1;
      const result=calculate(c,groups,key);
      if(!result.remaining)return 0;
      return probability*recorded/result.total<tolerance?1:result.fraction;
    };
    availability.exhausted=(c,groups)=>{
      const key=compositionKey(c,groups);
      const recorded=known.get(key);
      if(!recorded||minimumTotals.get(key)>recorded)return false;
      return calculate(c,groups,key).remaining===0;
    };
    return availability;
  }
  function enumerationOptions(exhausted=new Set(),availability){
    return {moon:'all',availability,exclude:(c,groups)=>availability?(availability.exhausted?.(c,groups)??(availability(c,groups).remaining===0)):!c.moon&&c.count===1&&groups.some((g,i)=>c.counts[i]&&exhausted.has(g.key))};
  }
  function compositions(planner,ingredients,mechanics,potions,query,order='rare',rarity='all',limit=60,options={}){
    const scenes=scenarios(mechanics,potions,query),best=[];
    const selected=ingredients.filter(i=>rarity==='common'?i.rarity==='common':rarity==='seasonal'?i.rarity!=='very_rare':true);
    const compare=(a,b)=>order==='coverage'?b.probability-a.probability||b.unknown-a.unknown||a.rareN-b.rareN||a.seasonalN-b.seasonalN:a.rareN-b.rareN||a.seasonalN-b.seasonalN||b.probability-a.probability||b.unknown-a.unknown;
    const gs=planner.groups(selected,query.level);
    const groups=planner.eachComposition(query.level,selected,mechanics,c=>{
      const score=coverage(c,scenes);if(!score.unknown||score.probability<=0)return;
      if(options.availability){
        const fraction=options.availability.fraction?.(c,gs,score.probability)??options.availability(c,gs).fraction;
        score.probability*=fraction;if(score.probability<=0)return;
      }
      const candidate={...c,unknown:score.unknown,total:score.total,probability:score.probability};
      if(best.length===limit&&compare(candidate,best.at(-1))>=0)return;
      candidate.counts=c.counts.slice();
      let at=0;while(at<best.length&&compare(best[at],candidate)<=0)at++;
      best.splice(at,0,candidate);if(best.length>limit)best.pop();
    },options);
    for(const c of best)c.outcomes=coverage(c,scenes,true).outcomes;
    return {groups,candidates:best};
  }
  const api={ordinaryOutcome,sequenceAvailability,missing,key,catalog,singleKnownEffect,exhaustedSingles,enumerationOptions,annotate,scenarios,coverage,compositions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HpwfWantedPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this);
