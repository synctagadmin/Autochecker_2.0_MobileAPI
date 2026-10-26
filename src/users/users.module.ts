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
        dir: './src/users/templates',
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
