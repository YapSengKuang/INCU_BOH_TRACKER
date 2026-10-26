# Firebase setup and deployment

Updated 26 October 2026. Firebase replaces the Supabase prototype, retained under `archive/supabase`. The owner created **INCUBOHMANAGER**, ID `incubohmanager`, with a Standard Native `(default)` Firestore database on Spark. The console reports **nam5 (United States)**. Use this existing database, whose location differs from the earlier Sydney preference.

## Local development

Hosted setup is complete for the local app: rules/indexes deployed, the live catalogue seeded, Google sign-in enabled, and the first verified owner bootstrapped. Cloudflare still needs this frontend release and its five environment variables. The numbered steps below document repeatable setup, not unfinished local provisioning.

Requires Node 22.12+ (Node 24 tested). With all five Firebase/store variables unset the app uses isolated sample browser data. Partial configuration is an error. Connected mode removes the sample role picker and uses actual Google authentication and membership.

```sh
npm ci
npm test
npm run build
```

Security/integration tests additionally require **Java 21+** on `JAVA_HOME` or `PATH`:

```sh
npm run test:rules
npm run emulators
```

Tests use fake project `demo-boh`, never live data. Firestore runs on `127.0.0.1:8787`; Auth on `127.0.0.1:9099`. For app integration, supply a demo web configuration with project `demo-boh`, a valid-shaped dummy API key/app ID, store `main`, and `VITE_USE_FIREBASE_EMULATORS=true`. Seed using the admin script with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8787` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Emulator mode is rejected outside localhost; never enable it on a hosted build.

## Connect the existing project

1. Sign in with `npx -y firebase-tools@latest login`. `.firebaserc` selects `incubohmanager`; explicitly pass `--project incubohmanager` for remote operations. This implementation does not require paid services.
2. The BOH Web app is registered, and local connection is active through the ignored `.env.local` file. An ignored `.env.firebase.local` profile also holds the selected configuration (Vite mode `firebase`). For a new environment, obtain the configuration from Firebase project settings. These identifiers are public configuration; administrator credentials must never appear in `VITE_` variables.
3. Enable Authentication → Google, choose the intended support email, and add `localhost`, `127.0.0.1`, and the actual deployment hostname to authorised domains. Google sign-in alone grants no editing access.
4. Inspect existing rules and collections before deploying. The BOH rule file denies all non-BOH paths, so do not overwrite rules belonging to another app. This project's database was empty when inspected. Test, then deploy:

   ```sh
   npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project incubohmanager
   ```

5. Seed a fresh live store:

   ```sh
   npm run firebase:admin -- seed --project incubohmanager --store main --name BOH --cli-account YOUR_GOOGLE_EMAIL
   ```

   The tool normally uses Google Application Default Credentials. The optional `--cli-account` adapter reuses a named signed-in account through the pinned local Firebase CLI and initialises the Firestore server client with in-memory OAuth user credentials. Tokens remain in memory; none are printed or saved in the repository. Seed creates 140 disabled brands, 12 categories, four departments and **no live locations or stock**. Existing stores/populated destination collections are rejected.
6. Fill `.env.local` from `.env.example`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_STORE_ID=main`. Restart Vite.
7. Sign in through BOH using the intended owner's Google account. It remains a viewer until bootstrap. Copy its UID from Firebase Authentication, then grant initial owner access:

   ```sh
   npm run firebase:admin -- owner --project incubohmanager --store main --uid VERIFIED_GOOGLE_UID --owner-email OWNER_EMAIL --cli-account YOUR_GOOGLE_EMAIL
   ```

   The tool verifies the Auth identity, verified email and Google provider, and refuses an existing owner or matching membership. Browser clients cannot create owners. Refresh the app to pick up the role.
8. Enable store brands and enter physically confirmed starting locations. Sample starter records are retained separately and are not automatically uploaded as verified live inventory.

## Access and invitations

