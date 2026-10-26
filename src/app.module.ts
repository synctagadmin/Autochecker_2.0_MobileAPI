import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingModule } from './setting/setting.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LoadModule } from './loader/load.module';
import { productController } from './product/product.controller';
import { ProductModule } from './product/product.module';
import * as dotenv from 'dotenv';

// Loaded here, not in main.ts: Node runs a module's imports before its body, so by the
// time main.ts executes, this file's @Module decorator has already been evaluated and the
// connection string already read. This is the first point at which .env can still matter.
dotenv.config();

/**
 * The database MobileAPI connects to.
 *
 * This used to be a literal, naming autocheckerpartsclonenew (the STAGING database) with
 * its password in the source. That made `start:staging` and `start:prod` the same thing,
 * so the environment profiles could not mean anything.
 *
 * There is deliberately NO fallback. The old literal would have been a staging default,
 * and a production deployment that forgot to set MONGO_URI would then have come up
 * silently writing to staging - against collections AdminAPI and eBayAPI share. Refusing
 * to start is the recoverable failure; connecting to the wrong database is not.
 *
 * config/env.profiles.json declares which database each profile REQUIRES, and
 * `npm run env:validate:<profile>` checks this URI names that one before anything starts.
 */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error(
    'MONGO_URI is not set. Put it in this repository\'s .env (local) or the deployment\'s ' +
    'shared/.env. See .env.example, and `npm run env:status:staging` / `:prod` to check ' +
    'which database it resolves to before starting.',
  );
}

@Module({
  imports: [MongooseModule.forRoot(MONGO_URI),

    AuthModule,
    SettingModule,
    UsersModule,
    LoadModule,
    ProductModule,
  ],
  controllers: [AppController, productController],
  providers: [AppService],


})
export class AppModule {

}
