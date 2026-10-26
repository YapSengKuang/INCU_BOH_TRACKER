# Stock finder website — project plan and to-do list

Updated 26 October 2026.

## What we're trying to fix

Stock moves around the store a lot, and retail assistants don't always read the BOH movement reports. This website gives everyone a quick way to check where stock is now.

BOH staff record a move once. The stock search, movement history, and map all use that same information.

## What the website needs to do

- Organise stock by **brand + category + department**, such as **GANNI → Knitwear → Women**.
- Show where stock is kept. We won't count how many items are there.
- Allow the same stock group to be kept in more than one place.
- Cover back rooms and storage on the sales floor, including drawers, cabinets, shelves, and racks.
- Let staff build the store map inside the website.
- Work well in a browser on tablets and PCs.
- Let anyone with the link view the published map, stock locations, movement summaries, and public history. No login or access code needed.
- Let invited staff sign in to make changes. Keep account details and private staff information out of the public view.
- Show a stock search, recent changes, and movement history on the home page.
- Let people print or download movement summaries for the past 3 or 7 days.
- Let people download a map PDF with labels showing what's stored in each section.
- Use a free online database and leave room to add more stores later.
- Start with a list of brands from Incu's website, so staff don't have to type them all in.

A **stock group** means one combination of brand, category, and department. For example, GANNI women's knitwear is one group, and GANNI women's dresses is another.

## Starting ideas we can adjust

- Start with one store, but keep each store's information separate from the beginning so adding others later is easier.
- Only invited staff can edit. Creating an account by itself won't give someone editing access.
- Signed-in editors can update stock locations and work on the map. The store owner manages invitations and store settings.
- “Past 3 days” means today and the previous 2 days. “Past 7 days” means today and the previous 6 days. Show the dates and use the store's timezone.
- Make the map a clear guide to the store. It doesn't need to be an exact architectural drawing.

## Where to host it and save the data

I recommend **Cloudflare Pages** to host the website and **Supabase Free** to save the data and handle staff logins.

Anyone with the link can read the published store information. Only invited staff can save changes. Unfinished maps, account details, and private staff information stay behind the login.

The website can create PDFs in the browser, so we don't need a paid PDF service or have to save every generated PDF online.

Free plans have usage limits. Supabase Free projects can pause after a week without activity, so we'll check usage and make sure we can export and recover the data before launch. A custom website address is optional and may cost money.

Vercel's free Hobby plan is for personal, non-commercial use, so it isn't the right free plan for this workplace website.

