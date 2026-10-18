'use strict';
// The standalone preview deliberately uses the real session-memory vault.
// File/content viewers may reject IndexedDB even before its open request begins.
globalThis.CLEA7.Vault=globalThis.CLEA7.MemoryVault;
