# CodexZu profile rules

Restores the confirmed behavior of the original Windows Telegram bridge in the
independent Hermes `codexzu` profile. Installed only in that profile's `plugins/`;
no shared Hermes or other agent source files are modified.

- `RULES.md` is the profile's `AGENTS.md`: phone-readable replies, quiet output,
  images/screenshots/files/voice, confirmed sources and scoped approvals.
- The plugin batches owner-only forwarded conversations for five seconds, retaining
  authors, order, reply context and media. Quoted commands remain data; a real owner
  stop cancels the pending batch and continues to Hermes's native stop handler.
- Packets are written before dispatch. Uncertain/cancelled packets are evidence,
  not a startup replay queue. Only the explicitly configured numeric DM owner is
  intercepted. Normal text and native approval commands retain their route.
- The original table-to-phone-block formatter is a Telegram-only output hook.
- The existing comparison renderer now selects installed Windows/macOS/Linux fonts;
  it rejects a missing ruble glyph. No new font/download dependency is introduced.

Production profile: `/Users/egor/.hermes/profiles/codexzu`.
Model preference was restored from the owner's original message: `gpt-6.1-sol`,
medium reasoning. The Telegram token/whitelist and existing provider login remain
unchanged. Backups are inside the profile's `backups/rules-20261017`.

Verification on the installed Mac runtime:14 tests pass; real model image input
returned order73519 and amount42580; local speech returned42; a real browser PNG
was created; DOCX/XLSX/PDF round trips passed; a test PNG was delivered in Telegram.
The generated test data is explicitly labelled, not a commercial comparison.

Run the focused tests with the host Python:

```
python -m unittest discover -s deploy/codexzu-profile-rules -p 'test_*.py'
```

The picture test needs the already installed Pillow runtime. Full CRM/Hermes
suites and Windows desktop capture were not part of this change. Actual source
image enhancement remains constrained by preserving original data. No new paid
artistic-image API was provisioned.

Rollback stops only the idle codexzu gateway, restores the three backed-up profile
files and disables this profile plugin, then restarts this same service. Keep the
new agent's conversations and forward packet evidence. Do not restart the legacy
Windows model queue or replay uncertain sends.
