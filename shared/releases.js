import * as content from './releases/v1/content.js';
import * as rules from './releases/v1/simulation.js';

const releases = new Map([[1, { version: 1, content, rules }]]);
export const currentRelease = releases.get(1);

export function releaseFor(version) {
  const release = releases.get(version);
  if (!release) throw new Error(`Unsupported content release ${version}`);
  return release;
}

export function valueForSpecimen(specimen) {
  return releaseFor(specimen.contentVersion ?? 1).rules.salePrice(specimen);
}
