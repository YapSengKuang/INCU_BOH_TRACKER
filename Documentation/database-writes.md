# Database write checklist

Every interactive store write should validate locally, project the change immediately, close its form, and enter the shared background queue. Pending changes show **Saving…**; only a confirmed response shows **Saved**. A failed change loses its temporary projection, retains its submitted details, and offers retry or review. Confirmed data and unrelated pending changes are preserved. Retries retain their original request ID/revision; Firebase remains responsible for permissions and transaction validation.

| Operation | Entry point | Status |
| --- | --- | --- |
| Add existing brands to the store | Settings → Brands → Add to store | Implemented (commit 1) |
| Add first location to stock | Stock details → Add first location | Pending |
| Add another location to stock | Stock details → Also store here | Pending |
| Move stock | Stock details → Move | Pending |
| Correct a stock location | Stock details → Correct / remove | Pending |
| Remove a stock location | Location update → Remove | Pending |
| Create stock group | Find stock → Add stock group | Pending |
| Create storage location | Locations → Add location | Implemented; migrated to shared queue in commit 1 |
| Edit storage location | Locations → Edit | Pending |
| Delete storage location | Locations → Delete → Confirm | Pending |
| Create brand | Settings → Brands → Add brand | Pending |
| Rename or change availability of a brand | Settings → Brands → Manage | Pending |
| Create category | Settings → Categories → Add category | Pending |
| Edit category or availability | Settings → Categories → Manage | Pending |
| Create department | Settings → Departments → Add department | Pending |
| Edit department or availability | Settings → Departments → Manage | Pending |
| Invite staff | Settings → Staff → Invite staff | Pending |
| Revoke staff or cancel invitation | Settings → Staff → Remove access | Pending |
| Accept an invitation | Google sign-in → invitation claim | Pending; pending UI must never grant permissions |

## Other writes and reads

- Google sign-in is handled by Firebase Authentication. Authentication and editing privileges must never be fabricated optimistically.
- Owner bootstrap, initial seed and hosted backup recovery are administrative CLI transactions in `scripts/firebase-admin.ts`, with no interactive app UI to update. They report success only after commit; they are not executed by this work.
- Sample backup recovery replaces browser-local data, not Firestore. It remains isolated from production and must not run alongside pending writes.
- Search, filters, refresh, staff listing and backup export are reads; they do not need optimistic database writes.
- Internal uniqueness indexes, counters, private notes, membership indexes, immutable history and command receipts remain in the existing atomic transaction. Optimism projects the resulting public UI, never separate backend writes or private-note content into public history.
