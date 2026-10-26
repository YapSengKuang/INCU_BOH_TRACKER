# Sprint 1 implementation status

26 October 2026. Firebase is the current backend; the Supabase prototype is archived.

## Implemented

Public stock search/combined filters; every current storage address; staff setup; 140-brand directory; category/department management; first/additional placements; source-only moves; corrections/removals with reasons; immutable public history; private staff notes; owner invitations/revocation/exports; sample recovery; Firebase administrator bootstrap/recovery tools.

The UI retains BOH branding, the approved palette, local Geist, direct headings and collapsible left navigation. Starter records remain available in the isolated sample workspace. Connected mode uses verified Google sign-in and database membership, with no sample role picker.

## Current verification

- 22 tests pass: 12 sample-domain/starter-data checks and 10 Firestore integration/security checks.
- Firestore Standard emulator tests exercise real transactions: public/private reads, denied writes, option creation/rename/uniqueness, groups, parent counters, occupied deletion, split placements, merging moves, immutable history, idempotent retries, invitation claim, revocation, owner escalation denial, competing/stale revisions and complete owner-export recovery.
- Hostile batches bypass friendly client validation and target forged labels/addresses/actors/timestamps, missing history/counters, extra fields, private-note leakage, oversized notes, duplicate links, unverified users and uninvited users.
- Production TypeScript/Vite build checked. Archived PGlite tests are no longer counted as current backend verification.

Earlier UI browser checks covered desktop/mobile navigation, search, details, group creation/first placement, optional notes, reasons, focus restoration and sample export/recovery. These do not establish hosted Google Auth or persistence verification.

## Hosted connection

The owner created `incubohmanager`, Standard Native Firestore `(default)`, on Spark. The console reports location `nam5` (United States). Before setup, remote inspection confirmed no collections and default deny-all rules.

Completed hosted setup:

- Registered the BOH web app and enabled Google Authentication with the approved support address.
- Authorised localhost and `127.0.0.1` for local sign-in.
- Signed into Firebase CLI with the owner's approval; deployed the tested rules and indexes successfully.
- Seeded `stores/main` atomically: 140 disabled brands, 12 categories, four departments and uniqueness indexes (312 documents). No sample locations, stock groups or movements were uploaded.
- Completed actual Google popup sign-in, confirmed a verified account remained a viewer before bootstrap, and assigned that account as the initial store owner.
- Activated the ignored `.env.local` Firebase configuration. Verified live guest browsing, owner controls and a category save preserving its existing values. The resulting receipt/revision exercises the deployed transaction protocol.
- Added a busy state to prevent repeated export clicks while preparing a backup. The browser export returned to its ready state without a displayed error, but the automation download event did not yield a file. The browser's security policy blocked access to Chrome's download-history page, so a saved backup file has not been independently verified.

The administrator's explicit CLI-account path now uses Firestore's public server-client constructor with in-memory OAuth user credentials; Firebase Admin Auth uses its token credential. Both live seed and verified-owner bootstrap succeeded through this path. No administrator tokens or keys are stored in source files.

Cloudflare frontend deployment/environment configuration has not been changed by this migration. The existing remote frontend will need the new build and five Firebase/store variables before it uses this database.

## Remaining release checks

- Verify a second real staff account can claim an invitation and loses editing access after revocation (covered in emulator tests, not yet tested with another person).
- Set all five Firebase/store variables in the Cloudflare build, authorise its actual hostname, deploy this frontend and verify the deployed headers.
- Trial with invited staff on a physical tablet/PC; confirm real storage locations.
- Independently verify a browser backup download, perform hosted recovery and retain a successful frontend release for rollback. The atomic admin recovery tool currently supports up to 450 documents; monitor export size.

See [setup and deployment](setup-and-deployment.md). Maps and PDF reports remain later-sprint work.

Production dependency audit: zero reported vulnerabilities after compatible gRPC/re2 patches. Five moderate advisories remain in Firebase CLI development dependencies (OpenTelemetry and gaxios/uuid chains); resolving them requires upstream or major-version changes. These CLI dependencies are not shipped in the browser bundle.
