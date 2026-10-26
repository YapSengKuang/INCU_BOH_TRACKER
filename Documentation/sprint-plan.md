# Stock finder — sprint plan

Updated 26 October 2026.

## How we'll work

Use **four two-week sprints** as a starting point: roughly eight weeks for one experienced developer working consistently. Adjust after Sprint 1 once we know the actual pace. Each sprint ends with a working website that can be deployed and used, with the previous features still working.

Start each sprint by picking the stories, build and check them during the sprint, then deploy, show staff, and use their feedback to choose the next work. Leave time inside each sprint for fixes and deployment. Avoid adding new features halfway through unless they are needed to make that sprint's release work.

Deploy to a preview link while building. At the end of each sprint, release the finished features to the main website and try them in one small, verified store area. Use clearly labelled sample data on the preview site and keep it separate from live store records.

The first version works as a searchable location list. The map comes later and uses the same locations and stock records, so nothing needs to be entered again.

## Releases at a glance

| Sprint | Main goal | What staff can use at the end |
|---|---|---|
| 1 — Find and update stock | Get a useful stock finder live | Search for stock, see its locations, and let invited BOH staff keep them up to date. |
| 2 — Catch up and print | Make shift handovers easier | See 3-day and 7-day movement summaries and download or print them. |
| 3 — Build and use the map | Make locations visual | Create and publish a store layout, show its contents, and highlight search results on it. |
| 4 — Print the map | Finish the printable store guide | Download an automatically labelled map PDF and a readable drawer/shelf contents list. |

## Sprint 1 — Find and update stock

**Goal:** An assistant can find a stock location, and BOH can update it without a developer's help.

### Work to include

- Set up the website, database, preview site, and live deployment.
- Set up public viewing, invited staff logins, and owner-managed invitations.
- Load the Incu brand list. Let staff choose store brands and manage brands, categories, and departments.
- Create stock groups using brand + category + department.
- Let staff add locations using a simple form: area, cabinet/rack/shelf code, and any drawers or shelves inside it. This works before the map exists.
- Link stock groups to one or more locations.
- Add search and filters, showing the full location such as Sales floor → C03 → Drawer D02.
- Add “Move from this location” and “Also store here”. Keep other locations intact and avoid duplicate links.
- Add a basic correction/removal action with a reason and a simple dated movement history. Record first placements too.
- Handle failed saves, repeat clicks, and two people changing the same record. Save location changes and history together.
- Add an owner-only download of all data introduced so far, and check that a sample can be recovered.

**Backlog:** B02, B05 (location setup), B07, B08, B09, B12, B13, B14; first part of B01 (basic history) and B15 (export/recovery).

### Demo

1. A staff member signs in and creates GANNI → Knitwear → Women.
2. They place it in Cabinet C03 → Drawer D02.
3. An assistant opens the public link and finds it.
4. BOH adds a second location, then moves stock out of just one of those locations.
5. The assistant refreshes and sees the correct locations. The history shows what happened.

### Ready to deploy when

- An invited staff member can complete the demo on a tablet and PC.
- Guests can search and read history, but can't change data or see private account details.
- Corrections, repeated clicks, failed saves, and competing edits leave consistent records.
- A location with stock linked to it can't be deleted until those links are moved or removed.
- The previous release can be restored if the deployment goes wrong; sample data recovery has been checked.
- A small set of real starting locations has been checked in person before staff use them.

**Usable release:** A searchable stock finder with working updates and history. Map and PDF controls appear when those features are available.

## Sprint 2 — Catch up and print

**Goal:** Staff can quickly see what's changed and print a useful handover summary.

### Work to include

- Put a movement summary and history on the home page alongside search.
- Add 3-day and 7-day filters with exact start and end dates.
- Use the store's timezone: today plus the previous 2 or 6 calendar days.
- Show old and new locations and clearly mark where stock is now.
- Make repeated moves and corrections easy to follow. Explain “also stored here” clearly when stock is split across locations.
- Add a print preview, browser printing, and a direct PDF download for movement summaries.
- Show when each report was made and a clear message when there were no moves.
- Keep reports public while leaving private staff details and staff-only notes out.
- Extend export/recovery if any new settings or saved data are added.

**Backlog:** Finish B01; deliver B10; continue B12, B13, and B15 for the new features.

### Demo

1. Record several moves, including moving the same group twice and adding an extra location.
2. Open the public home page and switch between 3 and 7 days.
3. Download a PDF and print it for a shift handover.
4. Check that someone reading it can tell what changed and where the stock is now.

### Ready to deploy when

- Reports include the right dates, including movements near midnight.
- Repeated moves, corrections, and split locations are understandable and accurate.
- An empty period displays and prints properly.
- A real printout is readable with long names and several pages of movements.
- Sprint 1's search, updates, permissions, and history still work.

**Usable release:** The stock finder plus printable movement reports. Staff can start using this for handovers before the map is built.

## Sprint 3 — Build and use the map

**Goal:** Staff can draw the store layout and assistants can use it to find stock.

### Work to include

