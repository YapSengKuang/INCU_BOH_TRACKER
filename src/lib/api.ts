import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { collection, connectFirestoreEmulator, doc, getDocFromServer, getDocsFromServer, getFirestore } from 'firebase/firestore'
import type { Backup, Request, Role, Snapshot, Staff } from './model.ts'
import { exportDemo, readDemo, restoreDemo, saveDemo } from './demo.ts'
import { applyFirebaseCommand } from './firebase-commands.ts'
import { exportFirebaseStore, readConsistentStore } from './firebase-store.ts'
import { staffFromRecords, validId } from './firebase-schema.ts'
const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID}
const storeId=import.meta.env.VITE_STORE_ID
const configured=[...Object.values(config),storeId].filter(Boolean).length
export const isDemo=configured===0
let configurationError=configured>0&&configured!==5?'Set all five Firebase/store environment variables, or leave them all empty for sample mode.':''
const app=configured===5?initializeApp(config):null
const auth=app?getAuth(app):null,db=app?getFirestore(app):null
if(import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true'&&app){
  if(!['localhost','127.0.0.1','[::1]'].includes(window.location.hostname))configurationError='Emulator mode is only allowed on localhost.'
  else{connectAuthEmulator(auth!,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db!,'127.0.0.1',8787)}
}
function ready(){if(configurationError)throw new Error(configurationError);if(storeId)validId(storeId)}
async function actor(){
  ready();await auth?.authStateReady()
  const user=auth?.currentUser
  if(!user?.email)throw new Error('Sign in with an invited Google account.')
  return {uid:user.uid,email:user.email,emailVerified:user.emailVerified}
}
export function writeSession(){ return isDemo ? 'sample' : auth?.currentUser?.uid ?? 'guest' }
export function watchAuth(callback:()=>void){
  if(!auth){callback();return ()=>{}}
  return onAuthStateChanged(auth,callback)
}
export async function loadSnapshot():Promise<Snapshot>{
  ready();if(!db)return structuredClone(readDemo().snapshot)
  return (await readConsistentStore(db,storeId)).snapshot
}
export async function getRole():Promise<Role>{
  ready();if(!auth||!db)return 'guest'
  await auth.authStateReady()
  if(!auth.currentUser?.emailVerified)return 'guest'
  const member=await getDocFromServer(doc(db,'stores',storeId,'members',auth.currentUser.uid))
  return member.exists()?member.data().role as Role:'guest'
}
export async function save(request:Request,role:Role,expectedSession=writeSession()):Promise<Snapshot>{
  ready();if(!db)return saveDemo(request,role)
  const user=await actor()
  if(user.uid!==expectedSession)throw new Error('The signed-in account changed. Review this change before saving again.')
  await applyFirebaseCommand(db,storeId,request,user)
  return loadSnapshot()
}
export async function loadStaff(role:Role):Promise<Staff[]>{
  ready();if(role!=='owner')return []
  if(!db)return structuredClone(readDemo().staff)
  const [members,invitations]=await Promise.all(['members','invitations'].map(t=>getDocsFromServer(collection(db,'stores',storeId,t))))
  return staffFromRecords({members:Object.fromEntries(members.docs.map(d=>[d.id,d.data()])),invitations:Object.fromEntries(invitations.docs.map(d=>[d.id,d.data()]))})
}
export async function downloadBackup(role:Role):Promise<Backup>{
  ready();if(!db)return exportDemo(role)
  if(role!=='owner')throw new Error('Only the owner can export data.')
  return exportFirebaseStore(db,storeId)
}
export async function recoverSample(input:unknown,role:Role){
  if(!isDemo)throw new Error('Use the documented Firebase administrator recovery process for a connected store.')
  await restoreDemo(input,role)
}
export async function signIn(){
  ready();if(!auth)throw new Error('Use the sample role picker in this browser.')
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'})
  await signInWithPopup(auth,provider)
}
export async function signOut(){await (auth?firebaseSignOut(auth):Promise.resolve())}
export async function claimInvitation(){
  ready();if(!db)return
  const user=await actor(),store=await getDocFromServer(doc(db,'stores',storeId))
  if(!store.exists())throw new Error('Store not found.')
  await applyFirebaseCommand(db,storeId,{action:'claim',payload:{id:user.uid,email:user.email.trim().toLowerCase()},requestId:crypto.randomUUID(),expectedRevision:store.data().revision},user)
}
