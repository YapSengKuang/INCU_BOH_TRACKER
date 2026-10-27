# Database write checklist

Every interactive store-data write should validate locally, project the change immediately, close its form, and enter the shared background queue. Pending changes show **Saving…**; only a confirmed response shows **Saved**. A failed change loses its temporary projection, retains its submitted details, and offers retry or review. Confirmed data and unrelated pending changes are preserved. Retries retain their original request ID/revision; Firebase remains responsible for permissions and transaction validation.

| Operation | Entry point | Status |
| --- | --- | --- |
| Add existing brands to the store | Settings → Brands → Add to store | Implemented (commit 1: `9c633d8`) |
| Add first location to stock | Stock details → Add first location | Implemented (commit 2: `a6ed472`) |
| Add another location to stock | Stock details → Also store here | Implemented (commit 3: `8eaaf50`) |
| Move stock | Stock details → Move | Implemented (commit 4: `e9d91d0`) |
| Correct a stock location | Stock details → Correct / remove | Implemented (commit 5: `061bc01`) |
| Remove a stock location | Location update → Remove | Implemented (commit 6: `2b17743`) |
| Create stock group | Find stock → Add stock group | Implemented (commit 7: `8676d5e`) |
| Create storage location | Locations → Add location | Implemented in `587884a`; migrated to shared queue in `9c633d8` |
| Edit storage location | Locations → Edit | Implemented (commit 8: `0df0e59`) |
| Delete storage location | Locations → Delete → Confirm | Implemented (commit 9: `dfed529`) |
| Create brand | Settings → Brands → Add brand | Implemented (commit 10: `4f8f239`) |
| Rename or change availability of a brand | Settings → Brands → Manage | Implemented (commit 11: `4a4551d`) |
| Create category | Settings → Categories → Add category | Implemented (commit 12: `1c5a9e2`) |
| Edit category or availability | Settings → Categories → Manage | Implemented (commit 13: `29b98cb`) |
| Create department | Settings → Departments → Add department | Implemented (commit 14: `a8f1514`) |
| Edit department or availability | Settings → Departments → Manage | Implemented (commit 15: `454f271`) |
| Invite staff | Settings → Staff → Invite staff | Implemented (commit 16: `81ff32e`) |
| Revoke staff or cancel invitation | Settings → Staff → Remove access | Implemented (commit 17: `aafbe30`) |
| Accept an invitation | Google sign-in → invitation claim | Excluded by request; existing confirmed auth flow |

## Other writes and reads

- Google sign-in and invitation acceptance are excluded from this rollout by request. Their existing confirmed authentication flow is preserved; authentication and editing privileges are never fabricated optimistically.
- Owner bootstrap, initial seed and hosted backup recovery are administrative CLI transactions in `scripts/firebase-admin.ts`, with no interactive app UI to update. They report success only after commit; they are not executed by this work.
- Sample backup recovery replaces browser-local data, not Firestore. It remains isolated from production; recovery is disabled while pending writes or retained failed drafts exist.
- Search, filters, refresh, staff listing and backup export are reads; they do not need optimistic database writes.
- Internal uniqueness indexes, counters, private notes, membership indexes, immutable history and command receipts remain in the existing atomic transaction. Optimism projects the resulting public UI, never separate backend writes or private-note content into public history.

## Verification

Each operation was committed separately after its focused projection/queue tests passed. The shared queue validates relationships, serialises writes against the latest revision, compares edited records against their captured values, and isolates account changes. A retry uses exactly the original request and revision, so a lost response cannot duplicate a committed write or silently overwrite newer data. Optimistic movement times are provisional until Firebase returns the server timestamp. Private notes are never added to public projections. No production data, rules or authentication configuration are changed by this rollout.

Final checks: production build passes; 37 application/projection/queue tests and 10 Firestore emulator transaction/security tests pass. Browser checks used a separate sample store with deliberately delayed requests, including brands, stock placements, categories and staff invitations.
