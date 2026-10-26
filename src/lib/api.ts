import { createClient } from '@supabase/supabase-js'
import type { Backup, Request, Role, Snapshot, Staff } from './model'
import { ConflictError } from './model'
import { exportDemo, readDemo, restoreDemo, saveDemo } from './demo'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const storeId = import.meta.env.VITE_STORE_ID
const configured = [url, key, storeId].filter(Boolean).length
const configurationError = configured > 0 && configured !== 3 ? 'Set all three Supabase environment variables, or leave all three empty for the sample workspace.' : ''
export const supabase = configured === 3 ? createClient(url, key) : null
export const isDemo = configured === 0
function unwrap<T>({ data, error }: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (error) {
    if (error.message.includes('STORE_CONFLICT')) throw new ConflictError()
    throw new Error(error.message)
  }
  return data as T
}
export async function loadSnapshot(): Promise<Snapshot> {
  if (configurationError) throw new Error(configurationError)
  if (!supabase) return structuredClone(readDemo().snapshot)
  const snapshot = unwrap<Snapshot | null>(await supabase.rpc('get_store_snapshot', { p_store: storeId }))
  if (!snapshot) throw new Error('This store could not be found. Check VITE_STORE_ID and the database setup.')
  return snapshot
}
export async function getRole(): Promise<Role> {
  if (!supabase) return 'guest'
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return 'guest'
  // Checks database membership. A signed-in account alone has no editing rights.
  return unwrap<Role>(await supabase.rpc('get_my_store_role', { p_store: storeId }))
}
export async function save(request: Request, role: Role): Promise<Snapshot> {
  if (!supabase) return saveDemo(request, role)
  unwrap(await supabase.rpc('apply_store_command', { p_store: storeId, p_request: request.requestId, p_expected: request.expectedRevision, p_action: request.action, p_payload: request.payload }))
  return loadSnapshot()
}
export async function loadStaff(role: Role): Promise<Staff[]> {
  if (role !== 'owner') return []
  if (!supabase) return structuredClone(readDemo().staff)
  return unwrap<Staff[]>(await supabase.rpc('get_store_staff', { p_store: storeId }))
}
export async function downloadBackup(role: Role): Promise<Backup> {
  if (!supabase) return exportDemo(role)
  return unwrap<Backup>(await supabase.rpc('export_store', { p_store: storeId }))
}
export async function recoverSample(input: unknown, role: Role) {
  if (!isDemo) throw new Error('Recovery is available in the sample workspace only. Use the documented database recovery process for a connected store.')
  await restoreDemo(input, role)
}
export async function signIn(email: string) {
  if (!supabase) throw new Error('Use the sample role picker to preview staff editing.')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  if (error) throw error
}
export async function claimInvitation() {
  if (supabase) unwrap(await supabase.rpc('accept_store_invitation', { p_store: storeId }))
}
