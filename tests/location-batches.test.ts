import {describe,it,expect} from 'vitest'
import {generateLocationCodes,createLocationBatch,storageCodePrefixes,validateLocationQuantity} from '../src/lib/location-batches'
import type {Location,Kind} from '../src/lib/model'
const row=(code:string,area='Back of House'):Location=>({id:code,code,area,kind:'Cabinet',parentId:null})
describe('generated storage locations',()=>{
 it('uses a distinct code prefix for each storage type',()=>{
  for(const kind of Object.keys(storageCodePrefixes) as Kind[])expect(generateLocationCodes([],kind,2)).toEqual([`${storageCodePrefixes[kind]}01`,`${storageCodePrefixes[kind]}02`])
  expect(new Set(Object.values(storageCodePrefixes)).size).toBe(8)
 })
 it('continues numbering across areas and includes pending codes regardless of letter case',()=>{
  expect(generateLocationCodes([row('c01'),row('C04','Sales floor'),row('C05','Pending area'),row('CUSTOM')],'Cabinet',3)).toEqual(['C06','C07','C08'])
  expect(generateLocationCodes([row('R99'),row('RM02')],'Room',2)).toEqual(['RM03','RM04'])
 })
 it('keeps codes precise beyond two digits or JavaScript integer precision',()=>{
  expect(generateLocationCodes([row('D99')],'Drawer',2)).toEqual(['D100','D101'])
  expect(generateLocationCodes([row('C9007199254740993')],'Cabinet',1)).toEqual(['C9007199254740994'])
 })
 it('validates quantities and rejects duplicate or incomplete manual code lists',()=>{
  for(const value of [0,-1,1.5,101,NaN,Infinity])expect(()=>validateLocationQuantity(value)).toThrow('whole number')
  expect(()=>createLocationBatch(row('C01'),['C01','c01'],2)).toThrow('different code')
  expect(()=>createLocationBatch(row('C01'),['C01'],2)).toThrow('Check the location codes')
 })
 it('creates separate identities while retaining the same area, type and parent',()=>{
  const first={...row(''),id:'first',kind:'Drawer' as const,parentId:'cabinet'}
  const batch=createLocationBatch(first,['D01','D02','D03'],3)
  expect(batch.map(l=>l.code)).toEqual(['D01','D02','D03'])
  expect(batch[0].id).toBe('first');expect(new Set(batch.map(l=>l.id)).size).toBe(3)
  for(const location of batch)expect(location).toMatchObject({area:'Back of House',kind:'Drawer',parentId:'cabinet'})
  expect(first.code).toBe('')
 })
})
