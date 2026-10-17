# BLclea7 — public website and developer distribution

Website: https://clea7.brzoilokalno.com/

This repository contains the consumer website, browser Studio/Runtime and the curated public application SDK. The private native host and owner keys are excluded. Existing downloads remain available; native release assets are append-only and identified by their source commit and SHA-256.

The 0.13 candidate adds original BIL Android capabilities, scoped local media and visual group workflows. Native-only apps do not need Firebase. Local notifications are distinct from remote push. Windows/Android packages are development distributions; owner release signing and complete general-platform acceptance are separate requirements.

Run python scripts/check_public.py and python -m unittest discover -s tests -v. GitHub Actions verifies actual browser authoring, isolated backend services, SDK execution and anonymous deployed downloads. Public promotion must use exact approved, tested binaries and retain original terms/licence notices.
