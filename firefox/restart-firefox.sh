#!/bin/bash
# Root-side helper: triggered by sabi-fx-restart.path when the gate drops /opt/sabi-fx/run/restart-request.
# Restarts the whole Firefox container (browser fully closed, then launched again; profile volume is kept).
set -u
rm -f /opt/sabi-fx/run/restart-request
/usr/bin/docker restart -t 20 sabi-firefox
rc=$?
touch /opt/sabi-fx/run/restart-done
chmod 644 /opt/sabi-fx/run/restart-done
exit $rc
