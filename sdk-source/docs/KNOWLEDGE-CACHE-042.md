# Bounded local evidence and SSD cache

The existing seven-responsibility CLEA AI keeps its licensed local9B language
component and local SQLite FTS evidence store. No cloud inference, private CV/chat
training or model download is added by these changes.

Indexing now reconciles changed/removed approved documents transactionally instead
of rewriting unchanged chunks. Relative links are admitted only when their targets
are inside the same approved corpus. Returned references identify document and
chunk SHA256 and related documents. Corpus changes invalidate query results.

The SSD cache is bounded to256 entries and2MiB of payload. Least-recently-used
entries are evicted; cache payload digests reject accidental corruption and cause
recomputation. Legacy schemas migrate without deleting private opt-in memory.
The existing RAM context window remains bounded, revision-scoped and short-lived.
Private explicit memory is not exposed as public project evidence. Cache data are
plaintext approved document excerpts, not an encrypted secret store. Digests detect
corruption, not a malicious owner able to replace both payload and digest.

This is evidence retrieval and dependency-aware storage, not semantic embedding
training, LoRA/distillation or an increase in neural parameter capacity. SSD does
not replace RAM. Actual9B versus improved/70B conversational quality still needs
matching real model executions, not fixture transports or keyword scores.

Verification:`python -m unittest tests.test_brain tests.test_brain_cache -v` covers
migration, invalidation, changed/deleted documents, relative links, LRU eviction,
byte admission, corruption fallback and private-memory isolation.
