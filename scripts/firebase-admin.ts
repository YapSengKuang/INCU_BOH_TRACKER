// Trusted workstation only. Never import this module into the browser app.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { applicationDefault,initializeApp } from 'firebase-admin/app'
import { Firestore,getFirestore,Timestamp } from 'firebase-admin/firestore'
import type { DocumentData } from 'firebase-admin/firestore'
import type { Records } from '../src/lib/firebase-schema.ts'
import { getAuth } from 'firebase-admin/auth'
import { seedRecords,prepareRecovery } from '../src/lib/firebase-seed.ts'
import { normaliseEmail,validId } from '../src/lib/firebase-schema.ts'
import type { Snapshot } from '../src/lib/model.ts'

const [command,...args]=process.argv.slice(2)
function option(key:string,required=true){const i=args.indexOf(`--${key}`),value=i>=0?args[i+1]:undefined;if(required&&(!value||value.startsWith('--')))throw new Error(`Missing --${key}`);return value??''}
if(!['seed','owner','recover'].includes(command))throw new Error('Usage: npm run firebase:admin -- seed|owner|recover --project PROJECT --store STORE [--name NAME] [--owner-email EMAIL --uid UID] [--backup FILE] [--cli-account EMAIL]')
const projectId=option('project'),storeId=option('store');validId(storeId)
// ADC is the standard option. The optional adapter reuses an explicitly selected
// local Firebase CLI account; the CLI is pinned and no tokens are printed/saved.
let credential=applicationDefault()
let cliCredentials:Record<string,string>|undefined
const cliAccount=option('cli-account',false)
if(cliAccount){
  const require=createRequire(import.meta.url),cliAuth=require('firebase-tools/lib/auth'),cliApi=require('firebase-tools/lib/api')
  const account=cliAuth.getAllAccounts().find((a:{user:{email:string}})=>a.user.email.toLowerCase()===cliAccount.toLowerCase())
  if(!account?.tokens.refresh_token)throw new Error('Sign in to the requested Firebase CLI account first.')
  cliCredentials={type:'authorized_user',client_id:cliApi.clientId(),client_secret:cliApi.clientSecret(),refresh_token:account.tokens.refresh_token,quota_project_id:projectId}
  credential={async getAccessToken(){const t=await cliAuth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);return {access_token:t.access_token,expires_in:Math.max(60,Math.floor((t.expires_at-Date.now())/1000))}}}
}
// Admin Auth accepts token credentials; Admin Firestore's factory requires ADC
// or certificates. Its exported server client also supports in-memory OAuth user
// credentials, so use that public constructor for the explicit CLI-account path.
const app=initializeApp({projectId,credential}),db=cliCredentials?new Firestore({projectId,credentials:cliCredentials}):getFirestore(app),root=db.doc(`stores/${storeId}`)
try{
  if(command==='owner'){
    const uid=option('uid'),email=normaliseEmail(option('owner-email'));validId(uid)
    const account=await getAuth(app).getUser(uid)
    if(!account.emailVerified||account.email?.toLowerCase()!==email||!account.providerData.some(p=>p.providerId==='google.com'))throw new Error('Owner must first sign in with the matching verified Google account.')
    await db.runTransaction(async tx=>{
      const store=await tx.get(root),member=root.collection('members').doc(uid),index=root.collection('accessEmails').doc(email)
      const [m,i,owners]=await Promise.all([tx.get(member),tx.get(index),tx.get(root.collection('members').where('role','==','owner'))])
      if(!store.exists)throw new Error('Seed the store first.')
      if(m.exists||i.exists||!owners.empty)throw new Error('Initial owner bootstrap requires no existing owner or matching membership.')
      tx.create(member,{uid,email,role:'owner',lastRequest:'bootstrap'});tx.create(index,{uid,role:'owner',lastRequest:'bootstrap'})
      tx.update(root,{revision:store.data()!.revision+1})
    })
    console.log(`Initial owner set for ${projectId}/${storeId}.`)
  }else{
    let store:DocumentData,records:Records
    if(command==='seed'){
      const directory=JSON.parse(await readFile(new URL('../Documentation/incu-brands.seed.json',import.meta.url),'utf8')) as {retrieved_on:string;brands:{slug:string;name:string;departments:string[];source_pages:string[]}[]}
      const snapshot:Snapshot={store:{id:storeId,name:option('name',false)||'BOH',timezone:'Australia/Melbourne',revision:0},brands:directory.brands.map(b=>({id:b.slug,name:b.name,active:false,aliases:[],departments:b.departments,sourcePages:b.source_pages,retrievedOn:directory.retrieved_on})),categories:['Knitwear','Denim','Footwear','T-shirts','Outerwear','Accessories','Dresses','Trousers','Tops','Jackets','Hats','Bags'].map(name=>({id:name.toLowerCase(),name,active:true})),departments:['Women','Men','Unisex','Unspecified'].map(name=>({id:name.toLowerCase(),name,active:true})),locations:[],groups:[],placements:[],movements:[]}
      store={...snapshot.store,lastRequest:'bootstrap'};records=seedRecords(snapshot)
    }else{
      const backup=JSON.parse(await readFile(option('backup'),'utf8'))
      const result=prepareRecovery(backup,storeId,option('name',false)||'Recovered BOH',iso=>Timestamp.fromDate(new Date(iso)))
      store=result.store;records=result.records
      // Recovery in another project must preserve real identity references.
      for(const m of Object.values(records.members)){const u=await getAuth(app).getUser(m.uid);if(u.email?.toLowerCase()!==m.email||!u.emailVerified)throw new Error('Restore matching verified Auth identities before recovering membership.')}
    }
    const entries=Object.entries(records).flatMap(([table,rows])=>Object.entries(rows as object).map(([id,data])=>({ref:root.collection(table).doc(id),data})))
    if(entries.length>450)throw new Error('This atomic recovery tool supports up to 450 documents. Keep the original export and use a reviewed administrator migration for larger stores.')
    if((await root.listCollections()).length)throw new Error('Destination already contains collections. Choose a fresh store ID.')
    await db.runTransaction(async tx=>{if((await tx.get(root)).exists)throw new Error('Destination store already exists.');tx.create(root,store);for(const e of entries)tx.create(e.ref,e.data)})
    console.log(`${command==='seed'?'Seeded':'Recovered'} ${entries.length} documents in ${projectId}/${storeId}.`)
  }
}finally{await db.terminate()}
