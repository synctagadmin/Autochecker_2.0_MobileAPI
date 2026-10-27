import * as dotenv from 'dotenv';

/**
 * dotenv again, not only in app.module.ts.
 *
 * This file is reached through app.module.ts's IMPORTS, and Node evaluates a module's
 * imports before its body - so app.module.ts's own dotenv.config() has not run yet and
 * process.env would still be empty at this point. Loading it here too is cheap and
 * cannot clobber anything: dotenv leaves variables that are already set alone, so a
 * value exported by the deployment still wins over the file.
 */
dotenv.config();

/**
 * The key every MobileAPI token is signed and verified with.
 *
 * It was a literal in this file, and this repository is public - which put the signing
 * key where anyone could read it, and a signing key that is readable is a key anyone can
 * mint valid tokens with. That is worse than a leaked database URI, which at least still
 * has to reach the cluster.
 *
 * There is deliberately NO fallback. Falling back to the old literal would keep every
 * deployment that forgets JWT_SECRET on the compromised key while looking fixed, which
 * is the failure that cannot be noticed. Refusing to start can be.
 *
 * Changing this value invalidates every token already issued, so every signed-in app
 * user is logged out once. That is the point of changing it.
 */
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    'JWT_SECRET is not set. Put it in this repository\'s .env (local) or the ' +
    'deployment\'s shared/.env at /var/www/autochecker/mobileapi/shared/.env. ' +
    'See .env.example.',
  );
}

export const jwtConstants = { secret };
