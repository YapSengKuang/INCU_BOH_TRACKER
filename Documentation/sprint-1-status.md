# Sprint 1 implementation status

26 October 2026.

## Built locally

Public stock search and combined filters; exact location addresses; all locations per stock group; clear unplaced-stock messages; staff group/location setup; store-brand selection from the 140-entry directory; category/department management; first placements, additional locations, moves, corrections/removals with reasons; dated immutable public history; private staff notes; owner invitations/revocation and exports; validated sample recovery; Supabase migration, seed and admin-only connected-store recovery; Cloudflare Pages configuration and setup guide.

All app flows work with isolated browser sample data. Real Supabase authentication and shared persistence are wired to environment configuration, but remain unconnected at the owner's request. The sample role picker is labelled and absent in connected mode. No map or PDF controls appear before those features are available.

## Verification

- `npm test`: 22 passing tests across the sample domain and real embedded Postgres.
- Migration executed on PGlite, with separate `anon`, `authenticated`, owner, editor, uninvited and unconfirmed-email identities.
- Verified guest reads, denied direct table writes, denied private reads, uninvited/cross-store write denial, owner-only staff/export access, confirmed-email invitation acceptance, revocation, immutable public labels, first placements and corrections, source-only moves, duplicate destination merging, idempotent retry receipts, stale-revision rejection, occupied-location protection and rollback after private-history insertion fails.
- Owner database backup restored to a fresh store; public data, staff, private notes, audit actors, invitations and request receipts compared with the original.
- Brand seed executed in a fresh database: 140 brands, zero sample stock groups.
- Production TypeScript/Vite build checked.
- Browser QA: public search; staff additional storage; source-only moves; retained split locations; guest visibility and dated history; duplicate group rejection with retained form values; successful group creation and first placement; owner JSON download and recovery through the file picker. Layouts inspected at 1280 px desktop, 768 px tablet and the default 423 px mobile viewport. Tablet overflow check returned content width = viewport width. Screenshot: `sprint-1-preview.png`.

PGlite exercises Postgres SQL and permissions, not Supabase's hosted Auth email service, PostgREST configuration or Cloudflare infrastructure.

## Still required before calling the sprint deployed

- Provision/connect the dedicated database and apply migration/seed.
- Bootstrap the first owner and verify actual email sign-in, invitations and role enforcement through the hosted Data API.
- Create preview/live Cloudflare deployments and verify redirect URLs and headers.
- Run the demo with an invited staff member on a physical tablet and PC.
- Confirm real initial locations in person; no sample data is verified store inventory.
- Perform a hosted export/recovery drill and establish a previous successful deployment for rollback.

These release gates remain open. The owner selected local preparation with database connection later; no cloud resources were created or changed.

## UI update — 26 October 2026

Applied the owner’s orange/peach/beige/blue palette and locally hosted Geist variable font. Removed promotional headings, sidebar slogans, summary cards and release footer. The stock list shows all complete location addresses. Creating a group opens its details with the first-placement action; mobile selection scrolls details into view, closing restores row focus, and optional notes are collapsed.

Design rules are recorded in [the design document](design-document.md). Browser checks covered desktop/mobile search and navigation, creating a group and first placement, optional notes, correction reasons, focus restoration, history, settings and the collapsible menu. The existing 22 database/domain checks and production build pass. Hosted release gates above remain open.
