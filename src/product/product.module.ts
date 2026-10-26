import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UsersModule } from 'src/users/users.module';
import { productController } from './product.controller';
import { FilteredStockSchema, ProductActivitySchema, ProductDetailsSchema, ProductScrapDetailSchema, StockHistorySchema, uuids, NonFilteredStockSchema, SuperSeededPartDetails, SerialNumberLogsSchema } from './product.model';
import { productService } from './product.service';
import { UserDetailsSchema } from 'src/users/users.model';
import { SettingSchema } from '../setting/setting.model';


@Module({
    imports: [ 
      ProductModule,
    UsersModule,

      MongooseModule.forFeature([{ name: 'ProductDetail', schema: ProductDetailsSchema }]),
      MongooseModule.forFeature([{ name: 'ProductActivityLog', schema: ProductActivitySchema }]),
      MongooseModule.forFeature([{ name: 'ProductScrapDetail', schema: ProductScrapDetailSchema }]),
      MongooseModule.forFeature([{ name: 'uuids', schema: uuids }]),
      MongooseModule.forFeature([{ name: 'SuperSeededPartDetails', schema: SuperSeededPartDetails }]),
      MongooseModule.forFeature([{ name: 'FilteredStock', schema: FilteredStockSchema }]),
      MongooseModule.forFeature([{ name: 'StockHistory', schema: StockHistorySchema }]),
      MongooseModule.forFeature([{ name: 'NonFilteredStock', schema: NonFilteredStockSchema }]),
      MongooseModule.forFeature([{ name: 'SerialNumberLogs', schema: SerialNumberLogsSchema }]),
      MongooseModule.forFeature([{ name: 'UserDetails', schema: UserDetailsSchema }]),
      MongooseModule.forFeature([{ name: 'Setting', schema: SettingSchema }])
    ],
    controllers: [productController],
    providers: [productService,
      {provide: APP_GUARD, useClass: JwtAuthGuard} ],
    exports:[productService]
  })
export class ProductModule {}
