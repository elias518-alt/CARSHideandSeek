/* Provider-neutral contracts. Deliberately disabled until a reviewed integration
 * supplies business configuration, consent and verified server-side events. */
(function(root){
 'use strict';
 const capabilities=Object.freeze({purchasesEnabled:false,adsEnabled:false,provider:null});
 function checkout(){const error=new Error('Käufe sind noch nicht verfügbar.');error.code='PURCHASES_DISABLED';throw error;}
 function adOpportunity(context={}){
  // No SDK, network request, tracking or reward is started by this policy.
  const safeSurface=['garage','profile','round-results'].includes(context.surface);
  if(context.activeRound||context.driving||!safeSurface)return Object.freeze({show:false,reason:'UNSAFE_CONTEXT'});
  if(!context.consent)return Object.freeze({show:false,reason:'CONSENT_REQUIRED'});
  return Object.freeze({show:false,reason:'ADS_DISABLED'});
 }
 const api=Object.freeze({capabilities,checkout,adOpportunity});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.monetizationPolicy=api;
})(typeof window==='undefined'?{}:window);
