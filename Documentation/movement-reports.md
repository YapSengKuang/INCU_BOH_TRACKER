# Movement reports

From Home, select 3 or 7 days and choose **Preview report**. The preview offers browser printing, direct PDF download and refresh.

The homepage and exports share `createMovementReport`. The period includes today and the preceding 2 or 6 calendar dates in the store timezone, through generation time. Reports use confirmed public data, keep the brand-first ordering and exclude location removals. Later moves supersede earlier destinations; additional location links remain listed. Public movement notes are included in the report; staff records and private notes are not part of the report model.

Opening the preview fixes its data and generation time. Refresh explicitly creates a new report. Printing and PDF download use that fixed report. No records are written to Firebase. PDF generation runs in the browser, loading its libraries on demand and embedding the bundled Geist font.

The A4 PDF repeats report metadata and table headings on every page, wraps long text, and numbers its pages. Browser printing hides application navigation and preview controls, repeats table headings and uses A4 portrait styling; printer/browser settings can override print styling.

Validation: `npm test` (64 tests) and `npm run build` pass. Tests cover fixed report contents, timezone boundaries, removals and multi-page PDF generation. A seven-page fixture with long names, nested destinations and Unicode characters was rendered and visually checked. The local browser preview and download action were exercised. Physical printing and tablet hardware remain manual release checks.
