import { Body, Controller, Get, Param, Post, UseFilters, UsePipes, ValidationPipe, } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { decryptData, encryptData } from '../util/utils';
  
import { SettingService } from './setting.service';


@Controller('setting')
@ApiTags('setting')
export class SettingController {
  constructor(private readonly settingService: SettingService) { }  

  @Get('id/:Type')
  async getSetting(@Param('Type') type: Number) {
    var loginresponse = await this.settingService.findSetting(type);
    return encryptData(JSON.stringify(loginresponse));
  }

  
  @Get('brandList')
  async BrandList() {
    var loginresponse = await this.settingService.BrandListView();
    return encryptData(JSON.stringify(loginresponse));
  }


  @Get()
  async getExcelSetting() {
    var loginresponse = await this.settingService.ExcelUpload();
    return encryptData(JSON.stringify(loginresponse));
  }
}
