#!/usr/bin/env bash
# One-time preparation for MobileAPI on the shared AutoChecker application host.
#
# This script does NOT touch nginx. There is exactly ONE nginx file on that box,
# /etc/nginx/sites-available/autochecker, and it is owned by
# AutoChecker-AdminAPI/.github/server-setup.sh, which writes it with `tee` - so a
# second file, or an edit made here, is wiped the next time that script runs. The
# mobileapinew server block lives there, alongside the other three.
#
# It also does NOT configure TLS, and certbot is not used. Every host on this box is
# behind CloudFront, which terminates HTTPS with an ACM certificate and fetches from
# the origin over plain HTTP. An ACM certificate cannot be installed on nginx - AWS
# never releases the private key - so nginx serves :80 only.
#
# Run once, as a sudo-capable user, AFTER AdminAPI's server-setup.sh and BEFORE the
# first deploy:
#   bash server-setup.sh
set -euo pipefail

NODE_MAJOR=20                       # must match NODE_VERSION in the deploy workflows
APP_DIR=/var/www/autochecker/mobileapi
APP_PORT=3001

echo "==> Checking what is already here"

if ! command -v node >/dev/null; then
  echo "ERROR: node is not installed. Run AdminAPI's server-setup.sh first - it owns"
  echo "       Node, pm2 and nginx on this box."
  exit 1
fi

HAVE="$(node -v | cut -d. -f1 | tr -d v)"
if [ "$HAVE" != "$NODE_MAJOR" ]; then
  echo "ERROR: this box runs Node ${HAVE}, not ${NODE_MAJOR}."
  echo "       Not changing it: AdminAPI and eBayAPI are running on ${HAVE}."
  echo "       Set NODE_VERSION in MobileAPI's workflows to ${HAVE} instead, or"
  echo "       upgrade every service on this box together."
  exit 1
fi

for c in pm2 nginx rsync; do
  command -v "$c" >/dev/null || { echo "ERROR: $c is missing. Run AdminAPI's server-setup.sh first."; exit 1; }
done
echo "    Node $(node -v), pm2 $(pm2 --version), nginx present."

# Port 3001 must be free. If something already answers there, stopping to ask is
# cheaper than two services fighting over a socket.
if command -v ss >/dev/null && ss -ltn "( sport = :${APP_PORT} )" | grep -q ":${APP_PORT}"; then
  echo "ERROR: something is already listening on ${APP_PORT}."
  ss -ltnp "( sport = :${APP_PORT} )" || true
  exit 1
fi

if ! grep -q "mobileapinew" /etc/nginx/sites-available/autochecker 2>/dev/null; then
  echo "WARNING: /etc/nginx/sites-available/autochecker has no mobileapinew block."
  echo "         Re-run AdminAPI's server-setup.sh - it owns that file."
fi

echo "==> Directory layout"
sudo mkdir -p "$APP_DIR"/{releases,shared/logs}
sudo chown -R "$USER":"$USER" "$APP_DIR"

echo "==> shared/.env"
# The deploy fails fast when this is missing, by design. Created blank here so the
# file exists with the right ownership and permissions; fill it in before deploying.
if [ ! -f "$APP_DIR/shared/.env" ]; then
  cat > "$APP_DIR/shared/.env" <<'ENV'
# Fill these in before the first deploy. See .env.example in the repository.
#
# autocheckerpartsclone     = the LIVE database
# autocheckerpartsclonenew  = the STAGING database
# The production profile REFUSES to start unless MONGO_URI names autocheckerpartsclone.
MONGO_URI=
SCRAPER_URL=https://scrapernew.autochecker.com/
PORT=3001
ENV
  chmod 600 "$APP_DIR/shared/.env"
  echo "    created $APP_DIR/shared/.env - MONGO_URI is still blank."
else
  echo "    $APP_DIR/shared/.env already exists; left alone."
fi

cat <<DONE

==> Done.

Still to do:

  1. Fill in MONGO_URI in ${APP_DIR}/shared/.env.
     Production requires autocheckerpartsclone. Check before deploying:
         cd ${APP_DIR}/current && node scripts/with-env.js production --status

  2. CloudFront: mobileapinew.autochecker.com must be an alternate domain name on
     the distribution, and its Origin protocol must be HTTP only.

  3. GitHub secrets on the MobileAPI repository:
         PROD_SSH_KEY / PROD_HOST / PROD_USER   -> this box

  4. Push the production branch. That is the deploy.

  5. Repoint the Azure Logic App crons at mobileapinew.autochecker.com and STOP the
     Azure MobileAPI in the same change. Both running at once means two services
     writing productdetails and stockhistories from stale reads.
DONE
