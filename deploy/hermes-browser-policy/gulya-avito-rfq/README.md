# Scoped RFQ plugin

Installed only under `/Users/egor/.hermes/profiles/gulya/plugins/gulya-avito-rfq`.
The profile config enables this plugin and adds its toolset to `platform_toolsets.cli`.
Registration and invocation require Gulya's home/profile and the exact board/task:
`construction-team / t_b4b6d0c9`. Other workers retain their original tools.

`avito_rfq_step` calls `team-browser-access/avito_rfq_step.py`. The default workflow
is inspect → visual recipient/history review → submit. Submit performs paste,
exact clipboard readback, identity/capacity/own GUI ticket checks, a single Send,
and bounded read-only delivery checks in one process. There is no model call
between Paste and Send. Exact outgoing text, a delivery/read receipt and an
empty editor without a Send button are required before recording sent_verified.
The evidence image is saved and returned inline. Missing evidence leaves
send_unknown, never an automatic retry. Old fill/send/confirm steps remain
available for existing drafts. An OS lock rejects overlapping plugin calls.
Every supplied review hash must still come from an actually examined screenshot.

`kanban_show` returns the original canonical `worker_context` once by default in
this task, plus task metadata and history counts. Explicit `compact=false` retains
the original full response. The database and its history are never trimmed.
The first live run omitted the optional compact argument, so the scoped default
was corrected for subsequent worker starts; it does not change an already loaded
worker or remove any of its current context.

Before submit, validation on 8 October 2026: 32 helper/plugin tests on Windows,
16 plugin tests on Mac; deployed discovery exposed 39 tools versus the previous 38, adding only
`avito_rfq_step`. Out-of-scope discovery retained the original `kanban_show` and
omitted the new tool. Compact/full canonical context matched exactly; response
size in that snapshot was 31,729 versus 88,695 characters. The model dispatcher
handles this multimodal envelope generically for vision-capable models.

Run local checks:

```powershell
python -m unittest discover -s deploy/hermes-browser-policy -p 'test_avito_rfq*.py'
```

Rollback: wait for this worker to stop between actions, restore only its software
and profile config from `backup-speed-recovery2-20261008T183823Z`. Keep all newer
send ledgers, pending state, results and evidence; never restore an old database
over completed sends. No shared Hermes source, CRM data, model, provider, account
or network configuration was changed by this plugin installation.
