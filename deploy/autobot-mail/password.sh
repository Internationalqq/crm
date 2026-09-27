#!/bin/sh
set -eu
# Invoke from the user's terminal via ssh -t; input is hidden by getpass.
# Network disabled: this command only saves the secret, it never sends mail.
exec docker run --rm -it --pull never --network none --read-only \
  --security-opt no-new-privileges --cap-drop ALL \
  -v /opt/crm-secrets/autobot-mail:/run/autobot-mail:rw \
  crm-autobot:latest python -m autobot.buyer_mail_service configure \
  --config /run/autobot-mail/config.json
