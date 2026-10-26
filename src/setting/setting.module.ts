import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingController } from './setting.controller';
import { ItemTypeSettingSchema, SettingSchema, WebsiteSettingSchema } from './setting.model';
import { SettingService } from './setting.service';

@Module({
    imports: [      
        MongooseModule.forFeature([{ name: 'Setting', schema: SettingSchema }]),
        MongooseModule.forFeature([{ name: 'WebsiteList', schema: WebsiteSettingSchema }]),
        MongooseModule.forFeature([{ name: 'ItemTypeList', schema: ItemTypeSettingSchema }])
      ],
      controllers: [SettingController],
  providers: [SettingService],
  exports: [SettingService]
})
export class SettingModule {}
