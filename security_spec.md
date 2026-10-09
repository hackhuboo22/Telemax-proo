# Security Specification - TeleRelay Fortress

## Data Invariants
1. A `RelayItem` must have a valid `status` and `relayedAt` timestamp.
2. Only authenticated admins can read/write global `settings` and `deduplication` records.
3. `userSecrets` are strictly isolated: a user can only read/write their own secret document.
4. `relayHistory` can be read by authenticated users but only written by the system (service account or designated admin).

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to write a `userSecret` with a different `userId` than the authenticated user.
2. **State Shortcutting**: Attempt to update a `RelayItem` status from `failed` to `completed` without system authority.
3. **Resource Poisoning**: Attempt to inject a 1MB string into a `DeduplicationEntry` ID.
4. **PII Leak**: Attempt to read all `userSecrets` as a standard user.
5. **Ghost Field**: Attempt to add `isAdmin: true` to a user profile or setting document.
6. **Immutable Violation**: Attempt to change the `relayedAt` timestamp of an existing `RelayItem`.
7. **Orphaned Record**: Attempt to create a `RelayItem` with a future timestamp.
8. **Bulk Scrape**: Attempt to list all `relayHistory` without any filters as an unauthenticated user.
9. **Admin Spoof**: Attempt to write to `settings` by claiming to be an admin in the payload.
10. **Shadow Update**: Attempt to update `hashedPin` for another user.
11. **Type Poisoning**: Sending a number instead of a string for a `RelayItem` title.
12. **Null Bypass**: Attempt to create a `RelayItem` with missing required fields.

## Test Runner Plan
I will verify that these payloads return `PERMISSION_DENIED` in the rules.
