import { Controller, Request, Post, UseGuards, Body, Get, Param, Delete, BadRequestException, UnauthorizedException } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LOADER_KEY, AUTO_ERRORMSG } from 'src/util/constant';

import { decryptData, encryptData } from '../util/utils';
import { MobileInputRequest } from './users.model';
import { UsersService } from './users.service';

@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
export class UsersController {
  constructor(public usersService: UsersService) { }
  @UseGuards(JwtAuthGuard)

  @Get('profile')
  async getProfile(@Request() req) {
    if (req.user.userId == undefined) {
      throw new UnauthorizedException("Unauthorized")
    } else {
      var resultProfile = await this.usersService.findUserDetails(req.user.userId);
      return encryptData(JSON.stringify(resultProfile));
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('updateprofile')
  async updateProfile(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
    if (req.user.userId == undefined) {
      throw new UnauthorizedException("Unauthorized")
    } else {
      const profileUpdateModel = JSON.parse(decryptData(userDetailsDto.key));
      return encryptData(JSON.stringify(await this.usersService.updateUserDetails(profileUpdateModel, req.user.userId)));
    }
  }
  /**
   * 
   * @param userDetailsDto 
   * @returns 
   */
  /***/
  @UseGuards(JwtAuthGuard)
  @Post('changePassword')
  async ChangePassword(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
    if (req.user.userId == undefined) {
      throw new UnauthorizedException("Unauthorized")
    } else {
      const profileUpdateModel = JSON.parse(decryptData(userDetailsDto.key));
      var resultProfile = await this.usersService.updatePasswordDetails(profileUpdateModel, req.user.userId);
      return encryptData(JSON.stringify(resultProfile));
    }
  }

  @Post('forgetPassword')
  async getAdminDetailEmail(@Body() userDetailsDto: MobileInputRequest) {


    const profileUpdateModel = JSON.parse(decryptData(userDetailsDto.key));
    var resultProfile = await this.usersService.getAdminDetailEmail(profileUpdateModel);
    return encryptData(JSON.stringify(resultProfile));

  }


  @UseGuards(JwtAuthGuard)
  @Get('logOut')
  async logOut(@Request() req) {
    //return JSON.stringify(await this.usersService.globalSearch(req.user.userId,searchText))
    return encryptData(JSON.stringify(await this.usersService.logOut(req.user.userId)))
  }



}




