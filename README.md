# AutoChecker 2.0 MobileAPI

NestJS service backing the AutoChecker mobile app. Imported from `AutoChecker-MobileAPI`
(branch `new-stockflow-staging`, commit `717de50`) as the starting point for the 2.0 work.

It listens on **3001** and shares its collections — `productdetails`,
`productscrapdetails`, `stockhistories` — with AdminAPI and eBayAPI. That shared ownership
is why the environment it starts in is checked rather than assumed.

## Quick start

```bash
npm ci --legacy-peer-deps
cp .env.example .env          # fill in MONGO_URI and SCRAPER_URL
npm run build
npm run start:local
```

`PUPPETEER_SKIP_DOWNLOAD=1` is worth setting: `puppeteer` is declared but every use of it
is commented out, so the Chromium download is 300 MB for nothing.

## Environments

Three profiles live in `config/env.profiles.json`. Each declares the database it requires;
credentials stay in `.env` and never go in that file.

| Command | Profile | Database | Scraper |
|---|---|---|---|
| `npm run start:local` | local | `autocheckerpartsclonenew` | `http://localhost:3050/` |
| `npm run start:staging` | staging | `autocheckerpartsclonenew` | from `.env` (no default) |
| `npm run start:prod` | production | `autocheckerpartsclone` | `https://scrapernew.autochecker.com/` |

> **`autocheckerpartsclone` is the LIVE database. `autocheckerpartsclonenew` is STAGING.**
> The names read the opposite way round to most people's expectation, which is exactly why
> they are declared and checked instead of remembered.

Inspect or check a profile without starting anything:

```bash
npm run env:status           # local
npm run env:status:staging
npm run env:status:prod
npm run env:validate:prod    # exits non-zero if it would start wrong
npm run env:check            # asserts the cross-environment refusals still hold
```

Nothing starts until the whole resolved chain passes. A production profile handed the
staging database, or a staging profile pointed at the production scraper, prints what it
would have done and exits non-zero.

The staging profile deliberately has **no** `SCRAPER_URL` default — defaulting it to the
production scraper would send staging traffic at the live one, so it must be set in `.env`.

## Deployment

Merging into a branch **is** the deploy.

| Branch | Workflow | Target |
|---|---|---|
| `staging` | `.github/workflows/deploy-staging.yml` | staging box, keeps 3 releases |
| `production` | `.github/workflows/deploy-production.yml` | live box, keeps 5 releases, manual approval |

Every other branch and pull request runs `.github/workflows/ci.yml` (type-check, build,
profile guards).

```bash
git checkout production && git pull
git merge --ff-only staging      # or cherry-pick
git push origin production
```

Both deploys ship a release directory, symlink `shared/.env` into it, run
`npm ci --omit=dev`, then **validate the profile before making the release current**. A
release whose `MONGO_URI` names the wrong database never starts and `current` is untouched.
pm2 processes are recreated rather than reloaded, because `pm2 reload` keeps the cwd it
first resolved and would go on running a release directory the prune step later deletes.

### Required GitHub secrets

| Environment | Secrets |
|---|---|
| `staging` | `SSH_PRIVATE_KEY_STAGING`, `SSH_HOST_STAGING`, `SSH_USER_STAGING` |
| `production` | `PROD_SSH_KEY`, `PROD_HOST`, `PROD_USER` |

### On the server, once

MobileAPI runs on the same box as AdminAPI, eBayAPI and the React build, reached at
**mobileapinew.autochecker.com** and proxied by nginx to localhost:3001.

**TLS is not configured on this box and certbot is not used.** Every host here sits
behind CloudFront, which terminates HTTPS with an ACM certificate and then fetches from
the origin over plain HTTP. An ACM certificate cannot be installed on nginx — AWS never
releases the private key — so nginx serves `:80` only.

Because that second hop is unencrypted, inbound `:80` should be restricted to
CloudFront's managed prefix list (`com.amazonaws.global.cloudfront.origin-facing`).
Ports 3001, 3003 and 4200 are never opened at all; nginx reaches them over loopback.

There is **one** nginx file, `/etc/nginx/sites-available/autochecker`, owned by
`AutoChecker-AdminAPI/.github/server-setup.sh` — it writes the file with `tee`, so a
second file in `sites-enabled`, or an edit made anywhere else, is wiped the next time
that script runs. The `mobileapinew` block lives in it alongside the other three.

```bash
bash .github/server-setup.sh    # dirs and shared/.env only - never touches nginx
```

It leaves this behind:

```
/var/www/autochecker/mobileapi/
  shared/.env        # MONGO_URI blank - fill it in, the deploy fails without it
  shared/logs/
  releases/
  current -> releases/<sha>
```

Then add `mobileapinew.autochecker.com` as an alternate domain name on the CloudFront
distribution, set its **Origin protocol to HTTP only**, and set the three GitHub secrets.

### Before the first production deploy

The Azure MobileAPI at `managemobileapi.autochecker.com` is still live and the Logic App
crons still call it. Repoint those crons at the new domain and stop the Azure service **in
the same change** — two MobileAPIs running at once means two services writing
`productdetails` and `stockhistories` from stale reads, with nothing on screen to say so.
