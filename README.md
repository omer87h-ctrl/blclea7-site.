# BLclea7 — public website and developer distribution

Website: https://clea7.brzoilokalno.com/

This repository contains the customer website, browser Studio/Runtime and curated public application SDK. The private native host and owner keys are excluded. Existing downloads remain available; native release assets are append-only and identified by source commit and SHA-256.

Development release 0.15 adds checked visual BIL authoring from a blank project: typed values and custom records, event actions, conditions, list/record expressions, button/gesture binding, original shapes and animation. Compatible added values preserve existing local data after the first execution. Web and Windows use the same application model. See the practical guide at sdk-source/docs/STUDIO-GUIDE.md.

The public website is maintained here. Customer copy should explain actions in natural Bosnian, match the visible code and current download contracts, and link to detailed developer/security documentation. Native-only apps do not require Firebase. Local notifications are distinct from remote push. Windows/Android distributions remain development packages; physical-device coverage, owner release signing and broad general-platform acceptance require their own evidence.

Run `python scripts/check_public.py` and `python -m unittest discover -s tests -v`. GitHub Actions checks real browser authoring, isolated backend services, independent SDK execution, offline Studio and anonymous deployed downloads. Publish only the exact approved tested binaries, preserve prior downloads and retain original terms/license notices.
