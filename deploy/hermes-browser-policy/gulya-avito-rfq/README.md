# Scoped RFQ plugin

Installed only under `/Users/egor/.hermes/profiles/gulya/plugins/gulya-avito-rfq`.
The profile config enables this plugin and adds its toolset to `platform_toolsets.cli`.
Registration and invocation require Gulya's home/profile and the exact board/task:
`construction-team / t_b4b6d0c9`. Other workers retain their original tools.

`avito_rfq_step` calls the existing `team-browser-access/avito_rfq_step.py` without
changing its recipient, campaign limit, own GUI ticket, draft, screenshot or
delivery checks. The returned evidence image is included in the same tool result.
Every image must still be examined before supplying its hash to the next step.
An OS lock rejects overlapping helper calls; a timeout never retries the action.

`kanban_show` returns the original canonical `worker_context` once by default in
this task, plus task metadata and history counts. Explicit `compact=false` retains
the original full response. The database and its history are never trimmed.
The first live run omitted the optional compact argument, so the scoped default
was corrected for subsequent worker starts; it does not change an already loaded
worker or remove any of its current context.

Validation on 8 October 2026: 32 helper/plugin tests on Windows, 16 plugin tests
on Mac; deployed discovery exposed 39 tools versus the previous 38, adding only
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
