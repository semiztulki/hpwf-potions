(function(root){
  'use strict';
  function key(p,type,value){return [Number(p.level),p.duration,type,Number(value)].join('|');}
  function missing(ranges,mechanics,potions,query){
    const {level,duration,type}=query,divisors=mechanics.value?.effectDivisors?.[level]?.[duration];
    if(!divisors)return [];
    const known=new Set();
    for(const p of potions){
      if(p.category!=='standard_new')continue;
      for(const e of p.effects||[])known.add(key(p,e.type,e.value));
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
  const api={missing,key};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HpwfWantedPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this);
