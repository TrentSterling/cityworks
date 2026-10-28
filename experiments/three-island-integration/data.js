import {recordsFromCity} from './adapter.js';
const q=new URLSearchParams(location.search),input={};
for(const key of ['seed','coastVariation','streetSpacing','bridgeWidth','density','skylineHeight'])if(q.has(key))input[key]=key==='seed'?q.get(key):Number(q.get(key));
const edits=q.has('edits')?JSON.parse(q.get('edits')):{};
export const city=CityFabric.generate(input,edits);
export const REAL_BUILDINGS=recordsFromCity(city);
export const GEO={blocks:[],parks:[],roadGraph:{nodes:[],links:[],names:[],classes:[]}};
