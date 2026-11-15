# Local document OCR through Sense, BIL and Runtime

Runtime0.42.0 adds `sense.local/1` operation `document.ocr(language: Text) -> Text`.
Languages:bos (Bosnian) andeng (English). `sdk/examples/bil/local-ocr.bil` is real
executable BIL. The same operation is available through Studio capability editing
and the reviewed `sense.ocr` operator. No image result is invented in SHADOW.

Sense CV imports PNG/JPEG with explicit OCR consent and image-only PDF pages with
local rendering then OCR. Existing text/PDF parsing remains. Text is shown in an
editable preview and replaces the CV only after separate approval. Runtime likewise
requires choosing the image then approving recognized text before BIL receives it.
Cancellation/errors preserve existing confirmed content. DOCX export is real.

Limits:5MiB input image,8 million pixels, dimension10000, recognition90s,30,000
characters. Image-only PDFs allow at most3 scanned pages. Workers are disposable,
child workers terminate on cancel, models are read only after explicit use, no
microphone/camera/storage permission is implied. Selected images stay local.
Runtime checks source, feature floor, scoped operation grants, result shape and
transaction lifetime. Android's system document chooser is scoped, not an unrestricted
filesystem grant. Java compilation is not proof of the Android picker or device OCR.

Recognition uses separately licensed Tesseract.js6.0.1, Tesseract.js-core6.1.2 and
Tesseract tessdata_fast4.1.0 bos/eng weights. Upstream JS/core bytes are unmodified;
weights are losslessly gzip compressed. Exact origins, SHA256, original sizes,
licences and bundled/compiled dependency notices are retained under
`web/sense/vendor/ocr/`. `clea7.ocr_assets` admits only these pinned assets for export.
CLEA owns the integration, type contracts, review and lifetime rules, not upstream
recognition weights. OCR confidence is an engine estimate, not a promise of accuracy.

Actual tests use public synthetic documents, no user CVs. Run
`python tests/browser_sense_ocr.py --output test-evidence/ocr` and
`python tests/browser_studio_ocr.py --output test-evidence/studio-ocr`.
Test prerequisites:Playwright, Chromium and Pillow/DejaVu for synthetic fixtures.
