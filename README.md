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

```
/var/www/autochecker/mobileapi/
  shared/.env        # created by hand from .env.example - the deploy fails without it
  shared/logs/
  releases/
  current -> releases/<sha>
```

## Known rough edges

- `npm test` is not a CI gate. The two spec files are `nest g` scaffolding and have never
  passed; `app.controller.spec.ts` also fails type-check, which is why `npm run typecheck`
  targets `tsconfig.build.json` (what `nest build` actually compiles).
- `setting.service.ts` reads `./newEbay.xlsx`, which is not in the repository. `ExcelUpload()`
  throws if called. Pre-existing.
- `puppeteer`, `firebase-admin` and `razorpay` are declared but never imported. `httpsMode.ts`
  exports a Razorpay helper that nothing calls.
- The JWT secret in `src/auth/constants.ts` is still a literal. Known, deferred.
