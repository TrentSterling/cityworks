/* Original Cityworks three-island planning model. Clipper remains separately licensed. */
(function (root) {
  'use strict';
  const G = typeof module !== 'undefined' ? require('./city.js') : root.CityModel;
  const defaults = Object.freeze({ schemaVersion: 3, seed: 'CITYWORKS-03', coastVariation: .5, streetSpacing: 108, bridgeWidth: 22, density: .6, skylineHeight: 80 });
  const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mix = (a, b, t) => a.map((v, i) => G.snap(v + (b[i] - v) * t));
  const widths = { arterial: 22, collector: 13, local: 7 };
  const sidewalkWidths = { arterial: 3.5, collector: 3, local: 2.4 };
  const smoothstep = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

  function checkedInput(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('City input must be an object');
    const p = { ...defaults, ...raw };
    if (p.schemaVersion !== 3) throw Error('Expected Cityworks input schema 3');
    if (typeof p.seed !== 'string' || p.seed.length < 1 || p.seed.length > 80) throw Error('Seed must contain 1 to 80 characters');
    for (const [key, min, max] of [['coastVariation', 0, 1], ['streetSpacing', 90, 130], ['bridgeWidth', 18, 28], ['density', .1, 1], ['skylineHeight', 24, 180]]) {
      if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max) throw Error(key + ' must be between ' + min + ' and ' + max);
    }
    for (const key of Object.keys(raw)) if (!(key in defaults)) throw Error('Unknown version 3 input: ' + key);
    return p;
  }

  function roundedOutline(points, iterations = 2) {
    let ring = points;
    for (let n = 0; n < iterations; n++) ring = ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return [mix(a, b, .2), mix(a, b, .8)];
    });
    return G.canonical(ring);
  }

  function coast(points, p, id, rounded = true) {
    // A low-frequency displacement of authored landform controls preserves each
    // island's intent. It does not add per-vertex white noise to the coast.
    const phase = G.rand(p.seed, id, 'coast-phase') * Math.PI * 2;
    const ring = points.map((v, i) => {
      const a = i / points.length * Math.PI * 2;
      const d = p.coastVariation * (Math.sin(a * 2 + phase) * 13 + Math.cos(a + phase) * 6);
      return [G.snap(v[0] + Math.cos(a) * d), G.snap(v[1] + Math.sin(a) * d)];
    });
    return rounded ? roundedOutline(ring) : G.canonical(ring);
  }

  function makeIslands(input) {
    const definitions = [
      { id: 'island:civic', name: 'Civic Island', character: 'long urban spine', rounded: true,
        outline: [[-390,-500],[-260,-650],[-120,-690],[35,-640],[130,-520],[165,-330],[190,-160],[175,30],[160,210],[90,350],[-30,490],[-180,550],[-310,480],[-395,330],[-440,130],[-425,-75],[-465,-250]],
        core: [[-320,-470],[-230,-550],[-100,-590],[50,-500],[100,-300],[80,-130],[95,40],[70,230],[-30,400],[-110,450],[-250,380],[-350,190],[-350,-240]],
        terrain: { coastalRise: 8, coastalRun: 38, hills: [] } },
      { id: 'island:harbour', name: 'West Harbour', character: 'reclaimed quays and working waterfront', rounded: false,
        outline: [[-1040,30],[-1000,-40],[-900,-85],[-770,-70],[-640,-20],[-570,65],[-525,150],[-525,260],[-565,260],[-565,345],[-520,345],[-520,525],[-680,580],[-880,585],[-1035,500],[-1070,275]],
        core: [[-960,90],[-650,90],[-610,190],[-620,430],[-970,430]],
        terrain: { coastalRise: 8, coastalRun: 18, hills: [] } },
      { id: 'island:headland', name: 'Garden Headland', character: 'sheltered bay and wooded ridge', rounded: true,
        outline: [[350,-190],[380,-370],[500,-500],[660,-575],[810,-535],[960,-420],[1040,-250],[1015,-85],[925,25],[935,190],[820,320],[660,390],[500,365],[375,285],[345,130],[385,20]],
        core: [[440,-130],[490,-330],[650,-400],[800,-310],[840,-70],[760,140],[600,230],[480,230]],
        terrain: { coastalRise: 8, coastalRun: 50, hills: [{ center: [925,-275], radius: 155, height: 31 }, { center: [800,290], radius: 100, height: 17 }] } }
    ];
    return definitions.map(d => {
      const boundary = coast(d.outline, input, d.id, d.rounded);
      // The inherited validator's coordinate bound is for the smaller v0.2 map.
      // A scale-only validation preserves all segment and intersection relations.
      G.validateRing(boundary.map(p => p.map(v => v / 2)), d.name);
      const region = G.shape(boundary), urbanCore = G.shape(G.canonical(d.core));
      if (!G.containsRegion(region, urbanCore, .01)) throw Error(d.name + ': planning core falls outside its coast');
      return { id: d.id, name: d.name, character: d.character, boundary, holes: [], regions: [region], buildableRegions: G.offset([region], -16), urbanCore: [urbanCore], elevation: 8, terrain: d.terrain };
    });
  }

  function route(id, islandId, points, klass, extra = {}) {
    return { id, islandId, points: points.map(p => p.map(G.snap)), class: klass, width: widths[klass], sidewalkWidth: sidewalkWidths[klass], bridge: false, ...extra };
  }

  function routeSegments(routes) {
    return routes.flatMap(r => r.points.slice(1).map((b, i) => ({ ...r, a: r.points[i], b, sourceId: r.id, segmentIndex: i })));
  }

  function coreNetwork(islands, input) {
    const routes = [];
    const harbourWest = G.clipSegment([-1100,190],[-580,190],islands[1].urbanCore)[0][0];
    for (const island of islands) routes.push(route(island.id + ':coastal-collector', island.id, [...island.urbanCore[0].outer, island.urbanCore[0].outer[0]], 'collector'));
    routes.push(
      route('civic:spine', 'island:civic', [[-100,-590],[-120,-380],[-80,-180],[-70,20],[-110,190],[-130,360],[-110,450]], 'arterial'),
      route('civic:harbour-approach', 'island:civic', [[-350,190],[-110,190]], 'arterial'),
      route('civic:north-approach', 'island:civic', [[-80,-180],[80,-130]], 'arterial'),
      route('civic:south-approach', 'island:civic', [[-110,190],[-20,210],[70,230]], 'arterial'),
      route('harbour:main', 'island:harbour', [harbourWest,[-780,190],[-610,190],[-580,190]], 'arterial'),
      route('headland:parkway', 'island:headland', [[440,-130],[520,-80],[560,30],[540,150],[480,230]], 'arterial'),
      route('headland:ridge-collector', 'island:headland', [[650,-400],[660,-250],[680,-90],[690,70],[600,230]], 'collector')
    );
    const bridges = [
      { id: 'bridge:harbour', name: 'Harbour Bridge', a: [-580,190], b: [-350,190], fromIsland: 'island:harbour', toIsland: 'island:civic' },
      { id: 'bridge:north-channel', name: 'North Channel Bridge', a: [80,-130], b: [440,-130], fromIsland: 'island:civic', toIsland: 'island:headland' },
      { id: 'bridge:garden', name: 'Garden Bridge', a: [70,230], b: [480,230], fromIsland: 'island:civic', toIsland: 'island:headland' }
    ].map(b => ({ ...b, width: input.bridgeWidth, sidewalkWidth: 3.5, deckElevation: 8, deckThickness: .9, clearance: 7.1, length: length(b.a, b.b) }));
    for (const b of bridges) routes.push(route(b.id, null, [b.a, b.b], 'arterial', { bridge: true, bridgeId: b.id, width: b.width, sidewalkWidth: b.sidewalkWidth }));
    return { routes, bridges };
  }

  function localNetwork(islands, input) {
    const routes = [];
    function crossStreet(island, id, a, b, klass = 'local') {
      // The perimeter collector is the clipping boundary. Every accepted local
      // endpoint consequently terminates at that street, not at an arbitrary coast.
      for (const [index, pair] of G.clipSegment(a, b, island.urbanCore).entries()) {
        if (length(...pair) >= 35) routes.push(route(id + ':' + index, island.id, pair, klass));
      }
    }
    const civic = islands[0], harbour = islands[1], headland = islands[2];
    const phase = (G.rand(input.seed, 'streets', 'phase') - .5) * 12;
    const spacing = input.streetSpacing;
    for (let i = -4; i <= 3; i++) {
      const z = i * spacing + phase + 26;
      // Existing arterial cross-streets reserve enough space for useful blocks.
      if (Math.abs(z - 190) < 42 || Math.abs(z + 150) < 40) continue;
      crossStreet(civic, 'civic:cross:' + i, [-600,z], [280,z + 13], i === 0 ? 'collector' : 'local');
    }
    for (const [i, x] of [-270,-190,10].entries()) crossStreet(civic, 'civic:long:' + i, [x,-650], [x + 24,500]);
    for (const [i, z] of [295,390].entries()) crossStreet(harbour, 'harbour:quay-cross:' + i, [-1100,z], [-450,z]);
    for (const [i, x] of [-855,-745].entries()) crossStreet(harbour, 'harbour:quay-long:' + i, [x,-50], [x,560]);
    for (let i = 0; i < 4; i++) {
      const z = -285 + i * spacing * 1.28 + phase;
      crossStreet(headland, 'headland:contour:' + i, [320,z], [980,z + 32]);
    }
    return routes;
  }

  function graph(routes) {
    const segments = routeSegments(routes).map(s => ({ ...s, cuts: [{ t: 0, p: s.a }, { t: 1, p: s.b }] }));
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i], b = segments[j], hit = G.intersection(a.a, a.b, b.a, b.b);
      if (hit) {
        const p = hit.point.map(G.snap);
        a.cuts.push({ t: Math.max(0, Math.min(1, hit.t)), p });
        b.cuts.push({ t: Math.max(0, Math.min(1, hit.q)), p });
      } else {
        // Collinear endpoint incidence is still a junction. There are no
        // overlapping route sections in the authored network.
        for (const p of [a.a, a.b]) {
          const q = G.projection(p, b.a, b.b);
          if (q.distance < .002) b.cuts.push({ t: q.t, p });
        }
        for (const p of [b.a, b.b]) {
          const q = G.projection(p, a.a, a.b);
          if (q.distance < .002) a.cuts.push({ t: q.t, p });
        }
      }
    }
    const nodes = new Map(), edgeMap = new Map();
    const node = p => {
      const point = p.map(G.snap), id = 'node:' + point.join(',');
      if (!nodes.has(id)) nodes.set(id, { id, position: point, elevation: 8 });
      return id;
    };
    for (const s of segments) {
      s.cuts.sort((a,b) => a.t - b.t);
      const cuts = s.cuts.filter((v,i) => !i || Math.abs(v.t - s.cuts[i-1].t) > .0000001);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i].p, b = cuts[i+1].p;
        if (length(a,b) < .005) continue;
        const ends = [a.join(','),b.join(',')].sort(), key = ends.join('|');
        const edge = { id: 'street:' + G.hash(s.sourceId + '|' + key), sourceId: s.sourceId, from: node(a), to: node(b), a, b, width: s.width, sidewalkWidth: s.sidewalkWidth, class: s.class, bridge: s.bridge, islandId: s.islandId, elevation: 8 };
        if (s.bridgeId) edge.bridgeId = s.bridgeId;
        if (!edgeMap.has(key) || edgeMap.get(key).width < edge.width) edgeMap.set(key, edge);
      }
    }
    // A crossing immediately beside a polyline bend is one physical junction.
    // Consolidate adjacent nodes inside an 8 m junction envelope so the graph
    // does not contain centimetre-long road edges between overlapping corners.
    const rawEdges = [...edgeMap.values()], parent = new Map([...nodes.keys()].map(id=>[id,id]));
    const find = id => { while(parent.get(id)!==id)id=parent.get(id);return id; };
    for(const edge of rawEdges)if(length(edge.a,edge.b)<8){const a=find(edge.from),b=find(edge.to);if(a!==b)parent.set(b,a);}
    const degree = new Map([...nodes.keys()].map(id=>[id,0])), bridgeEnds = new Set();
    for(const e of rawEdges){degree.set(e.from,degree.get(e.from)+1);degree.set(e.to,degree.get(e.to)+1);if(e.bridge){bridgeEnds.add(e.from);bridgeEnds.add(e.to);}}
    const clusters = new Map();
    for(const n of nodes.values()){const key=find(n.id);if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(n);}
    const representative = new Map();
    for(const group of clusters.values()){
      group.sort((a,b)=>Number(bridgeEnds.has(b.id))-Number(bridgeEnds.has(a.id))||degree.get(b.id)-degree.get(a.id)||a.id.localeCompare(b.id));
      for(const n of group)representative.set(n.id,group[0]);
    }
    const consolidated = new Map();
    for(const edge of rawEdges){
      const a=representative.get(edge.from),b=representative.get(edge.to);if(a.id===b.id)continue;
      const key=[a.id,b.id].sort().join('|'),e={...edge,a:a.position,b:b.position,from:a.id,to:b.id,id:'street:'+G.hash(edge.sourceId+'|'+key)};
      if(!consolidated.has(key)||consolidated.get(key).width<e.width)consolidated.set(key,e);
    }
    const streets = [...consolidated.values()].sort((a,b) => a.id.localeCompare(b.id));
    const activeIds = new Set(streets.flatMap(e => [e.from,e.to]));
    const activeNodes = [...nodes.values()].filter(n => activeIds.has(n.id)).sort((a,b) => a.id.localeCompare(b.id));
    const incidence = new Map(activeNodes.map(n => [n.id, []]));
    for (const e of streets) { incidence.get(e.from).push(e); incidence.get(e.to).push(e); }
    const junctions = activeNodes.map(n => {
      const edges = incidence.get(n.id);
      return { id: 'junction:' + G.hash(n.id), nodeId: n.id, position: n.position, degree: edges.length, streetIds: edges.map(e=>e.id), radius: Math.max(...edges.map(e=>e.width))/2 + 2, asphaltRadius: Math.max(...edges.map(e=>e.width))/2, sidewalkRadius: Math.max(...edges.map(e=>e.width/2+e.sidewalkWidth)) };
    });
    return { nodes: activeNodes, streets, junctions };
  }

  function disc(point, radius, count = 16) {
    return G.shape(G.canonical(Array.from({ length: count }, (_, i) => [point[0] + Math.cos(i/count*Math.PI*2)*radius, point[1] + Math.sin(i/count*Math.PI*2)*radius])));
  }

  function coverage(network, landRegions) {
    const { streets, junctions } = network;
    const ordinary = streets.filter(s => !s.bridge), bridges = streets.filter(s => s.bridge);
    const landParts = ordinary.map(s => G.corridor(s.a,s.b,s.width));
    const rowParts = streets.map(s => G.corridor(s.a,s.b,s.width + s.sidewalkWidth*2));
    for (const j of junctions) {
      if (ordinary.some(s=>s.from===j.nodeId || s.to===j.nodeId)) landParts.push(disc(j.position,j.asphaltRadius));
      rowParts.push(disc(j.position,j.sidewalkRadius));
    }
    const landRoadCoverage = G.boolean(landParts);
    const bridgeCoverage = G.boolean(bridges.map(s => G.corridor(s.a,s.b,s.width)));
    const roadCoverage = G.boolean([...landRoadCoverage,...bridgeCoverage]);
    const rightOfWay = G.boolean(rowParts);
    const sidewalkCoverage = G.boolean(rightOfWay,roadCoverage,'difference');
    return { landRoadCoverage, bridgeCoverage, roadCoverage, rightOfWay, sidewalkCoverage };
  }

  function makeBlocks(islands, rightOfWay, seed) {
    const blocks = [];
    for (const island of islands) {
      const regions = G.boolean(island.buildableRegions,rightOfWay,'difference');
      for (const region of regions) {
        const area = G.totalArea([region]);
        if (area < 45) continue;
        const coreArea = G.totalArea(G.boolean([region],island.urbanCore,'intersection'));
        const id = 'block:' + G.hash(island.id + '|' + JSON.stringify(region));
        const largeGarden = island.id === 'island:headland' && area > 17000;
        const use = coreArea/area < .65 || largeGarden || G.rand(seed,id,'park') < .09 ? 'park' : 'mixed';
        blocks.push({ id, islandId: island.id, polygon: region.outer, holes: region.holes, area: G.snap(area), use, elevation: 8 });
      }
    }
    return blocks.sort((a,b)=>a.id.localeCompare(b.id));
  }

  function generate(raw = {}) {
    const input = checkedInput(raw), islands = makeIslands(input), landRegions = islands.flatMap(i=>i.regions);
    const { routes: primary, bridges } = coreNetwork(islands,input);
    const routes = [...primary,...localNetwork(islands,input)], network = graph(routes), surfaces = coverage(network,landRegions);
    const blocks = makeBlocks(islands,surfaces.rightOfWay,input.seed);
    const city = { schemaVersion: 3, generatorVersion: '0.3.0', units: 'metres', axis: 'x-z plan, y-up', precision: .001, input, islands, landRegions, routes, bridges, ...network, ...surfaces, blocks, parcels: [], buildings: [], diagnostics: [] };
    city.dependencies = { land: G.hash(JSON.stringify(islands.map(i=>i.regions))), streets: G.hash(JSON.stringify([routes,input.bridgeWidth])), intent: G.hash(JSON.stringify([input.density,input.skylineHeight])) };
    city.dependencies.blocks = G.hash(city.dependencies.land + city.dependencies.streets);
    city.stats = { islands: islands.length, bridges: bridges.length, landArea: G.snap(G.totalArea(landRegions)), streetLength: G.snap(city.streets.reduce((sum,s)=>sum+length(s.a,s.b),0)), roadArea: G.snap(G.totalArea(city.roadCoverage)), blocks: blocks.length, parcels: 0, buildings: 0, parks: blocks.filter(b=>b.use==='park').length, junctions: city.junctions.filter(j=>j.degree>=3).length, deadEnds: city.junctions.filter(j=>j.degree===1).length, maxHeight: 0, classLengths: Object.fromEntries(['arterial','collector','local'].map(c=>[c,G.snap(city.streets.filter(s=>s.class===c).reduce((sum,s)=>sum+length(s.a,s.b),0))])) };
    const errors = validate(city);
    if (errors.length) throw Error(errors.slice(0,6).join('; '));
    return city;
  }

  function validate(city) {
    const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
    check(city.islands.length===3,'Expected exactly three islands');
    for (let i=0;i<city.islands.length;i++) for(let j=i+1;j<city.islands.length;j++) check(G.totalArea(G.boolean(city.islands[i].regions,city.islands[j].regions,'intersection'))<.01,'Island regions overlap');
    check(G.totalArea(G.boolean(city.landRoadCoverage,city.landRegions,'difference'))<.04,'Ordinary road coverage crosses water');
    const waterRoad = G.boolean(city.roadCoverage,city.landRegions,'difference');
    check(G.totalArea(G.boolean(waterRoad,city.bridgeCoverage,'difference'))<.04,'Water crossing has no declared bridge');
    const ids=[...city.islands,...city.bridges,...city.nodes,...city.streets,...city.blocks].map(e=>e.id);
    check(ids.length===new Set(ids).size,'Duplicate entity IDs');
    const adjacent=new Map(city.nodes.map(n=>[n.id,[]]));
    for(const s of city.streets){check(adjacent.has(s.from)&&adjacent.has(s.to),'Missing road endpoint');adjacent.get(s.from)?.push(s.to);adjacent.get(s.to)?.push(s.from);check(Number.isFinite(s.width)&&s.width>=7,'Invalid street width');}
    const seen=new Set(),stack=city.nodes.length?[city.nodes[0].id]:[];
    while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);stack.push(...adjacent.get(n));}
    check(seen.size===city.nodes.length&&seen.size>0,'Disconnected street graph');
    for(const bridge of city.bridges){
      const from=city.islands.find(i=>i.id===bridge.fromIsland),to=city.islands.find(i=>i.id===bridge.toIsland);
      check(G.inRegions(from.regions,bridge.a)&&G.inRegions(to.regions,bridge.b),'Bridge landing outside its island '+bridge.id);
      for(const endpoint of [bridge.a,bridge.b]){
        const node=city.nodes.find(n=>length(n.position,endpoint)<.002);
        check(!!node,'Missing bridge landing node '+bridge.id);
        if(node)check(city.streets.some(s=>!s.bridge&&(s.from===node.id||s.to===node.id)),'Bridge landing not joined to surface street '+bridge.id);
      }
    }
    for(const b of city.blocks){const region=G.shape(b.polygon,b.holes);check(G.totalArea(G.boolean([region],city.landRegions,'difference'))<.03,'Block crosses water');check(G.totalArea(G.boolean([region],city.rightOfWay,'intersection'))<.03,'Block overlaps right of way');}
    return errors;
  }

  function distanceToBoundary(regions,p) {
    let distance=Infinity;
    for(const region of regions)for(const ring of [region.outer,...region.holes])for(let i=0;i<ring.length;i++) distance=Math.min(distance,G.projection(p,ring[i],ring[(i+1)%ring.length]).distance);
    return distance;
  }

  function heightAt(city,x,z) {
    const p=[x,z], island=city.islands.find(i=>G.inRegions(i.regions,p));
    if(!island)return 0;
    if(G.inRegions(island.urbanCore,p))return 8;
    const coastDistance=distanceToBoundary(island.regions,p), coreDistance=distanceToBoundary(island.urbanCore,p);
    let height=8*smoothstep(coastDistance/island.terrain.coastalRun);
    for(const hill of island.terrain.hills)height+=hill.height*Math.exp(-((x-hill.center[0])**2+(z-hill.center[1])**2)/(hill.radius**2))*smoothstep(coreDistance/65)*smoothstep(coastDistance/35);
    let roadDistance=Infinity;
    for(const street of city.streets) if(street.islandId===island.id||street.bridge)roadDistance=Math.min(roadDistance,G.projection(p,street.a,street.b).distance-street.width/2-street.sidewalkWidth-1);
    return G.snap(8+(height-8)*smoothstep(roadDistance/25));
  }

  const api={...G,defaults,generate,validate,heightAt,distanceToBoundary};
  if(typeof module!=='undefined')module.exports=api;
  root.ArchipelagoModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
