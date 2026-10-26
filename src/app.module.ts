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



@Module({
  imports: [MongooseModule.forRoot('mongodb+srv://autocheckerprod:sd0VWCN8F8QG889m@autopartscheckerprod.1me3yhq.mongodb.net/autocheckerpartsclonenew'),
  
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
