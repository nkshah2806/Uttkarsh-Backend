"use strict";
function buildSelectionMap(savedSelections) {
  const map = new Map();
  for (const s of savedSelections) { map.set(`${s.parameter_id}_${s.node_id}`, s.is_selected); }
  return map;
}
function isNodeSelected(map, pId, nId, def=true) {
  const k=`${pId}_${nId}`; return map.has(k) ? map.get(k) : def;
}
function buildBulkWriteFilters(selections) {
  return selections.map(s=>({ filter:{visit_id:s.visit_id,parameter_id:s.parameter_id,node_id:s.node_id}, update:{is_selected:s.is_selected} }));
}
const getItemKey=(pId,bId)=>`${pId}_${bId}`;
let ok=0,fail=0;
function assert(cond,label){ if(cond){console.log(" PASS "+label);ok++;}else{console.error(" FAIL "+label);fail++;} }

const saved=[{visit_id:"v1",parameter_id:"pA",node_id:"n1_1",is_selected:true},{visit_id:"v1",parameter_id:"pB",node_id:"n1_1",is_selected:false}];
const m=buildSelectionMap(saved);
assert(isNodeSelected(m,"pA","n1_1")===true,"T1a pA selected");
assert(isNodeSelected(m,"pB","n1_1")===false,"T1b pB not selected");
assert(m.size===2,"T1c map size 2 (no overwrite)");

const filters=buildBulkWriteFilters([{visit_id:"v1",parameter_id:"pA",node_id:"n1_1",is_selected:false}]);
assert(filters[0].filter.parameter_id==="pA","T2a filter includes parameter_id");
assert(saved.find(s=>s.parameter_id==="pB"&&s.node_id==="n1_1").is_selected===false,"T2b pB untouched");

assert(getItemKey("pA","n1_1")!==getItemKey("pB","n1_1"),"T4 keys distinct per param");

const sel={[getItemKey("pA","n1_1")]:true,[getItemKey("pB","n1_1")]:false,[getItemKey("pA","n1_2")]:true,[getItemKey("pB","n1_2")]:true};
const newSel={...sel,[getItemKey("pA","n1_1")]:false};
assert(newSel[getItemKey("pA","n1_1")]===false,"T5a pA n1_1 deselected");
assert(newSel[getItemKey("pB","n1_1")]===false,"T5b pB n1_1 unchanged");
assert(newSel[getItemKey("pA","n1_2")]===true,"T5c pA n1_2 unchanged");

const items=[{parameter:{id:"pA"},sections:[{id:"s1",items:[{id:"n1_1"},{id:"n1_2"}]}]},{parameter:{id:"pB"},sections:[{id:"s1",items:[{id:"n1_1"},{id:"n1_2"}]}]}];
const pm={[getItemKey("pA","n1_1")]:true,[getItemKey("pA","n1_2")]:false,[getItemKey("pB","n1_1")]:false,[getItemKey("pB","n1_2")]:true};
const preview=items.map(item=>{const pId=item.parameter.id;const secs=item.sections.map(sec=>({...sec,items:sec.items.filter(it=>pm[getItemKey(pId,it.id)]===true)})).filter(s=>s.items.length>0);return{...item,sections:secs};}).filter(it=>it.sections.length>0);
const pA=preview.find(it=>it.parameter.id==="pA"); const pB=preview.find(it=>it.parameter.id==="pB");
assert(pA?.sections[0]?.items[0]?.id==="n1_1","T6a pA preview shows n1_1 only");
assert(pB?.sections[0]?.items[0]?.id==="n1_2","T6b pB preview shows n1_2 only");

console.log(`\nResults: ${ok} passed, ${fail} failed`);
process.exit(fail>0?1:0);