- Add a grid, room outline, basic walls, and text labels.
- Add blocks for cabinets, drawer units, shelves, and racks.
- Let staff move, resize, rotate, rename, copy, and delete blocks using mouse or touch. Include position and size fields as another way to make adjustments.
- Link blocks to the existing locations from Sprint 1. Keep existing stock links and movement records.
- Let staff create new storage locations through the map too, using the same location records.
- Show drawers, shelves, and their contents when someone selects a storage unit.
- Save unfinished layouts as drafts, then preview and publish. Guests only see the published layout.
- Highlight matching storage units when someone searches for stock; show the exact drawer or shelf in the details.
- Keep a working location-list view for locations that haven't been placed on the map yet.
- Prevent publishing broken location links. Moving a block on the drawing must keep its contents attached.
- Include map drafts and published versions in the owner's export and sample recovery check.

**Backlog:** B03, B04, finish B05, B06; extend B12, B13, and B15 to maps.

### Demo

1. Open the builder and draw a small sales-floor and back-room area.
2. Add Cabinet C03 to the drawing by choosing the existing location.
3. Save a draft and confirm guests still see the published version.
4. Publish, then search for GANNI knitwear as a guest.
5. See C03 highlighted, open its details, and find Drawer D02.
6. Record a stock move and confirm the map contents change without editing the drawing.

### Ready to deploy when

- A staff member can create and publish a small realistic layout on tablet and PC.
- Drafts stay private, and failed or competing saves don't silently overwrite work.
- Map changes preserve stock links and readable past movement records.
- Copying a storage block gives it a new code and doesn't accidentally copy stock assignments.
- Stock remains searchable even if its location has no position on the map yet.
- Public search, movement recording, and handover reports still work.

**Usable release:** The stock finder and reports, now with a staff-built interactive map.

## Sprint 4 — Print the map

**Goal:** Staff can print a current store map with useful stock labels.

### Work to include

- Add direct map PDF download and print preview.
- Generate labels from current stock locations, showing brand, category, and department where space allows.
- Use storage codes and a matching contents list when full labels won't fit.
- Include drawer and shelf details in the contents list, with extra pages when needed.
- Support A4 and A3 landscape printing. Confirm which should be the default before building the layout.
- Include the store name, published map version, and date/time the PDF was made.
- Keep the map and contents list consistent by using one saved set of locations for each export, even if someone records a move during generation.
- List any stock locations not yet placed on the map, so they aren't silently omitted.
- Try the complete workflow with staff, fix issues found during the trial, and update the short staff guide.
- Check export/recovery for all released data and review free-plan usage.

**Backlog:** B11; finish B15; final checks across B01–B15.

### Demo

1. Record a stock move and download the map PDF without manually changing its labels.
2. Confirm the new location appears in the correct cabinet/drawer entry.
3. Print A4 and A3 versions containing long brand names and busy cabinets.
4. Ask an assistant to find stock using the printed map and contents list.

### Ready to deploy when

- Map labels and the contents list match the saved locations used for that export.
- Long names and crowded sections stay readable; nothing is cut off.
- The PDF clearly shows when it was made and includes unmapped locations in a separate list.
- An owner can export all store data and recover a sample, including the map.
- Earlier search, movement, report, map, and access checks still pass.
- A staff trial meets the agreed targets, or any remaining problems are fixed before wider rollout.

**Usable release:** The full first version: stock finder, movements, printable summaries, map builder, and labelled map PDF.

## What “done” means in every sprint

A feature is ready when it works from start to finish on the deployed website, uses saved data, and works on tablet and PC. Check public viewing and staff editing, plus any errors or awkward cases introduced by that feature. Earlier features must still work.

Deploy any database changes in a way that keeps existing records working. Take a data export before changes that could affect saved records, and have a clear way to return to the previous working website. Check the main website after deployment and leave a short note explaining what's new.

Export/recovery and staff feedback start in Sprint 1 and grow with the website. They aren't work saved for the final sprint.

## If a sprint is too full

Keep the sprint goal small enough to finish, check, and deploy. Don't squeeze out access checks, correct location updates, or save handling to fit more features.

If Sprint 1 is too large, split it into two releases: **a maintained stock directory** with staff setup, adding/removing location links, basic history/corrections, public search, permissions, and data recovery; then **guided movement recording** with the two movement actions. Each release must still let BOH keep the displayed locations accurate.

If the map builder needs more time, first release a simple rectangular layout with typed position/size controls, existing locations, drawer details, draft/publish, and a public map view. Add wall tools, rotation, copying, and touch dragging in the next deployable sprint. Move the map PDF sprint back rather than dropping those agreed features.

Treat the eight-week plan as a starting estimate. Replan after each release using actual progress and staff feedback.

## After the first version

Choose these based on what staff need most:

- Move several stock groups together — B16.
- Report incorrect locations — B17.
- Reuse cabinet layouts and undo map changes — B18.
- Open storage contents using QR codes — B19.
- Support more stores and floors — B20.
- Review fresh brand-list imports — B21.