Sources checked 26 October 2026: [Supabase pricing](https://supabase.com/pricing), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## Pages on the website

1. **Home:** Search for stock, see recent changes, switch between 3 and 7 days, and print a summary. Signed-in staff also get a “Record a move” button. Add a store picker when more stores are supported.
2. **Find stock:** Search or filter by brand, category, or department. See every place the stock is kept and find it on the map.
3. **Store map:** Pick a cabinet, drawer unit, shelf, or rack to see what's inside. Download the labelled map as a PDF.
4. **Record a move:** Pick the stock group, where it's coming from, where it's going, and add a note if needed. Save once to update the locations, map contents, and history.
5. **Build the map:** Draw the layout, add storage, set up drawers and shelves, then preview and publish it.
6. **Settings:** Manage brands, categories, and staff invitations. Choose which brands are used in this store.

## How the map builder works

Start with a grid. Staff can draw the room outline and basic walls, add text, and place blocks for cabinets, drawers, shelves, and racks.

Using a mouse or touch, staff can move, resize, rotate, rename, copy, and delete those blocks. Include simple position and size controls too, so people don't have to get everything right by dragging.

Give each storage unit a fixed code, such as **C03**. Add drawers and shelves inside it, so a stock location can read:

> Sales floor → Cabinet C03 → Drawer D02

Clicking the cabinet opens its drawers and their contents. We don't need to draw every drawer separately on the floor map.

Staff can save unfinished changes and publish them when ready. Guests see the published map. Moving a cabinet on the drawing only changes where it appears on the map; its stock stays linked to it. Recording a stock move is a separate action.

If a location still has stock linked to it, ask staff to move or remove those links before deleting it. Keep the old location names in past movement records so the history still makes sense after renaming things.

The PDF uses the published map and the stock locations saved when someone downloads it. It includes storage codes, contents labels, and the date and time it was made. Where labels won't fit, use numbers that match a contents list beside or below the map. Include drawer and shelf details in that list.

Plan for A4 and A3 landscape printing with a preview. If the contents list is long, add pages so the text stays readable.

## To-do list and user stories

**First release** means we need it for launch. **Next** means a useful improvement after launch. **Later** means something for future growth.

The last column explains how we'll know each feature is ready.

| ID | When | User story | Ready when… |
|---|---|---|---|
| B01 | First release | As a guest, I want to see recent stock moves on the home page so I can catch up quickly. | I can open the link without signing in, choose 3 or 7 days, and see the dates and newest moves first. I can't change anything. |
| B02 | First release | As a retail assistant, I want to search for stock so I can find where it's kept. | I can search by brand, category, or department and see all current locations, including the exact drawer or shelf. If no location is saved, the site says that rather than saying the stock is sold out. |
| B03 | First release | As a retail assistant, I want to see my search result on the map so I know where to go. | The right storage unit is highlighted, and its details tell me which drawer or shelf to check. |
| B04 | First release | As a staff member, I want to build a map in the website so it matches our store. | I can add the room outline, walls, text, and storage blocks, then move, resize, rotate, rename, copy, and save them on a tablet or PC. |
| B05 | First release | As a staff member, I want to add drawers and shelves inside storage units so locations are easy to follow. | Each location has a clear name and a unique code within the store. I can link stock to a particular drawer or shelf. |
| B06 | First release | As a staff member, I want to preview map changes before sharing them so guests see a finished layout. | My unfinished work is saved, guests see the published map, and publishing keeps the stock linked to the right locations. |
| B07 | First release | As a BOH staff member, I want to add stock to locations so everyone knows where to find it. | Each stock group has a brand, category, and department. A location can hold several groups, and a group can be in several places. The first placement is recorded without asking for quantities. |
| B08 | First release | As a BOH staff member, I want to record a move or an extra storage spot so locations stay up to date. | “Move from this location” removes the selected old location and adds the new one. “Also store here” keeps the old location and adds another. Other locations stay linked. One save updates both locations and history, without duplicates or quantity fields. |
| B09 | First release | As a BOH staff member, I want to fix a wrong location so people aren't sent to the wrong place. | I can correct or remove a stock link and give a reason. Current locations update, and the original record and correction remain in the history. |
| B10 | First release | As a shift leader, I want to print a 3-day or 7-day movement summary so I can use it at handover. | I can preview, print, or download a PDF showing the date range, when it was made, old and new locations, and where stock is now. Stock that moved several times is still easy to follow. |
| B11 | First release | As a retail assistant, I want a labelled map PDF so I can use a printed copy. | The PDF shows the published map and current contents, with readable labels and a drawer/shelf contents list. Nothing is cut off. |
| B12 | First release | As a store owner, I want guests to view and invited staff to edit so the right people can make changes. | Anyone with the link can read published information. Only invited staff can save changes, even if someone tries to bypass the buttons. Private account details and staff-only notes aren't public. |
| B13 | First release | As a staff member, I want to know whether my changes saved so I don't lose work. | A failed save keeps what I entered. Retrying doesn't create duplicate moves. If someone else changed the same information, I'm asked to review it before saving over their work. |
| B14 | First release | As a staff member, I want a ready-made brand list so setup is quicker. | Incu's list is loaded without duplicate entries, with its source and date. I can choose the brands our store uses, add missing brands, and stop using old ones. |
| B15 | First release | As a store owner, I want to download a copy of our data so we can recover it if needed. | The download includes brands, categories, maps, stock locations, and movements. We've checked that sample data can be restored from it. |
| B16 | Next | As a BOH staff member, I want to move several stock groups at once so reorganising a cabinet is quicker. | I can check the groups before saving. They all update together, and each group keeps its own movement history. |
| B17 | Next | As a retail assistant, I want to report a wrong location so BOH can check it. | I can flag the stock and location, and BOH can review it and mark it sorted. |
| B18 | Next | As a staff member, I want to reuse cabinet layouts and undo map changes so setup takes less time. | I can copy a cabinet with its drawers, get new location codes, and undo changes I haven't saved yet. |
| B19 | Next | As a retail assistant, I want to scan a storage QR code so I can quickly see what's there. | Scanning opens the right cabinet, drawer, or shelf and its contents. Guests can view it without signing in. |
| B20 | Later | As a store owner, I want to add more stores and floors so the website can grow with us. | Each store has its own maps, stock locations, reports, and staff access. Editing access for one store doesn't give access to change another. |
| B21 | Later | As a store owner, I want to review updates to the brand list so it stays useful. | I can check proposed changes before applying them. A brand disappearing from Incu's website doesn't remove our saved stock locations. |

## What we need to save

- **Stores and staff access:** Which store someone can edit, their role, and the store's timezone.
- **Brands:** Names, other names people might search for, source links, listed departments, and when the list was collected. Each store chooses which brands it uses.
- **Categories and departments:** Editable options such as Knitwear, Footwear, Women, and Men.
- **Stock groups:** Brand + category + department. Avoid creating the same combination twice in one store.
- **Maps:** Saved drafts and published versions for each store and floor.
- **Storage locations:** Cabinets, drawers, shelves, their codes, and where they appear on the map.
- **Current stock locations:** Which stock groups are kept in which places, without duplicate links.
- **Movement history:** Where stock moved from and to, when the move happened, when it was entered, who entered it, whether the old location was kept, any notes, and any later corrections. Keep old location names in past records and control which notes guests can see.

Saving a move must update the locations and history together. If either part fails, neither should be saved. Every printed map should show when it was made, since stock may move after printing.

## Build plan

Use **four two-week sprints**, with a working release at the end of each one. Allow roughly **eight weeks for one experienced developer working consistently**, then adjust after the first sprint based on actual progress.

| Sprint | What staff can use at the end |
|---|---|
| 1 — Find and update stock | Public stock search, invited staff editing, named drawers/shelves, moves, corrections, and basic history. |
| 2 — Catch up and print | Home-page summaries, 3-day and 7-day filters, printable handover reports, and movement PDF downloads. |
| 3 — Build and use the map | A store map staff can create, preview, and publish, with current contents and search highlights. |
| 4 — Print the map | A4/A3 map PDFs with automatic labels, drawer/shelf contents lists, and final improvements from staff feedback. |

See [the sprint plan](sprint-plan.md) for each sprint's work, backlog references, demo, and release checks.

Each release includes checks on tablet and PC, public viewing and staff editing, saved data, and the features already released. Data export/recovery and staff trials start in Sprint 1 and grow with the website. Check real starting locations before staff rely on them.

## Things to check before launch

Try searches, stock in several places, repeated moves, corrections, first placements, and deleting locations that still hold stock. Check what happens when a save fails or two people edit the same thing. Make sure the 3-day and 7-day dates work properly around midnight.

Check that guests can read published information but can't save changes or access private data. Try the map with both touch and a mouse. Print A4 and A3 examples with long names and lots of drawer contents. Test downloading the data and restoring a sample.

Suggested goals for the staff trial:

- At least 90% of checked stock locations match what's physically there.
- A normal stock lookup takes less than 15 seconds.
- A normal movement entry takes less than 30 seconds.
- Staff can add a cabinet with drawers and print a report without help.

We can adjust these goals after watching staff use the first version.

## Starter brand list

The files saved alongside this plan contain **89 men's brand listings and 100 women's brand listings**, combined into **140 unique brand entries**. Repeated entries from the desktop and mobile page layouts have been removed.

The list shows brands listed on Incu's website, not confirmed stock in your store. Staff choose which brands to use before adding their locations. The men/women labels come from the website directories.

Sources: [Men's brands](https://www.incu.com/pages/brands-men) and [Women's brands](https://www.incu.com/pages/brands-women). Collected 26 October 2026.

## Small details to settle later

Brand + category + department, public viewing, and location tracking without quantities are confirmed.

Before building the date filters and print layouts, confirm the store's timezone and preferred paper size. We can also agree on a target launch date when development is scheduled.
