# Request ID conflicts and recovery

Command/upload/migration idempotency hashes now use the versioned `c1:` canonical JSON format: object keys are sorted recursively, arrays retain order. Exact-revision readback uses the same JSON comparison. Pending commands are detached from mutable form objects before the first write. Actor checks and changed-payload rejection remain mandatory.

Existing journal rows are not rewritten. Unversioned hashes still require the original exact hash. An old mismatch remains blocked because the original payload cannot safely be reconstructed from the hash alone. Do not delete journal entries, replace request IDs, or replay a financial operation to clear this error.

Recovery: download the pending-command backup before closing the page; deploy the matching backend Domain/Code and Index package; reload the last committed ledger and reconcile the saved request against project/item/expense IDs in the backup. If it is present, retain it without repeating the operation. If uncertain, keep the backup for administrator review. The UI disables retries for an explicit request-ID conflict and directs the user to back up and reload.

Tests cover reordered nested keys, altered content, another actor, legacy hash compatibility, no extra journal entries on retry, and RPC readback key-order changes. This is local/mocked verification; the owner must update the actual Apps Script deployment and verify it in an authenticated test ledger. No production data migration is part of this fix.
