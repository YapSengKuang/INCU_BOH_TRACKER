import type { Kind, Location } from './model'
import { requireText } from './model'

export const MAX_LOCATION_QUANTITY = 100
export const storageCodePrefixes: Record<Kind,string> = {
  Cabinet:'C', Rack:'R', Shelf:'S', Drawer:'D', Room:'RM', Wall:'W', Tub:'T', Area:'A',
}
export function validateLocationQuantity(quantity:number) {
  if(!Number.isInteger(quantity)||quantity<1||quantity>MAX_LOCATION_QUANTITY)throw new Error(`Enter a whole number from 1 to ${MAX_LOCATION_QUANTITY}.`)
}
export function generateLocationCodes(locations:readonly Location[],kind:Kind,quantity:number):string[] {
  validateLocationQuantity(quantity)
  const prefix=storageCodePrefixes[kind],pattern=new RegExp(`^${prefix}(\\d+)$`)
  const reserved=new Set(locations.map(l=>l.code.trim().toUpperCase()))
  let highest=0n
  for(const code of reserved){const match=code.match(pattern);if(match){const number=BigInt(match[1]);if(number>highest)highest=number}}
  const codes:string[]=[]
  for(let number=highest+1n;codes.length<quantity;number++){
    const code=`${prefix}${String(number).padStart(2,'0')}`
    if(code.length>160)throw new Error('Generated codes are too long. Use a manual code instead.')
    if(!reserved.has(code)){codes.push(code);reserved.add(code)}
  }
  return codes
}
export function createLocationBatch(first:Location,codes:readonly string[],quantity:number):Location[] {
  validateLocationQuantity(quantity)
  requireText(first.area,'Area')
  if(codes.length!==quantity)throw new Error('Check the location codes before creating locations.')
  const normalised=codes.map(code=>code.trim().toUpperCase())
  normalised.forEach(code=>requireText(code,'Location code'))
  if(new Set(normalised).size!==quantity)throw new Error('Each location needs a different code.')
  return normalised.map((code,index)=>({...first,id:index===0?first.id:crypto.randomUUID(),area:first.area.trim(),code}))
}
