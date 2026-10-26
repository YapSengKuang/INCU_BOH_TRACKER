# Stock finder — design document

Updated 26 October 2026. This describes the implemented Sprint 1 UI and the visual direction supplied by the owner. Delivery scope remains in the project and sprint plans.

## Purpose

Help retail assistants find stock and let invited BOH staff maintain its locations. Prioritise search, complete location addresses and clear update actions. Use direct headings and instructions. Avoid slogans, promotional text, decorative statistics and release/version labels in the working UI.

## Colours

The owner supplied this palette:

| Colour | Hex | UI use |
| --- | --- | --- |
| Atomic Tangerine | `#FF6B35` | Active navigation marker, selection marker, keyboard focus, error accent |
| Peach Glow | `#F7C59F` | Sample-mode banner; pale notice surfaces |
| Beige | `#EFEFD0` | Page background foundation and selected-group surfaces |
| Steel Azure | `#004E89` | Navigation background, primary buttons, links and location text |
| Baltic Blue | `#1A659E` | Navigation selection, hover states, focus and information accents |

Use white panels and restrained neutral text/borders to keep the interface readable. The canvas is a 40% beige / 60% white mix; lighter blue and peach surfaces are derived from the supplied colours. The CSS variables in `src/styles.css` are the source of truth.

White text on Steel Azure has 8.57:1 contrast; white on Baltic Blue has 6.18:1 contrast. Orange is an accent, not a background for small white text (that pairing is 2.84:1). Navy text on peach is 8.24:1. Do not depend on colour alone to communicate state: retain labels, icons, selected markers and visible focus.

## Typography

Use **Geist** throughout, including headings, forms, tables and navigation. The supplied `Geist.zip` contains the variable TrueType font, copied unchanged to `public/fonts/Geist-Variable.ttf`. Include its SIL Open Font License at `public/fonts/OFL.txt`.

Serve the font from the app's origin, preload it and use `font-display: swap`. System Arial/sans-serif is the fallback. No Google Fonts request is needed.

- Desktop page heading: 30 px, weight 600.
- Mobile page heading: 26 px, weight 600.
- Main text: 14–15 px.
- Stock-group names: 15 px, weight 600.
- Navigation and form controls: 13–14 px.
- Metadata: 11–12 px minimum.
- Use sentence case and normal tracking. Avoid tiny uppercase labels.

## Navigation and pages

The persistent left menu has **Find stock**, **Locations**, **History**, and **Settings**. Settings appears for staff; owner-only sections remain inside Settings. Highlight the current page and expose its name to assistive technology.

The top-bar toggle collapses the desktop menu to an icon rail and expands it again. Rail icons retain accessible names and hover titles. On narrow screens, expanded navigation shows labelled buttons in two columns; collapsing it hides those buttons while keeping the toggle available. Navigation returns the page to the top.

Page headings are **Find stock**, **Locations**, **Movement history**, and **Settings**. The top bar shows the store name and current access level. There is no promotional intro, sidebar slogan, dashboard-statistics strip or marketing footer.

### Find stock

Order content as: page heading and staff **Add stock group** action; search; brand/category/department/area filters; result count; stock list.

Each row shows the brand, category and department together, followed by **every current full location**. Assistants can find an exact drawer without opening another screen. An unplaced group says **No location saved**, not out of stock. Search and filters work together; changing filters clears the previous detail selection.

Open a row for **Stock details**, current locations, staff update actions and recent changes. Details sit beside the list on larger screens. On screens up to 1100 px, they appear above the list and receive focus/scroll when selected. Closing details restores focus to the selected row.

### Locations

Group storage units by area. Show each unit's code and type, then its child drawers/shelves and stored stock groups. Counts represent distinct groups within the unit and its children. Staff see Add location, Edit and Delete actions. Occupied locations cannot be deleted; explain the required action when a save is rejected.

### Movement history

Show newest changes first with the stock group, movement type, source, destination, public reason and store-local date/time. Distinguish added storage from a move. Keep private staff notes out of the public view. Summary date filters and PDFs remain planned for Sprint 2.

### Settings

Use explicit sections: Brands, Categories, Departments, Staff, and Export & recovery. Only owners see Staff and Export & recovery. Keep the provenance and date of imported brand data available. Enabling/disabling options must preserve existing stock and history.

## Editing workflows

Create a group using three required fields: Brand, Category, Department. A successful save selects the new group and opens its details with **Add first location** ready. Clear any previous filters so the new group is visible.

For location changes, keep Action and Destination/Source fields visible. Place optional public/private notes behind a **Notes (optional)** disclosure. Correction/removal reasons stay visible and required. Saving an update keeps other storage locations intact and records history atomically.

Forms retain input on failure, disable repeated saves while busy, and require review after a competing edit. Put the result or error near the action. Use concise success text: **Changes saved.** Do not expose transaction/implementation commentary during ordinary entry.

## Access and saved data

Guests can search, browse locations and read history. Invited editors maintain stock and setup options. Owners manage invitations and download complete backups. UI visibility is supported by database checks; hiding a button is not access control.

The sample workspace has a peach **Sample data** banner and a **View as** picker. It is isolated browser data. Connected mode removes that picker and uses real authentication and database membership.

Connected mode uses Firebase Firestore Standard and Google sign-in. The data model, atomic transaction/rules protocol and administrator recovery procedure are documented in the [setup guide](setup-and-deployment.md). Private staff data is separate from public stock/history documents.

## Responsive and keyboard behaviour

Use fluid widths, wrapped filters and stacked stock rows on phones. Target 40–46 px controls, with 44 px form inputs. Keep labels visible in expanded mobile navigation. Dialogs stay within the viewport and scroll when necessary. Preserve native input behaviour, Escape-to-close dialogs, focus restoration and visible keyboard focus. Respect reduced-motion preferences.

## Verification and remaining work

Run the production build and existing database/domain tests. Browser-check search, filtering, all locations in a row, selecting/closing details, new-group-to-first-placement, optional notes, history, settings, and collapsed navigation at desktop and mobile widths. Check for horizontal overflow and confirm the local font asset is served.

Hosted Google Auth, Firestore rules, physical-device staff trials, deployment and production recovery require release verification. The owner has now requested connection to their existing Firebase project.

Future map and report screens should reuse these colours, font, direct headings and task-first layout. Map drafts/publication and print output are later-sprint work.
