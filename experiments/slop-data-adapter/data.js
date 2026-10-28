const query=new URLSearchParams(location.search);
export const mode=query.get('data')==='nyc'?'nyc':'generated';
const response=await fetch(new URL('./data/'+mode+'.json',import.meta.url));
if(!response.ok)throw Error(mode==='nyc'?'Run fetch-nyc-sample.mjs first to obtain the attributed comparison data.':'Generated data is missing. Run generate.cjs.');
export const dataset=await response.json();
export const REAL_BUILDINGS=dataset.records;
export const GEO=dataset.GEO;
