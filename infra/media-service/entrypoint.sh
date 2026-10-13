#!/bin/sh
set -eu

# Do not start signature downloads on a container too small for full ClamAV
# signatures. The HTTP service remains available but /ready and /scan
# fail closed until deployed with adequate memory.
limit="max"
if [ -r /sys/fs/cgroup/memory.max ]; then
  limit="$(cat /sys/fs/cgroup/memory.max)"
elif [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
  limit="$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)"
fi

case "$limit" in
  max) enough_memory=1 ;;
  ''|*[!0-9]*) enough_memory=0 ;;
  *)
    if [ "$limit" -ge 1073741824 ]; then
      enough_memory=1
    else
      enough_memory=0
    fi
    ;;
esac

if [ "$enough_memory" -eq 1 ]; then
  (
    freshclam --quiet || true
    freshclam -d --quiet || true
  ) &
else
  echo "ClamAV signature updates skipped: scanner memory budget is insufficient; scan remains fail-closed" >&2
fi

exec node /srv/media/server.mjs
