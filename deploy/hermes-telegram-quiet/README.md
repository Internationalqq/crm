# Quiet team chats — 9 October 2026

User requested no voice-transcript echoes or tool-action messages in team chats.
This is a display change, not a change to speech recognition or agent tool access.

## Implementation

The shared gateway checks `display.transcription_echo` before publishing raw STT
text in all four paths: fresh voice, queued voice, voice interrupt and queue drain.
Default is true for compatibility. The team's existing profile configurations
explicitly set it false. Recognized text still reaches the agent.

All existing configured platform overrides and the global display block set:

```
tool_progress: off
transcription_echo: false
show_reasoning: false
thinking_progress: false
interim_assistant_messages: false
```

Final replies, files, important failure responses and local diagnostic logs remain.
No bot credentials, tools, model, permissions, schedules or network settings change.
Existing chat history is retained.

## Install / rollback

Exact source before/after hashes are in manifest.json. Save the current source
diff and profile configurations first. Apply from the Hermes repository with
`git apply --check quiet.patch`, then `git apply quiet.patch`. If already at the
after hashes, do not apply again. Preserve unrelated local changes. Update only
the display settings above in profile configs; do not copy credentials into Git.
Restart idle gateway services using their existing launchd labels; defer active
ones. Roll back by checking/applying the reverse patch and restoring saved configs.

Backup on Mac: `/Users/egor/.hermes/backup-quiet-chats-20261009`.

## Verification

Canonical runner:

```
scripts/run_tests.sh tests/gateway/test_transcript_echo.py tests/gateway/test_display_config.py tests/gateway/test_voice_mode_platform_isolation.py -- -q
```

59 tests passed. Queued-voice behavior verifies that STT text still reaches the
agent while disabled publication sends no message, and enabled publication still
works. Config resolution preserves defaults and respects platform overrides.
The full Hermes suite was not run; no synthetic message was sent to real groups.

Fresh read-only review found no actionable issues in the Telegram scope. All 17
profile configurations preserve unrelated values. The queued path was tested;
fresh-message and both inline drain paths were inspected independently.
