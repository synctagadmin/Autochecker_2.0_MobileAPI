import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { UserRefreshTokenSchema, UserDetailsSchema, AdminloginSchema } from './users.model';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SettingModule } from 'src/setting/setting.module';
//import { SettingSchema } from 'src/setting/setting.model';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { ProductDetailsSchema } from 'src/product/product.model';


@Module({
  imports: [
    SettingModule,
    MongooseModule.forFeature([{ name: 'UserRefreshToken', schema: UserRefreshTokenSchema }]),
    MongooseModule.forFeature([{ name: 'UserDetails', schema: UserDetailsSchema }]),
    MongooseModule.forFeature([{ name: 'admindetail', schema: AdminloginSchema }]),

    MongooseModule.forFeature([{ name: 'ProductDetail', schema: ProductDetailsSchema }]),
    
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        secure: false,
        auth: {
          user: 'autocheckerparts@gmail.com',
          pass: 'pwkymnztagrzxojf',
        },
      },
      defaults: {
        from: 'autocheckerparts@gmail.com',
      },
      template: {
        /**
         * Beside the compiled module, not relative to wherever the process was started.
         *
         * This was './src/users/templates', which Handlebars resolves against
         * process.cwd(). The deploy ships `dist/` and nothing else, so in a release
         * there is no `src/` at all and every email died on
         * `ENOENT: open 'src/users/templates/confirmation.hbs'` - reaching the caller as
         * "Cannot destructure property 'templateName' of 'precompile(...)'", because the
         * adapter does not check that the read succeeded.
         *
         * __dirname is right in both places: `<repo>/src/users` when running from
         * source, `<release>/dist/users` once built - and nest-cli.json copies the .hbs
         * to `dist/users/templates` to match. Its outDir said `dist/src` while the code
         * compiles to `dist/users`, so the template was landing in a tree nothing read.
         */
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(), // or new PugAdapter() or new EjsAdapter()
        options: {
          strict: true,
        },
      },
    }),

  ],
  controllers: [UsersController],
  providers: [UsersService,
    { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [UsersService]
})
export class UsersModule { }
