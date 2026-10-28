# BOH stock finder — Sprint 1

A React + TypeScript stock directory for tablet and PC, using Firebase Firestore Standard and Google Authentication. Without Firebase configuration it runs in an **isolated sample workspace**. The local app is now connected to the owner-created Firebase project `incubohmanager`, with Google sign-in and initial owner access verified. Cloudflare still needs the new frontend build and Firebase environment variables; see the setup guide for release status.

## Run locally

Requires Node 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. With all environment variables unset, example records are saved in this browser's local storage. The **Preview as** picker lets you exercise guest, staff editor and owner screens. This picker exists only in sample mode; it is not production authentication. Browser sample data is not shared across devices. Editing uses Web Locks and requires localhost or HTTPS in a current browser.

```sh
npm ci --prefix tools/eslint
npm run lint
npm test
npm run build
```

Use Node 24 for linting. The [isolated lint toolchain](tools/eslint/README.md) keeps its parser compatible without changing the app compiler. The ESLint workflow runs the same lint command on GitHub and publishes code-scanning results. These commands check lint, the sample reducer/starter data and the production build. Run `npm run test:rules` with Java 21+ to exercise actual Firestore rules/transactions locally, including denied writes, competing revisions, hostile batches and recovery. No cloud account or Docker is needed. `npm run emulators` starts Auth and Firestore for local integration. The superseded SQL prototype is retained under `archive/supabase`.

## Sprint 1 workflows

- Search words across brands, aliases, categories, departments and complete location addresses; combine filters.
- Open a stock group to see all current storage locations. Unplaced stock explicitly says no location is saved.
- As staff, create unique brand/category/department groups and add the first location.
- Create standalone cabinets, racks and shelves, then add child drawers/shelves with unique store codes.
- Add another storage location, move only the selected source, or correct/remove a wrong link with a reason.
- Read immutable dated public history. Earlier labels survive later renames and location deletion.
- Select from 140 imported Incu brands, enable store brands, and manage category/department options. Disabling an option preserves existing records.
- As owner, manage the private email invitation list, download a complete backup, and test sample recovery.

The UI uses the approved five-colour palette and locally hosted Geist font. See the [design document](Documentation/design-document.md) for layout, typography, wording and interaction rules.

See [setup and deployment](Documentation/setup-and-deployment.md), [verification and remaining release gates](Documentation/sprint-1-status.md), and the original [sprint plan](Documentation/sprint-plan.md).

## Store starter data (26 October 2026)

Fresh sample workspaces use `Documentation/starter-data.json`: 21 named storage areas,
32 location records (including four shoe cabinets, four POS cabinets, two fitting rooms,
and the tubs below the Incu Collection women's rack), and six stock groups with placements.
Only Incu Collection, Ader Error and Patagonia are enabled initially.

The five update notes become six stock groups because Patagonia jackets and bags are separate
categories. Ader Error hats and jackets and Patagonia jackets and bags use the **Unspecified**
department pending confirmation. Their storage area does not imply a product department.
Shoe drawers and men's fits placements point at the overall area, not an invented cabinet or
room number. The shared tubs are represented as one location until individual tubs are identified.
History dates mark the starter import date, not the time of a physical stock movement.

Existing browser data is preserved. To replace an existing sample workspace, download its backup
first, select **Preview as → Owner**, then use **Settings → Export & recovery → Choose a Sprint 1 backup**
to import `public/starter-backup.json`. This file is also served at `/starter-backup.json`.
New browser workspaces receive these defaults automatically. No hosted stock records are seeded.
The prepared initial database schema and Firebase rules include Room, Wall, Tub and Area storage types.
