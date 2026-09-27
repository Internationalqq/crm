#!/bin/sh
set -eu
# Authenticate only: no queue claim, message read or SMTP DATA.
exec docker run --rm --pull never --read-only \
  --security-opt no-new-privileges --cap-drop ALL \
  -v /opt/crm-secrets/autobot-mail:/run/autobot-mail:ro \
  crm-autobot:latest python -m autobot.buyer_mail_service check \
  --config /run/autobot-mail/config.json
