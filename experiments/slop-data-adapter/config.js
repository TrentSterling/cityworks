import {dataset} from './data.js';
const ring=dataset.city.island.boundary;
export const ISLAND_BOUNDS={minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1])),sidewalkHeight:.22,waterLevel:-2.2};
export const CENTRAL_PARK_BOUNDS={minX:1e8,maxX:1e8+1,minZ:1e8,maxZ:1e8+1};
export const ALL_AVENUES=[],LANDMARK_SITES={},NJ_SHORELINE_POLYGON=[],LONG_ISLAND_POLYGONS=[];
export const streetZ=()=>1e8,avenueX=()=>1e8;
export const getIslandBoundsAtZ=()=>({westX:ISLAND_BOUNDS.minX,eastX:ISLAND_BOUNDS.maxX});
export const districtAt=(x,z)=>x<-170?'shophouses':x>150?'housing':'generic';
