#!/usr/bin/env bash
# One-time preparation for MobileAPI on the EXISTING AutoChecker application host.
#
# This box already runs, behind one nginx:
#   managenew.autochecker.com     -> static React build
#   adminapinew.autochecker.com   -> AdminAPI  on localhost:3003
#   ebayapinew.autochecker.com    -> eBayAPI   on localhost:4200
# plus Redis on localhost:6379. This script ADDS:
#   mobileapinew.autochecker.com  -> MobileAPI on localhost:3001
#
# It is deliberately additive. Two things it does NOT do, both of which would
# break the services already running here:
#
#   1. It does NOT install or change Node. AdminAPI's server-setup.sh pins the box
#      to Node 20 and REPLACES node when the major differs, so a second script
#      installing a different major would silently downgrade AdminAPI and eBayAPI
#      under them. This one asserts the version and stops if it is wrong.
#   2. It does NOT write /etc/nginx/sites-available/autochecker. That file is
#      written with `tee` by AdminAPI's setup script, so anything appended to it
#      is lost the next time that script runs - and anything this script wrote
#      over it would take the other three sites down. MobileAPI gets its own file.
#
# Run once, as a sudo-capable user, BEFORE the first deploy:
#   bash server-setup.sh
set -euo pipefail

NODE_MAJOR=20                       # must match NODE_VERSION in the deploy workflows
APP_DIR=/var/www/autochecker/mobileapi
DOMAIN=mobileapinew.autochecker.com
APP_PORT=3001

echo "==> Checking what is already here"

if ! command -v node >/dev/null; then
  echo "ERROR: node is not installed. Run AdminAPI's server-setup.sh first - it owns"
  echo "       Node, pm2, nginx and Redis on this box."
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

echo "==> nginx server block (its own file - the shared one is not touched)"
# Port 3001 is NEVER opened in the security group; nginx reaches it over loopback,
# exactly as it does for AdminAPI and eBayAPI.
sudo tee /etc/nginx/sites-available/autochecker-mobileapi >/dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 50M;      # xlsx uploads (setting.service ExcelUpload)

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # The loader sweeps scrape while the request is open; the default 60s cuts
        # them off mid-part.
        proxy_read_timeout 300s;
    }
}
NGINX

sudo ln -sfn /etc/nginx/sites-available/autochecker-mobileapi /etc/nginx/sites-enabled/autochecker-mobileapi
sudo nginx -t
sudo systemctl reload nginx

cat <<DONE

==> Done.

Still to do, in this order:

  1. DNS: point ${DOMAIN} at this box, then
         sudo certbot --nginx -d ${DOMAIN}
     certbot rewrites the block above for TLS and sets up renewal.

  2. Fill in MONGO_URI in ${APP_DIR}/shared/.env.
     Production requires autocheckerpartsclone. Check before deploying:
         cd ${APP_DIR}/current && node scripts/with-env.js production --status

  3. GitHub secrets on the MobileAPI repository:
         PROD_SSH_KEY / PROD_HOST / PROD_USER   -> this box

  4. Push the production branch. That is the deploy.

  5. Repoint the Azure Logic App crons from managemobileapi.autochecker.com to
     ${DOMAIN}, and STOP the Azure MobileAPI in the same change. Both running at
     once means two services writing productdetails and stockhistories from stale
     reads - the lost-update failure, with nothing on screen to say so.
DONE
