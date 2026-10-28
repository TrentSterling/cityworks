import {recordsFromCity} from './adapter.js';
const q=new URLSearchParams(location.search),input={};
for(const key of ['seed','coastVariation','streetSpacing','bridgeWidth','density','skylineHeight','mapAreaKm2'])if(q.has(key))input[key]=key==='seed'?q.get(key):Number(q.get(key));
const edits=q.has('edits')?JSON.parse(q.get('edits')):{};
const projectKey=q.get('project');
if(projectKey&&!projectKey.startsWith('cityworks:editor-preview:'))throw Error('Invalid project preview key');
export const city=projectKey?CityProject.compile(JSON.parse(sessionStorage.getItem(projectKey))):CityFabric.generate(input,edits);
export const REAL_BUILDINGS=recordsFromCity(city);
export const GEO={blocks:[],parks:[],roadGraph:{nodes:[],links:[],names:[],classes:[]}};
