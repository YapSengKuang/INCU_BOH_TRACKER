import directory from '../../Documentation/incu-brands.seed.json'
import starter from '../../Documentation/starter-data.json'
import { groupLabel, locationLabel } from './model'
import type { Location, Snapshot } from './model'

/** Default sample data supplied by the store on 26 October 2026. */
export function createSample(): Snapshot {
  const activeBrands = new Set(starter.groups.map(g => g.brandId))
  const sample: Snapshot = {
    store: { id: 'sample-store', name: 'Incu · Sample store', timezone: 'Australia/Melbourne', revision: 0 },
    brands: directory.brands.map(b => ({
      id: b.slug, name: b.name, aliases: [], active: activeBrands.has(b.slug),
      departments: b.departments, sourcePages: b.source_pages, retrievedOn: directory.retrieved_on,
    })),
    categories: ['Knitwear', 'Denim', 'Footwear', 'T-shirts', 'Outerwear', 'Accessories', 'Dresses', 'Trousers', 'Tops', 'Jackets', 'Hats', 'Bags']
      .map(name => ({ id: name.toLowerCase(), name, active: true })),
    departments: ['Women', 'Men', 'Unisex', 'Unspecified'].map(name => ({ id: name.toLowerCase(), name, active: true })),
    locations: structuredClone(starter.locations) as Location[],
    groups: structuredClone(starter.groups),
    placements: structuredClone(starter.placements),
    movements: [],
  }
  sample.movements = sample.placements.map(({ groupId, locationId }, i) => ({
    id: `starter-placement-${i + 1}`, groupId, kind: 'place',
    groupLabel: groupLabel(sample, sample.groups.find(g => g.id === groupId)!),
    from: null, to: locationId, fromLabel: null, toLabel: locationLabel(sample, locationId),
    reason: 'Starter data from store notes; exact unit and unspecified departments need confirmation.',
    // Import date, not a claim about when the physical stock moved.
    at: '2026-10-26T00:00:00.000Z',
  }))
  return sample
}
