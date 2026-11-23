const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateShipping } = require('../dist/src/settings/shipping-quote.js');

const pin = { pinCode:'110001',supported:true,enabled:true,reason:null,dispatchMinDays:1,dispatchMaxDays:2,deliveryMinDays:3,deliveryMaxDays:5 };
const base = { id:'store',name:'Standard',enabled:true,pinCode:null,state:null,productId:null,categoryId:null,minWeightGrams:null,maxWeightGrams:null,minLengthMm:null,maxLengthMm:null,minWidthMm:null,maxWidthMm:null,minHeightMm:null,maxHeightMm:null,baseChargePaise:9900,fragileChargePaise:1500,bulkyChargePaise:5000,freeShippingThresholdPaise:200000,shippingIncluded:null,freeShipping:null,dispatchMinDays:null,dispatchMaxDays:null,deliveryMinDays:null,deliveryMaxDays:null };
const line = { productId:'p1',variantId:'v1',name:'Vase',quantity:1,categoryIds:['c1'],weightGrams:1000,lengthMm:300,widthMm:200,heightMm:300,isFragile:true,isBulky:false };
const merchandise = (value, discount=0) => ({originalMerchandisePaise:value,merchandisePaise:value-discount,automaticPaise:discount,couponPaise:0});
const input = (overrides={}) => ({pinCode:'110001',coverage:pin,rules:[base],lines:[line],merchandise:merchandise(199900),policy:{thresholdBasis:'AFTER_DISCOUNTS',waiveHandlingOnFree:false},...overrides});

test('only active blocked PINs win over free delivery',()=>{
  const expensive=input({merchandise:merchandise(300000)});
  assert.equal(evaluateShipping({...expensive,coverage:{...pin,supported:false}}).available,false);
  assert.equal(evaluateShipping({...expensive,coverage:null}).available,true);
  assert.equal(evaluateShipping({...expensive,coverage:{...pin,supported:false,enabled:false}}).available,true);
  assert.equal(evaluateShipping({...expensive,pinCode:'010001'}).available,false);
});
test('threshold boundaries and discount basis use integer paise',()=>{
  assert.equal(evaluateShipping(input()).finalChargePaise,11400);
  assert.equal(evaluateShipping(input({merchandise:merchandise(200000)})).finalChargePaise,1500);
  assert.equal(evaluateShipping(input({merchandise:merchandise(200100)})).finalChargePaise,1500);
  assert.equal(evaluateShipping(input({merchandise:merchandise(200000,100)})).finalChargePaise,11400);
  assert.equal(evaluateShipping(input({merchandise:merchandise(200000,100),policy:{thresholdBasis:'BEFORE_DISCOUNTS',waiveHandlingOnFree:true}})).finalChargePaise,0);
});
test('product override and shipping-included item do not duplicate mixed-cart base charge',()=>{
  const cushion={...line,productId:'p2',variantId:'v2',name:'Cushion',isFragile:false};
  const mirror={...line,productId:'p3',variantId:'v3',name:'Mirror',isFragile:false,isBulky:true};
  const included={...base,id:'included',name:'Included cushion',productId:'p2',baseChargePaise:null,shippingIncluded:true,freeShippingThresholdPaise:null};
  const mirrorRule={...base,id:'mirror',name:'Mirror override',productId:'p3',baseChargePaise:14900,bulkyChargePaise:7000,freeShippingThresholdPaise:null};
  const result=evaluateShipping(input({rules:[base,included,mirrorRule],lines:[cushion,mirror],merchandise:merchandise(100000)}));
  assert.equal(result.baseChargePaise,14900); assert.equal(result.handlingChargePaise,7000); assert.equal(result.finalChargePaise,21900);
});
test('missing measurement cannot silently produce free delivery',()=>{
  const weighted={...base,id:'weighted',minWeightGrams:500,baseChargePaise:20000,freeShippingThresholdPaise:null};
  const result=evaluateShipping(input({rules:[weighted],lines:[{...line,weightGrams:null}]}));
  assert.equal(result.available,true);assert.equal(result.priced,false);assert.match(result.reason,/no base rate/i);
});
test('equal-priority category rules return an explicit conflict',()=>{
  const a={...base,id:'a',categoryId:'c1',freeShippingThresholdPaise:null};
  const b={...base,id:'b',categoryId:'c2',freeShippingThresholdPaise:null};
  const result=evaluateShipping(input({rules:[base,a,b],lines:[{...line,categoryIds:['c1','c2']}]}));
  assert.equal(result.priced,false);assert.match(result.reason,/conflict/i);
});
