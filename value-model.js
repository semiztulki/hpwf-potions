(function(root){
  "use strict";
  const version="grouped-rare-20261006";
  function powerOf(ingredient){
    return Number(ingredient.basePower);
  }
  function estimate(items,moon=false,mechanics={}){
    const modifier=mechanics.value?.modifierModel;
    const spread=modifier?.byRarity?.common?.relativeSpread??0.15;
    let base=0,common=0,stable=0,count=0,estimatedPowers=false;
    for(const {ingredient,count:quantity} of items){
      if(!ingredient||!Number.isInteger(quantity)||quantity<0||!Number.isFinite(powerOf(ingredient)))return {partial:true,modelVersion:version};
      if(!quantity)continue;
      const value=powerOf(ingredient)*quantity;
      base+=value;count+=quantity;
      if(ingredient.rarity==="common")common+=value;else stable+=value;
      if(ingredient.basePowerStatus!=="supported_by_observation")estimatedPowers=true;
    }
    return {base,total:base,common,stable,count,moon,nominal:base+(moon?225:0),minimum:stable+common*(1-spread),maximum:stable+common*(1+spread)+(moon?450:0),estimatedPowers,partial:false,modelVersion:version};
  }
  function sequence(sequence,ingredients,mechanics={}){
    const lookup=Object.fromEntries(ingredients.map(i=>[i.id,i]));
    if((sequence||[]).some(item=>!["ingredient","action","moon"].includes(item.type)))return {partial:true,modelVersion:version};
    return estimate((sequence||[]).filter(item=>item.type==="ingredient").map(item=>({ingredient:lookup[item.ref],count:1})),(sequence||[]).some(item=>item.type==="moon"),mechanics);
  }
  const api={version,powerOf,estimate,sequence,effect:(value,divisor)=>Math.ceil(value/divisor)};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.HpwfValueModel=api;
})(typeof globalThis!=="undefined"?globalThis:this);
