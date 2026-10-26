import directory from '../Documentation/incu-brands.seed.json'
import type { Snapshot } from '../src/lib/model'
export function createSample(): Snapshot {
  const brands = directory.brands.map(b => ({ id: b.slug, name: b.name, aliases: [] as string[], active: ['ganni','a-p-c','acne-studios','carhartt-wip','salomon','new-balance','comme-des-garcons-play','toteme'].includes(b.slug), departments: b.departments, sourcePages: b.source_pages, retrievedOn: directory.retrieved_on }))
  const sample: Snapshot = {
    store: { id: 'sample-store', name: 'Incu · Sample store', timezone: 'Australia/Melbourne', revision: 0 }, brands,
    categories: ['Knitwear', 'Denim', 'Footwear', 'T-shirts', 'Outerwear', 'Accessories', 'Dresses', 'Trousers'].map(name => ({ id: name.toLowerCase(), name, active: true })),
    departments: ['Women', 'Men', 'Unisex'].map(name => ({ id: name.toLowerCase(), name, active: true })),
    locations: [
      { id: 'c03', area: 'Sales floor', code: 'C03', kind: 'Cabinet', parentId: null },
      { id: 'd02', area: 'Sales floor', code: 'D02', kind: 'Drawer', parentId: 'c03' },
      { id: 'd03', area: 'Sales floor', code: 'D03', kind: 'Drawer', parentId: 'c03' },
      { id: 'r01', area: 'Back room', code: 'R01', kind: 'Rack', parentId: null },
      { id: 's01', area: 'Back room', code: 'S01', kind: 'Shelf', parentId: null },
      { id: 's02', area: 'Back room', code: 'S02', kind: 'Shelf', parentId: null },
    ],
    groups: [
      { id: 'g1', brandId: 'ganni', categoryId: 'knitwear', departmentId: 'women' },
      { id: 'g2', brandId: 'a-p-c', categoryId: 'denim', departmentId: 'men' },
      { id: 'g3', brandId: 'acne-studios', categoryId: 't-shirts', departmentId: 'unisex' },
      { id: 'g4', brandId: 'salomon', categoryId: 'footwear', departmentId: 'unisex' },
      { id: 'g5', brandId: 'carhartt-wip', categoryId: 'outerwear', departmentId: 'men' },
      { id: 'g6', brandId: 'new-balance', categoryId: 'footwear', departmentId: 'women' },
      { id: 'g7', brandId: 'ganni', categoryId: 'dresses', departmentId: 'women' },
    ], placements: [], movements: []
  }
  const pairs = [['g1','d02'],['g1','r01'],['g2','d03'],['g3','s01'],['g4','s02'],['g5','r01'],['g6','s02']]
  pairs.forEach(([groupId, locationId], i) => {
    sample.placements.push({ groupId, locationId })
    const g = sample.groups.find(g => g.id === groupId)!
    const l = sample.locations.find(l => l.id === locationId)!
    const parent = sample.locations.find(p => p.id === l.parentId)
    sample.movements.push({ id: `sample-${i}`, groupId, kind: i === 1 ? 'also' : 'place', groupLabel: `${brands.find(b => b.id === g.brandId)!.name} · ${sample.categories.find(c => c.id === g.categoryId)!.name} · ${sample.departments.find(d => d.id === g.departmentId)!.name}`, from: null, to: locationId, fromLabel: null, toLabel: `${l.area} → ${parent ? `${parent.kind} ${parent.code} → ` : ''}${l.kind} ${l.code}`, reason: '', at: new Date(Date.now() - (pairs.length - i) * 3600000).toISOString() })
  })
  return sample
}
