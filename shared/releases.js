import * as contentV1 from './releases/v1/content.js';
import * as rulesV1 from './releases/v1/simulation.js';
import * as contentV2 from './releases/v2/content.js';
import * as rulesV2 from './releases/v2/simulation.js';

const releases = new Map([
  [1, { version: 1, content: contentV1, rules: rulesV1 }],
  [2, { version: 2, content: contentV2, rules: rulesV2 }],
]);
export const currentRelease = releases.get(2);

export function releaseFor(version) {
  const release = releases.get(version);
  if (!release) throw new Error(`Unsupported content release ${version}`);
  return release;
}

export function valueForSpecimen(specimen) {
  return releaseFor(specimen.contentVersion ?? 1).rules.salePrice(specimen);
}
