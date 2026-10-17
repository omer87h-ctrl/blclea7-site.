# Authenticated local storage policy 1

Original BLclea7 implementation, by Brzo i Lokalno. This is a host security patch
for application/7; BIL1/2/3 source and application2–7 contracts are preserved.

## Identity and lifecycle

The trusted coordinator constructs `clea7.principal/1` from application ID and a
sorted set of backend alias, adapter version, isolated project ID and verified
Auth UID. Only actual adapter authentication replies update it. BIL's editable
RemoteSession record never selects a namespace. Raw credentials/tokens never
enter the principal, compiler, Vault, package, backup or trace.

The storage namespace is `principal1:<app>:<sha256(canonical principal)>:` inside
the existing application Vault. Hashing is a namespace identifier, not encryption
or an authentication signature. All state, derived BIL values, local tables,
cache and effect journals use the same immutable view. Unauthenticated data has
its own persistent namespace. Login does not copy anonymous drafts into an
account. Multiple backends form one composite principal; changing any identity
switches the entire application context.

Before credential entry/signout, the Engine revokes the previous view, blanks
private UI/debug data and cancels motion/worker work. Queued old-context events
and stale backend replies are rejected. Authentication is its own event and
blocks overlapping remote submissions while deterministic local events can run.
The transition loads only the matching namespace, rechecks types and reconciles
its derived UI. Restart opens anonymously because credentials are memory-only;
reauthentication is required to restore account data. Closing clears the remote
Engine's visible state and presentation caches.

Revoked views cannot access state. A separate bounded `putEffect` operation can
only finish redacted journal metadata in the original namespace, including an
uncertain remote write. It cannot move state/results to the new namespace or
retry a write. Installation guards on the underlying Vault still apply.

## Backup compatibility and recovery

Remote state backups use `clea7.state/2`; full data backups use `clea7.data/3`,
with a `clea7.storage-scope/1` digest. Restore rejects absent/foreign scope before
writing. Nonremote state/1 and data/2 remain unchanged. SHADOW gets the same
principal over a separate MemoryVault and cannot make external requests.
A downloaded JSON file is readable user data, not an encrypted or signed backup;
a user with access to the file can deliberately edit/import its content.

Old unscoped application/7 state/tables/journals are quarantined in place. They
are never silently assigned to a later account and are not deleted by this patch.
An owner-reviewed migration/export recovery workflow remains required; guessing
ownership from an editable public session would disclose data.

## Evidence and remaining limits

`tests/test_principal_isolation.cjs` tests A→logout→B→A, restart, forged public
sessions, quarantine, stale replies, queued events, SHADOW and project separation.
These10groups explicitly inject a host adapter; they are not network evidence.
Actual Firebase/browser/native account-switch cases passed at source
a3e267b15f3b7f41187c5a78577f7d9d67c70549. Real Firebase run39002583422/job117308443005 passed
8adapter+9BIL-workflow+9Chrome groups. Native run39002583409/job117308443021
passed two distinct API30 AVDs plus separate Runtime install, including native
account switching, local draft recovery and foreign-backup rejection. Full run
39002583413 passed Linux verify117308618475,Windows117309114710 and
Android117309114689.108Python cases (Linux107+1skip;Windows108pass),
216Node groups and112Chrome groups passed. No physical-device proof is claimed.

Same-origin/OS-profile owners can inspect IndexedDB and exported files. This is
application/user separation in the closed interpreter, not OS process isolation,
encryption at rest, remote revocation push or forensic secure erasure. Durable
credentials, production services and full multi-user acceptance remain separate.
No production Brzo i Lokalno services, telemetry or licence changes are involved.
