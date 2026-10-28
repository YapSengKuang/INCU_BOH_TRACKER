# Sprint 2 — Catch up and print

Drafted 28 October 2026. Proposed scope for discussion; implementation has not started.

## Goal

A staff member starting a shift can see what changed over the last 3 or 7 calendar days, understand where the affected stock is now, and download or print a readable handover report.

This expands Sprint 2 in [the sprint roadmap](sprint-plan.md), covering B01 and B10 plus the relevant access, device and recovery checks under B12, B13 and B15.

## Starting point and carryover

Sprint 1 already provides search, placements, immutable movement history and current locations. The data model includes the store timezone and historical group/location labels, so the initial plan needs no new persisted report records.

The latest occupied-location deletion fix is local and uncommitted, according to the current working tree and the latest “Build sprint 1” chat. Review and include that fix in the release baseline: it confirms deletion, removes assignments with history, preserves other placements, and shows “No location saved” for groups with none left. Parent locations with children remain protected.

Carry these unfinished Sprint 1 checks into the release checklist: production Google sign-in and headers; second-account invitation and revocation; physical tablet/PC trial; verified real starting locations; a downloaded backup and safe recovery verification; a known working frontend rollback version. Development can proceed while these are arranged, but do not describe the combined release as verified until they are complete. Use isolated recovery data rather than replacing live store records for a test.

## Proposed work, in build order

| Item | Deliverable | Acceptance criteria |
|---|---|---|
| S2-01 — Reporting rules | One shared report calculation for screen, print and PDF | 3 days means today plus the previous 2 store-local dates; 7 days means today plus 6. Include local midnight at the start, exclude the next local midnight after today. Display exact dates and timezone. Today is partial, with an explicit generation timestamp. |
| S2-02 — Home-page handover | Summary beside the existing search, with 3-day/7-day controls and detailed history | Default to 3 days. Show event count and distinct stock groups affected, labelled separately. Include first placements, additional locations, moves, corrections and removals. Preserve access to full history. Loading, failure and no-change states are distinct. |
| S2-03 — Understandable movement details | A chronological sequence per affected stock group, plus its current locations | Retain every event; never replace repeated moves with only the final move. Show historical source/destination labels, time and public reason. Label additional placements “Also stored here”. Clearly distinguish historical event addresses from “Current locations as of [timestamp]”. List all current placements or “No location saved”. |
| S2-04 — Print and PDF | Report preview, browser print and direct PDF download | Proposed default: A4 portrait. Include store name, date range, timezone, generation time and page numbers. Wrap long names and addresses, repeat headings on subsequent pages, and hide app navigation. Screen preview and PDF contain the same report data. An empty report says no changes occurred in the selected period. |
| S2-05 — Verification and release | Tested preview, staff walkthrough and release notes | Verify date boundaries, permissions, report contents and multipage layout; rerun relevant Sprint 1 regression checks. Trial a real printout and the download on tablet/PC. Resolve carryover release checks and retain a rollback release. |

## Report behaviour

- Use a single confirmed data snapshot and a fixed generation timestamp for each preview/export. New changes must not alter half of an exported report; offer refresh to generate a newer one.
- Do not include optimistic or failed saves as completed movements. Clearly indicate when pending saves need to finish before they can appear in a report.
- Historical names and addresses come from the saved event. Renaming or deleting a location must not rewrite past movements.
- Current locations come from the same confirmed snapshot, even when they differ from the last event in the selected period. They are not presented as a reconstruction of locations at the period end.
- Public reports use only public stock and movement fields. Exclude account details and private staff notes. Existing public correction/removal reasons remain visible.
- Keep report scope store-wide initially; directory search filters should not silently restrict the handover report. Label the scope in the preview.
- Avoid saved report records or new settings unless implementation reveals a concrete need. If persisted fields are introduced, extend backup and recovery coverage in the same change.

## Proposed two-week allocation

Assuming one developer, using the roadmap's two-week baseline; this is a planning estimate, not a delivery commitment. No calendar start date is set.

- Days 1–2: settle report rules, review the release baseline, implement report calculations and boundary tests.
- Days 3–4: home-page summary, range controls and movement sequences.
- Days 5–7: preview, browser print and direct PDF export.
- Days 8–9: edge cases, access/regression checks, physical-device and print trial, carryover release checks.
- Day 10: fixes, release walkthrough, deployment verification and notes.

If capacity slips, reduce dashboard decoration first. Accurate reports, direct PDF download, privacy and verification remain part of the agreed Sprint 2 goal. Re-estimate rather than silently dropping them.

## Required verification scenarios

1. Events exactly at the start boundary and immediately before it; the next-day boundary; daylight-saving transitions in the configured store timezone; a browser in a different timezone.
2. One group moves A → B → C. Both moves remain visible, with C clearly identified as current.
3. A group has two placements and only one moves. The unaffected placement remains listed.
4. First placement, correction, removal, and deletion of an occupied location all appear with their proper meaning. A fully unassigned group shows “No location saved”.
5. Location or brand renaming does not change historical event labels. Deleted locations remain understandable in history.
6. No events, long brand names, long nested addresses, and enough events to span multiple printed pages.
7. New data arrives or a save is pending during export. The generated report stays internally consistent and excludes unconfirmed changes.
8. Guest and staff reports contain equivalent public data, without private notes or account details; existing search, movement saves and access controls still work.
9. A downloaded PDF opens successfully and matches the preview; a physical printout is readable.

## Demo and completion

Create a small sample set containing a repeated move, a split placement, a correction and a removal. As a guest, switch between 3 and 7 days, explain where each affected group is currently stored, then download and print the report. A staff member should be able to use that report for a handover without needing the developer to explain it.

Complete only when the demo works on the deployed site, required checks are recorded, and any unresolved release blockers are explicitly resolved. Maps, map PDFs, bulk stock moves, QR codes and scheduled report emails remain outside Sprint 2.
