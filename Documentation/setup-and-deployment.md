# Connect and deploy Sprint 1

## Current state

The app is built and checked locally. Per the owner's instruction, database provisioning and hosting are deferred. Keep using the clearly labelled sample workspace until a dedicated Supabase project is ready. Do not point this app at another app's database.

## Database setup

1. Create a dedicated Supabase project in the intended organisation. Check the quoted plan and cost; this work has not created a project or incurred hosting/database charges.
2. Apply `supabase/migrations/20261026091224_sprint_one_stock_finder.sql` using the SQL Editor or the Supabase CLI migration workflow. The CLI is pinned in dev dependencies. Discover current commands with `npx supabase --help` before operating a hosted project.
3. Run `supabase/seed.sql` once in the fresh database. It creates an Incu store, 140 documented brands (all initially disabled), categories and departments. It loads no example locations or stock. `node scripts/generate-seed.mjs` regenerates the seed from the saved directory.
4. Enable email authentication. Configure the Site URL and allowed redirect URLs for the local, preview and production origins. The app uses passwordless email links. A confirmed account alone grants no store access.
5. Sign in as the initial owner using the website's staff sign-in form. It is expected to remain a public viewer until bootstrap is complete. Copy that user's UUID from Supabase Authentication, and the store UUID from `public.stores`. As database administrator, add the owner explicitly:

   ```sql
   insert into private.memberships(store_id,user_id,role)
   values ('<actual store UUID>','<actual confirmed owner user UUID>','owner');
   ```

6. Copy `.env.example` to `.env.local` and fill in the project's API URL, **publishable** browser key and store UUID. Never use a service-role/secret key in `VITE_` variables. Set all three variables together. Restart Vite after changes.
7. Sign out/in or refresh the page to pick up owner membership. Enable store brands in Settings, then enter physically verified starting locations.

Supabase public API schema exposure should remain `public` only. **Do not expose `private` through PostgREST.** Public tables have RLS and read-only grants. All mutations are authorised server-side against `private.memberships`. Private implementations use a fixed empty search path and explicit grants; public RPC wrappers use invoker security. Guests can read directory tables and the snapshot RPC; they cannot mutate or retrieve private account/audit data. Self-service signup does not confer membership.

### Invitations

Owners add an email allowlist entry in Settings → Staff and share the website link with that person. This action does not send email automatically. Staff request a sign-in link, sign in with that confirmed email, then choose **Already signed in? Accept store invitation**. The database consumes only a matching confirmed email invitation and grants editor access. Owners can revoke active editor membership or unused invitations. Membership is checked on every write, so revocation takes effect for subsequent saves without waiting for token refresh. Owner removal is intentionally not exposed through the app.

## Cloudflare Pages

The documented hosting target remains Cloudflare Pages. No Sites registration or deployment has been performed.

- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Node: 24, or another version supported by the pinned Vite release.
- Set the three `VITE_` variables in the deployment environment before building. Use a separate Supabase project for preview if writes should be exercised there. A build with all three unset is clearly labelled sample mode; partial configuration reports an error.
- `public/_headers` supplies security headers and a restrictive production CSP. Geist is served locally from `public/fonts/Geist-Variable.ttf`, with its SIL Open Font License in the same directory. No external font service is required.
- `public/_redirects` serves the entry page for application URLs. All Sprint 1 sections are in the single-page workspace.
- Allow the deployed origin in Supabase Auth redirect settings and verify guest browsing, invitation acceptance and owner export on the actual deployment.

## Atomic saves and conflicts

Each command locks the store row, checks current database membership, checks its idempotency receipt, then compares the expected store revision. Setup changes, placements, public history, private notes, the revision and the retry receipt commit together. Direct client writes to directory tables are denied. The lock serialises location deletion with stock updates and prevents cross-record races. Commands scope every lookup to the store. A move into an already linked destination removes only the selected source and keeps a single destination link.

The form disables repeat clicks while saving and retains entered data after failure. Retries reuse the same request ID and payload. A changed payload gets a new request ID; it still has to pass the original expected revision. On a conflict, the user explicitly loads current data, reviews their entry and saves again. Current location selectors update after that reload. There is no automatic overwrite. This store-wide revision is deliberately conservative: unrelated edits can also require review.

For a deployment where a request's response was lost, retry without refreshing the page first. The committed request receipt returns the original result without another movement. Receipts are included in connected-store backups.

## Backup and recovery

The owner download is one database snapshot. It includes all public Sprint 1 data plus private membership, invitations, movement actors/notes and idempotency receipts. Store this JSON as a protected file. Public APIs never include the private fields.

Sample recovery: in the browser sample workspace choose **Store owner → Settings → Export & recovery**, download a backup, then choose it under recovery. It is validated before a single storage write. The local store revision advances after recovery so older open forms must review their changes. This feature intentionally recovers only the isolated sample workspace.

Connected-store recovery:

1. Preserve the downloaded original. Use an isolated recovery database or a **new store UUID** in the same database.
2. Install `supabase/recover.sql` as database administrator. Its function has no execution grant for browser roles, uses invoker security and rejects an existing destination store.
3. Supply the exported JSON as a bound parameter to `private.recover_store(backup_json, new_store_uuid, 'Recovered store')` through a trusted admin client, or as a quoted JSON literal in the SQL Editor. Never paste it into public logs or a frontend file.
4. For recovery into another project, restore the referenced Auth users first or explicitly map their UUIDs in the private records to intended identities. The routine preserves all original IDs and rejects missing identity references rather than silently dropping access/audit data.
5. Verify every recovered collection, staff role, private note and receipt against the export. Point a test build at the recovered store and repeat the search/movement demo before using it live.

The automated database test exports a populated store, recovers into a new store UUID, and compares every public collection and private table. This does not substitute for a hosted disaster-recovery drill with real Auth users.

## Release and rollback

Before schema changes, take an owner export and keep the currently working frontend deployment. Use additive migrations to preserve older frontend compatibility. After deployment, check public search and history, invited editing, denied unauthorised writes, owner export and the real starting locations. If the frontend release fails, roll Cloudflare Pages back to the previous successful deployment. Avoid destructive down-migrations; restore data into a fresh store and verify it before redirecting production to recovered records. There is no previous app deployment in this new repository yet.
