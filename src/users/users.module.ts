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
        /**
         * Do NOT fetch stylesheets over the network while building an email.
         *
         * The adapter runs every rendered template through css-inline, and css-inline
         * downloads any <link rel=stylesheet> it finds. confirmation.hbs links three:
         * bootstrap from cdn.jsdelivr.net and two from fonts.googleapis.com. When the
         * box cannot reach them the call throws - and the adapter catches it with an
         * EMPTY catch block:
         *
         *     try { mail.data.html = inline(rendered, this.config.inlineCssOptions); }
         *     catch (e) { }
         *     return callback();
         *
         * so `html` is never assigned, nodemailer sends a message with no body, and the
         * service logs "Email sent sucessfully". That is the empty forgot-password mail:
         * subject present, body blank, nothing in the logs. Reproduced 2026-10-30 by
         * curling the endpoint on the production box - the template was present and
         * valid, the context complete, and the mail still arrived empty.
         *
         * It also explains why it looked intermittent and why staging was fine: it is a
         * network call per email, on a box whose egress is restricted.
         *
         * Local <style> is still inlined, so the template keeps the styling it carries
         * itself. The remote links were never reliable in email anyway - most clients
         * strip <link> - and a body that always arrives beats one that is sometimes
         * prettier.
         */
        adapter: new HandlebarsAdapter(undefined, {
          inlineCssOptions: { load_remote_stylesheets: false },
        }),
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
