# Movement reports

From Home, select 3 or 7 days and choose **Preview report**. The preview offers browser printing, direct PDF download and refresh.

The homepage and exports share `createMovementReport`. The period includes today and the preceding 2 or 6 calendar dates in the store timezone, through generation time. Reports use confirmed public data, keep the brand-first ordering and exclude location removals. Later moves supersede earlier destinations; additional location links remain listed. Public movement notes are included in the report; staff records and private notes are not part of the report model.

Opening the preview fixes its data and generation time. Refresh explicitly creates a new report. Printing and PDF download use that fixed report. No records are written to Firebase. PDF generation runs in the browser, loading its libraries on demand and embedding the bundled Geist font.

The A4 PDF repeats report metadata and table headings on every page, wraps long text, and numbers its pages. Browser printing hides application navigation and preview controls, repeats table headings and uses A4 portrait styling; printer/browser settings can override print styling.

Validation: `npm test` (73 tests) and `npm run build` pass. Coverage includes repeated move chains and return trips, out-of-order history, independently changing split links, the 3/7-day cutoff, and empty reports for no events, old events, removals only and arrivals later removed. Preview, browser printing and direct PDF share the same report content/data.

A 75-row fixture with long names, nested destinations and Unicode characters was checked on 28 October 2026:

- The direct PDF has nine pages, each with repeated metadata/table headings and correct page numbering. Extracted text contains all 75 brands exactly once. Its first and last pages were rendered and visually checked.
- Chrome's native print preview has eleven pages with repeated table headings, all 75 rows in order, and no application navigation or report controls. Different page counts are expected because browser printing and PDF generation use separate layout engines.
- The empty HTML preview displays an explicit empty state, and the empty PDF is one readable page.
- The browser print copy is outside the modal dialog to allow normal page flow; screen and print use the same content component. Print isolation applies only while a report is open, so ordinary app printing does not become blank.

Physical printing and tablet hardware remain manual release checks. To regenerate temporary verification files, set `REPORT_QA_DIR` when running `npm test`. Setting `REPORT_BROWSER_QA_DIR` also writes standalone HTML fixtures for a temporary local browser check; keep these files out of commits and remove them before building a release.
