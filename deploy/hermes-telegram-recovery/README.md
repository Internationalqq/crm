# Telegram recovery — 9 October 2026

Patch for the existing Hermes deployment on mac-mini-hermes, based on Hermes
`a98403caba853060f99a8e68ec0505157a045114` plus its existing local changes.
The manifest identifies the exact before/after files; do not overwrite a newer
or differently modified adapter.

## Behavior

- Network and conflict recovery use one asynchronous lane.
- A new recovery cancels the previous deferred heartbeat.
- Starting polling preserves the network retry budget. A successful health probe
  clears it; repeated failures reach the existing bounded escalation path.
- Failed-start retries are tracked by the polling callback and cancelled during
  shutdown. Pending Telegram updates remain preserved on reconnect.
- The general request pool and outgoing-message retry behavior are unchanged.

## Install / rollback

Save the current diff and copies of both target files first. From the Hermes repo,
verify the before hashes, then use `git apply --check reconnect.patch` followed by
`git apply reconnect.patch`. If already at the after hashes, do not apply again.
Restart only idle affected gateways using their existing launchd services.
For rollback, first check `git apply --reverse --check reconnect.patch`, then apply
the reverse patch. Do not reset the repo or overwrite unrelated local edits.

## Validation and current limitation

Canonical runner:

```
scripts/run_tests.sh tests/gateway/test_telegram_network_reconnect.py tests/gateway/test_telegram_send_path_health.py tests/gateway/test_telegram_thread_fallback.py -- -q
```

68 tests passed. Regression coverage includes preserving the retry budget,
verified recovery, simultaneous reconnects, cancelling stale probes and avoiding
overlapping network/conflict recovery. Full Hermes suite was not run.

Live Anya restart completed and Telegram commands registered successfully.
However, incoming polling still intermittently raises `RemoteProtocolError`,
including with a separate fresh HTTP client while the gateway was stopped.
Short getMe/getWebhookInfo requests succeeded. A controlled repeat of existing
finance job `04982daf75be` also failed before its first tool on a provider
`incomplete chunked read`. This patch fixes recovery bookkeeping; it does not
prove the underlying network/remote-service failure is resolved. No VPN,
account, model, provider or global permissions were changed.

The existing daily finance schedule remains unchanged. The repeat explicitly
targeted the missed 8 October period without replacing the stored job prompt.
No finance workbook delivery is claimed.
