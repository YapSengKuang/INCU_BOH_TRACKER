# Incu stock finder — Sprint 1

A React + TypeScript stock directory for tablet and PC, with a Supabase backend prepared for connection. The repository starts in an **isolated sample workspace**, as requested. No hosted database has been created or changed, and no site has been deployed.

## Run locally

Requires Node 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. With all environment variables unset, example records are saved in this browser's local storage. The **Preview as** picker lets you exercise guest, staff editor and owner screens. This picker exists only in sample mode; it is not production authentication. Browser sample data is not shared across devices. Editing uses Web Locks and requires localhost or HTTPS in a current browser.

```sh
npm test
npm run build
```

Tests cover the sample reducer and the actual SQL migration on embedded Postgres via PGlite, including database roles, permissions, transaction rollback, competing revisions and recovery. No Supabase account or Docker is needed for these tests.

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
