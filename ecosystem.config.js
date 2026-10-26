/**
 * pm2 process definition for MobileAPI.
 *
 * pm2 runs dist/main.js DIRECTLY, not `npm run start:prod`. Two reasons:
 *
 *   1. scripts/with-env.js spawns the app as a CHILD. Under pm2 that would make pm2
 *      supervise the wrapper rather than the service - restarts, memory limits and
 *      `pm2 logs` would all be watching the wrong process.
 *   2. The deployed release symlinks shared/.env into place, and app.module.ts calls
 *      dotenv.config(), so the environment is already there without a wrapper.
 *
 * The profile validation is not lost: the deploy workflows run
 * `npm run env:validate:staging` / `:prod` from the release directory - where .env is
 * already symlinked - BEFORE the release is made current. A release whose MONGO_URI
 * names the wrong database never becomes the running one.
 */
module.exports = {
  apps: [
    {
      name: 'autochecker-mobile-api',
      script: 'dist/main.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: '30s',
      restart_delay: 5000,
      // MobileAPI's heaviest paths are the loader sweeps and the xlsx reads in
      // setting.service. 768M leaves room for those without masking a real leak.
      max_memory_restart: '768M',
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
