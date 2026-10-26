import { Controller, Request, Post, UseGuards, Body, Get, Param, BadRequestException, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileInputRequest, UserTokenModel } from 'src/users/users.model';
import { LOADER_KEY, AUTO_ERRORMSG } from 'src/util/constant';
import { decryptData, encryptData } from 'src/util/utils';
import { LoadService } from './load.service';
@Controller('load')
@ApiTags('load')
export class LoadController {
  constructor(public loadService: LoadService) { }



  // search product list
  @Get('brandSearchList/:key')
  async getSearchList(@Param('key') key: string) {
    if (LOADER_KEY.KEY != key)
      throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
    let brandLists = await this.loadService.getSearchList();
    console.log(brandLists, 'brandLists')
    console.log("line no 21");
    return brandLists
  }

   // search product list
   @Get('scrapMinusOne/:key')
   async getScrapForMinusOne(@Param('key') key: string) {
     if (LOADER_KEY.KEY != key)
       throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
     let brandLists = await this.loadService.getSearchList('minusOne');
     console.log(brandLists, 'brandLists')
     return brandLists
 
   }

  // @Get('loadContact/:key')
  // async loadContact(@Param('key') key: string) {

  //   if (LOADER_KEY.KEY != key)
  //     throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)

  //   var loginresponse = await this.loadService.loadContact();

  //   return encryptData(JSON.stringify(loginresponse));
  // }


  // @Get('loadPostMedia/:key')
  // async loadPostMedia(@Param('key') key: string) {
  //   if (LOADER_KEY.KEY != key)
  //     throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
  //   var loginresponse = await this.loadService.postMedialoader();
  //   return encryptData(JSON.stringify(loginresponse));
  // }



  // @Get('loaderreveal/:key')
  // async loaderreveal(@Param('key') key: string) {
  //   if (LOADER_KEY.KEY != key)
  //     throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
  //   var loginresponse = await this.loadService.loaderreveal();
  //   return encryptData(JSON.stringify(loginresponse));
  // }


  // @Post('delete/:key')
  // async delete(@Param('key') key: string, @Body() userTokenModel: UserTokenModel) {
  //   if (LOADER_KEY.KEY != key)
  //     throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
  //   var loginresponse = await this.loadService.delete(userTokenModel.username);
  //   return encryptData(JSON.stringify(loginresponse));
  // }


  @Get('UpdatePost/:key')
  async UpdatePost() {

    var loginresponse = await this.loadService.UpdatePost();
    return encryptData(JSON.stringify(loginresponse));
  }

  @Get('NEwUpdate')
  async NewUpdatePost() {

    var loginresponse = await this.loadService.NewUpdatePost();
    return encryptData(JSON.stringify(loginresponse));
  }



  // @Get('clapCountCheck/:key')
  // async ClapCountCheck(@Param('key') key: string) {
  //   if (LOADER_KEY.KEY != key)
  //     throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
  //   var loginresponse = await this.loadService.clapCountCheck(key);
  //   return encryptData(JSON.stringify(loginresponse));
  // }



  @Post('webhook/:key')
  async webhook() {
    const url = 'https://www.wholesalehyundaiparts.com/p/Hyundai__/PANEL---ROOF-Roof-panel-Panel-used-for-the-roof-WO-SUNROOF/13457246/67111J0000.html';

    //if (LOADER_KEY.KEY != key)
    //  throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
    var loginresponse = await this.loadService.webhook(url);
    return encryptData(JSON.stringify(loginresponse));
  }

  // @Get('generalUpdate/:key')
  // async generalUpdate(@Param('key') key: string) {
  //   if (LOADER_KEY.KEY != key)
  //     throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
  //   var loginresponse = await this.loadService.generalUpdate(key);
  //   return encryptData(JSON.stringify(loginresponse));
  // }

  // @Post('monetizeWebhook')
  // async MonetizeWebhook(@Body() req) {
  //     return encryptData(JSON.stringify(await this.loadService.saveMonetizeWebHookData(req)))
  // }

}