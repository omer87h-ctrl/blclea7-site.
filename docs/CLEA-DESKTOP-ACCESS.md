# Owner-local CLEA conversation

The existing conversation UI also supports an owner-local HP host. It uses the
same CLEA gateway, knowledge and licensed Qwen language component. This is not a
new trained CLEA foundation model or a separately published assistant.

`desktop-loopback` serves the existing chat from `http://127.0.0.1:18766`.
No Cloudflare account, email code or downloaded browser model is required.
Only this exact local origin can send requests. The native model API is not
forwarded. The owner manually starts and stops the launcher; there is no new
Windows autostart, mandatory cloud service or change to the public endpoint.

An optional **Otvori i na telefonu** action requests a temporary private link
from the owner-local host. Only after HTTPS health/identity verification and
rejection of unauthenticated inference does the host return an invitation.
The random invitation is a URL fragment. It is exchanged for a bounded session,
then removed from the address bar. A Secure, HttpOnly, SameSite=Strict cookie
restores the session after reload. Conversation messages remain in session RAM.

This development sharing mode lasts at most 45 minutes and admits at most 30
messages. Possession of the invitation grants access; keep it private. It uses
Cloudflare's transport and therefore requires internet/provider availability.
It is not permanent public hosting and is not automatically enabled on this
website. Session/IP quotas are safeguards, not a guarantee against attacks.

The HP executable/model integrity checks and origin/resource boundaries remain
in force. Model output never becomes a shell command or an unrestricted tool.
Browser tests using fixture inference establish UI/transport behavior only;
actual model generation and physical-phone tests require separate evidence.
