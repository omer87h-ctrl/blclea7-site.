# Public product discoverability — 14 November 2026

Repaired the public Studio `noindex` directives and `/studio/` robots exclusion.
The Studio entry now describes the working product and links directly to it.
Added canonical URLs, descriptions and sitemap entries for Studio, workbench,
Sense CV and the existing original Auto application. The CLEA home links to
Studio, AI, Sense, Auto, the existing TECH portal and its game. Raw SDK and
application execution instances retain crawl exclusions; these are not security
controls. No DNS, TECH content, original Android application or production data
was changed.

Auto's previous Sites deployment was restricted to its owner. Its existing web
assets are now hosted under `/auto/` on the owner's CLEA domain. Copyright and
licences are retained. The existing test APK is unmodified; its compiled frontend
is a separate version from the current web frontend. No physical adapter or
vehicle acceptance is implied. `release/auto-public-2026-11-14.json` records the
source worktree provenance and exact existing APK metadata.

Executed verification:

- `python scripts/check_search_visibility.py`: six public product URLs crawl-ready.
- `python scripts/check_public.py`: 513 local references, released download hashes,
  public asset inventories and existing SDK/private-host boundary passed.
- `python -m unittest discover -s tests`: 67 tests passed.
- Actual Chrome at390px: six pages loaded, canonical/index directives and no
  horizontal overflow; Auto's real APK downloaded and SHA/ZIP checked, its shell
  reloaded offline; no JavaScript errors. This tests the staged public site.
- Existing Auto source tests:578 Node tests passed. Its full browser suite had
  11 passes and one APK/current-native-files byte comparison failure. That APK is
  unchanged and not falsely certified as containing the latest web source.

The existing TECH robots file allows crawling and its sitemap includes `/igra/`.
No invented block was removed from that site. The connected Search Console tool
refused access with `payment_required` (expired trial); no subscription was made.
No actual Google URL-inspection verdict is available. Crawlability and publication
are distinct from inclusion or ranking in Google's index. No indexing guarantee,
automatic search submission or claim of instant discovery is made.
