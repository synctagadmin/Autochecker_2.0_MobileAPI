import { Module } from '@nestjs/common';
import { LoadService } from './load.service';
import { LoadController } from './load.controller';
import { UserDetailsSchema, UserRefreshTokenSchema,  } 
from 'src/users/users.model';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import { ProductDetailsSchema, ProducteBayDataSchema, ProductScrapDetailSchema, SuperSeededPartDetails } from 'src/product/product.model';
import { ProductModule } from 'src/product/product.module';
import { SettingModule } from 'src/setting/setting.module';
import { WebsiteSettingSchema } from 'src/setting/setting.model';




@Module({
    imports: [
        ProductModule,
        LoadModule,
        SettingModule,
        MongooseModule.forFeature([{ name: 'UserRefreshToken', schema: UserRefreshTokenSchema }]),
        MongooseModule.forFeature([{ name: 'WebsiteList', schema: WebsiteSettingSchema }]),
        MongooseModule.forFeature([{ name: 'UserDetails', schema: UserDetailsSchema }]),
        MongooseModule.forFeature([{ name: 'WebsiteList', schema: WebsiteSettingSchema }]),
        MongooseModule.forFeature([{ name: 'ProductDetail', schema: ProductDetailsSchema }]),
        MongooseModule.forFeature([{ name: 'EbayListingData', schema: ProducteBayDataSchema }]),
        MongooseModule.forFeature([{ name: 'ProductScrapDetail', schema: ProductScrapDetailSchema }]),
        MongooseModule.forFeature([{ name: 'SuperSeededPartDetails', schema: SuperSeededPartDetails }]),
    ],
    controllers: [LoadController],
    providers: [LoadService,
    ],

})
export class LoadModule { }
