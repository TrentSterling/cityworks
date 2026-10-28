import {city} from './data.js';
const points=city.islands.flatMap(i=>i.boundary);
export const ISLAND_BOUNDS={minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1])),sidewalkHeight:8.16,waterLevel:-.3};
export const CENTRAL_PARK_BOUNDS={minX:1e8,maxX:1e8+1,minZ:1e8,maxZ:1e8+1};
export const ALL_AVENUES=[],LANDMARK_SITES={},NJ_SHORELINE_POLYGON=[],LONG_ISLAND_POLYGONS=[];
export const streetZ=()=>1e8,avenueX=()=>1e8;
export const getIslandBoundsAtZ=()=>({westX:ISLAND_BOUNDS.minX,eastX:ISLAND_BOUNDS.maxX});