Guests can read directory data and public movement history, including storage addresses. This is the intended product access model. Private memberships, invitations, email indexes, actor identities, notes and retry receipts are separate collections. Owners can list staff/export private data; signed-in users can inspect their own membership, invitation and receipts.

Owners invite an email in Settings → Staff and share the BOH website link themselves. **The app does not send invitation emails.** Staff choose Continue with Google using the matching verified email. The invitation is consumed atomically and grants editor access. Owners can revoke editor membership or unused invitations. Every save checks current database membership, so subsequent writes are denied immediately after revocation. Owner removal is an administrator operation.

## Atomic saves and data model

All data lives under `stores/{storeId}`. Public collections: `brands`, `categories`, `departments`, `locations`, `groups`, `movements`. Private collections: `members`, `invitations`, `accessEmails`, `commands`. `codes`, `uniqueNames`, and `groupKeys` enforce uniqueness without private information.

Each save is a Firestore transaction checking actual membership, an immutable retry receipt and the expected global store revision. It commits records, counters, history, private notes, receipt and revision together. Rules independently validate every affected record and require the command's results through `getAfter()`. This works without a paid Cloud Function.

Unrelated edits can cause conservative revision conflicts. Forms preserve input and require explicit reload/review. A retry uses the same request ID and payload; a committed receipt prevents duplicate history. Moving into an already linked destination removes only the chosen source. Occupied locations and units with children cannot be deleted. Rule bounds include 100 placements per group, 160-character names/reasons, 2,000-character private notes, and bounded counters.

Public history snapshots labels at movement time; later renames/deletions do not rewrite it. Private notes/actors appear only in owner exports. Before/after revision reads bracket collection queries for coherent snapshots/exports. Administrator writes bypass these rules and must be coordinated separately; do not manually change live records while staff edit.

## Backup and recovery

Owners download a protected JSON containing the public snapshot, private staff/access data, notes, receipts, indexes and counters. Keep the original securely. Manual JSON exports are the Sprint 1 backup mechanism; paid managed backups and scheduled Cloud Functions are not enabled.

Sample recovery in Settings → Export & recovery also accepts `public/starter-backup.json` and changes only the browser's sample workspace.

Connected recovery uses a trusted administrator and **a fresh store ID**:

```sh
npm run firebase:admin -- recover --project incubohmanager --store recovered-20261026 --name 'Recovered BOH' --backup /absolute/path/owner-export.json --cli-account YOUR_GOOGLE_EMAIL
```

Recovery checks the public snapshot against raw records, relationships, unique indexes, counters, membership indexes and timestamps. Private records/receipts are preserved. In another project, restore matching verified Auth users first; the script rejects missing/mismatched active identities. The destination must be empty. Recovery is atomic and currently supports **up to 450 documents**, rejecting larger backups before writing. Larger stores need a reviewed administrator migration. Export/recover regularly as the store grows; a successful download does not establish that the export fits this tool.

Compare every recovered collection and repeat sign-in/search/movement checks in a test build before changing production. Emulator tests verify recovery, but a hosted recovery drill remains a release check.

## Cloudflare hosting

Keep the existing Cloudflare target. Build: `npm ci && npm run build`; output: `dist`; Node: 24. Set all five browser/store variables in the deployment environment before building. Use a separate test store/project for writable previews.

`public/_headers` permits Firebase/Google Auth and database endpoints, preserves local Geist fonts and permits the Google popup. `public/_redirects` handles SPA navigation. Verify the deployed Auth hostname allowlist, popup sign-in, guest browsing, invited editing, revoked access and owner export on the actual deployment. Retain a successful frontend release for rollback; restore data into a fresh store rather than overwriting live records.

Spark quotas apply across this project. The current client loads directory/history collections, so reads grow with database size and refreshes. Monitor usage; add pagination/selective loading before large rollouts. Current limits: [Firebase pricing](https://firebase.google.com/pricing), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).
