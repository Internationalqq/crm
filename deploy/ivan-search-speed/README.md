# Ivan Volga search speed, 9 October 2026

Installed in the existing Mac run; no new worker or search was started.

- Plain public search text accepts semicolons. The previous local validation incorrectly denied an ordinary Google AI query containing one. Other text/URL restrictions, Chrome binding and time-limited consent remain.
- Native `type_text` defaults to `delay_ms=0`, preserving the exact window and element. Explicit delays remain intact. URL navigation still uses `set_value` and fresh capture.
- Inter-position idle is 2 seconds instead of 20. The existing OS waiter lock gives a waiting Gulya priority; no lock was removed.

Backup: `/Users/egor/.hermes/profiles/commercial/workspace/volga-chrome-pilot-20261004/backup-speed-1791540491`.

Verified: 4 wrapper tests, 12 native fast-input tests and 4 OS browser queue tests passed on Mac. Reviewed installed diff. No live search timing yet: the prior deadline expired and a replacement deadline is awaiting the user's answer.

Saved progress remains 213/213 first attempts and 56/188 retry attempts. Attempts are not accepted prices. The prior blocked/interrupted positions remain in history and unresolved results; neither their outcomes nor counters were reset.

Next: after the new deadline is explicitly set, back up states again, check runner/session/supervisor OS locks, resume only the existing service, and measure five actual position attempts from audit/results. Preserve the 5 AI sites + first 3 organic sites rule, session limits, access stops, own-tab cleanup and saved evidence. Do not promise 200 positions/hour before measurement.
