# BL CLEA7 public website

Published domain: https://clea7.brzoilokalno.com/

This repo contains the public website, browser execution target and curated application SDK. It does not contain the private Windows host, AI service, publisher profiles or user data. Browser runtime engine assets come from tested source e30e619841a6d93e6295bc89c7f50e89778bcac0.

The website has no analytics, external fonts, mandatory account or API key input. Core app data stay in browser storage. Native packages are offered only after a verified public release catalogue exists.

Run `python scripts/check_public.py` and `python scripts/package_public_sdk.py` for local checks/packaging. Actual Chrome checks run in GitHub Actions before publication. See docs/USLOVI.txt and separate dependency/material notices.
