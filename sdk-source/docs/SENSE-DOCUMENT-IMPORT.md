# Local CV document import

Sense imports user-selected UTF-8 TXT, DOCX and text PDF, up to5MiB,25 PDF pages
and30,000 text characters. It first shows an editable preview. Rejecting,
cancelling or encountering an invalid file preserves the current CV. The user
confirms replacement; source changes during import invalidate that replacement.

PDF.js6.5.438 is an unmodified Apache-2.0 dependency. Its full licence and pinned
npm source/integrity are in `web/sense/vendor/pdfjs`. Client/worker load only
after PDF selection. No paid API, model, telemetry or document upload is used.
The original CLEA DOCX adapter reads bounded ZIP/XML, checks CRC, rejects unsafe
archive paths, duplicates, encryption and XML entities, and never executes macros.
Column ordering, headers, footers and image content require user review. A scanned
image is not claimed to have OCR; missing text produces an explicit error.

`CLEA7SenseDocumentImport.read(file, {approved: true, signal})` is a browser-host
API returning `{text, format, warnings, local: true, aiUsed: false}`. It is not a
new universal BIL/native operation. A compatible host must provide File, Blob,
DOMParser, module workers and local decompression. Older hosts fail explicitly.

`CLEA7SenseSDK.reader()` reads approved text in bounded local-TTS segments without
truncating a CV. Stop, source edits, dialog close, erase and page exit cancel it.
Voice availability/language depend on the device. Text and semantic controls
remain available for deaf users and system screen readers. Physical voice/haptic
quality and assistive-user evaluation are not inferred from browser fixtures.

The self-contained0.39 Sense HTML embeds the same PDF client/worker and full
licence for offline use. Hosted/PWA assets remain under the existing CLEA origin.
The current CV can be compared to an advert and exported as a real DOCX. AI help
uses only explicitly selected/reviewed short excerpts; it does not automatically
receive an imported document, and retrieval is not weight training.
