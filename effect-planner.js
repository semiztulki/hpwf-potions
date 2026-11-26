(function(root){
  "use strict";
  function target(query,mechanics){
    const {level,duration,type,value}=query;
    const divisor=mechanics.value?.effectDivisors?.[level]?.[duration]?.[type];
    if(![1,2,3].includes(level)||!["concentration","efficiency","resistance"].includes(type)||!Number.isSafeInteger(value)||value<1||!Number.isFinite(divisor)||divisor<=0)throw new Error("Выбери уровень, длительность, вид эффекта и положительное целое значение.");
    return {low:(value-1)*divisor,high:value*divisor,divisor};
  }
  function groups(ingredients,level){
    const map=new Map();
    for(const ingredient of ingredients){
      if(ingredient.level>level||!["common","seasonal","very_rare"].includes(ingredient.rarity))continue;
      const key=ingredient.level+"-"+ingredient.rarity;
      if(!map.has(key))map.set(key,{key,level:ingredient.level,rarity:ingredient.rarity,power:Number(ingredient.basePower),ingredients:[]});
      map.get(key).ingredients.push(ingredient);
    }
    return [...map.values()].filter(g=>Number.isFinite(g.power)&&g.power>0).sort((a,b)=>a.level-b.level||["common","seasonal","very_rare"].indexOf(a.rarity)-["common","seasonal","very_rare"].indexOf(b.rarity));
  }
  function eachComposition(levelWanted,ingredients,mechanics,accept,options={}){
    const gs=groups(ingredients,levelWanted),counts=gs.map(()=>0);
    const modifiers=mechanics.value?.modifierModel;
    const spreads={common:modifiers?.byRarity?.common?.relativeSpread??.15,seasonal:modifiers?.byRarity?.seasonal?.relativeSpread??.05,very_rare:modifiers?.byRarity?.very_rare?.relativeSpread??.01};
    function visit(index,left,base,radius,level,commonN,seasonalN,rareN){
      if(index===gs.length){
        const count=11-left;if(!count||level!==levelWanted)return;
        let width=radius;
        const empirical=modifiers?.mixedRareEmpirical?.relativeSpread;
        if(commonN===0&&seasonalN>0&&rareN>0&&Number.isFinite(empirical))width=base*empirical;
        const minimum=base-width,maximum=base+width;
        for(const moon of options.moon==='all'?[false,true]:[options.moon===true]){
          const candidate={counts,count,commonN,seasonalN,rareN,base:base+(moon?225:0),minimum,maximum:maximum+(moon?450:0),moon};
          if(!options.exclude?.(candidate,gs))accept(candidate);
        }
        return;
      }
      const g=gs[index];
      for(let n=0;n<=left;n++){
        counts[index]=n;
        visit(index+1,left-n,base+n*g.power,radius+n*g.power*spreads[g.rarity],n?Math.max(level,g.level):level,commonN+(g.rarity==="common"?n:0),seasonalN+(g.rarity==="seasonal"?n:0),rareN+(g.rarity==="very_rare"?n:0));
      }
      counts[index]=0;
    }
    visit(0,11,0,0,0,0,0,0);
    return gs;
  }
  function solve(query,ingredients,mechanics){
    const range=target(query,mechanics),matches=[];
    const gs=eachComposition(query.level,ingredients,mechanics,c=>{
      if(c.maximum<=range.low||c.minimum>range.high)return;
      matches.push({...c,counts:c.counts.slice(),from:Math.ceil(c.minimum/range.divisor),to:Math.ceil(c.maximum/range.divisor),distance:Math.abs(c.base-(range.low+range.high)/2),nominalHit:Math.ceil(c.base/range.divisor)===query.value});
    },{moon:query.moon??'all'});
    return {...range,groups:gs,candidates:matches};
  }
  function valueRanges(level,ingredients,mechanics,options={}){
    const ranges=[];
    eachComposition(level,ingredients,mechanics,c=>ranges.push([c.minimum,c.maximum]),options);
    ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const merged=[];
    for(const range of ranges){
      const last=merged[merged.length-1];
      if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push(range.slice());
    }
    return merged;
  }
  function rank(candidates,order="rare",allowed={}){
    const rarity=(a,b)=>a.rareN-b.rareN||a.seasonalN-b.seasonalN;
    return candidates.filter(c=>(allowed.seasonal!==false||c.seasonalN===0)&&(allowed.veryRare!==false||c.rareN===0))
      .sort((a,b)=>order==="close"?a.distance-b.distance||rarity(a,b):rarity(a,b)||a.distance-b.distance);
  }
  const api={target,groups,solve,rank,valueRanges,eachComposition};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.HpwfEffectPlanner=api;
})(typeof globalThis!=="undefined"?globalThis:this);
