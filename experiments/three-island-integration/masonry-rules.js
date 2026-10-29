// Original preview-only dimensions and detail policy. All dimensions are metres.
// Modules include mortar; these are authored visual styles, not construction specifications.
export const MASONRY = Object.freeze({
  brick: Object.freeze({ length: .225, height: .075, joint: .010, relief: .0015 }),
  stone: Object.freeze({ length: .56, height: .24, joint: .008, relief: .003 })
});
export const AC_UNIT = Object.freeze({ width: .68, height: .44 });

function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// One selected window in each apartment-width group shares a short vertical
// service stack. Programme, building and wall orientation determine the policy;
// individual windows are not independent random unit placements.
export function acPlan(record, domain, fit, kind) {
  const none = { period: 1, phase: 0, first: 1, last: 0, program: 'none' };
  if (record.facadeIndex > 1 || !record.streetLevel || !fit.windowEligible ||
      fit.storeys < 2 || kind === 3) return none;
  const industrial = record.district === 'working-harbour';
  const residential = record.profile === 'garden-row' || record.district === 'garden-neighbourhood';
  const key = record.buildingId || record.id;
  const building = hash(key + ':window-cooling');
  // Industrial units are limited to occasional upper front-office windows.
  // Some residential and mixed buildings use a central system instead.
  if (building % 100 >= (industrial ? 28 : residential ? 82 : 56) ||
      (industrial && kind !== 0)) return none;
  const wall = hash(key + ':' + domain.normal.x.toFixed(3) + ':' + domain.normal.z.toFixed(3));
  const period = (residential ? 5 : 6) + building % 3;
  const phase = wall % period;
  const first = 1 + (!industrial && fit.storeys > 4 ? (wall >>> 8) % 2 : 0);
  const count = industrial ? 1 : (residential ? 2 : 1) + (building >>> 8) % 2;
  return { period, phase, first, last: Math.min(fit.storeys - 1, first + count - 1),
    program: industrial ? 'front-office' : residential ? 'residential' : 'mixed' };
}

export function acBays(plan, fit) {
  const units = [];
  for (let bay = 0; bay < fit.bays; bay++) {
    if (bay % plan.period !== plan.phase) continue;
    for (let floor = plan.first; floor <= plan.last; floor++) units.push({ bay, floor });
  }
  return units;
}
