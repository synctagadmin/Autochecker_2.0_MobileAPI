import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from 'src/auth/auth.service';
import { MobileInputRequest, UserTokenModel } from 'src/users/users.model';
import { decryptData, encryptData } from '../util/utils';
 


@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(public authService: AuthService) { }
  @Post('login')
  async login(@Body() userDetailsDto: MobileInputRequest) {   
    var loginresponse = await this.authService.login(JSON.parse(decryptData(userDetailsDto.key)));
    return encryptData(JSON.stringify(loginresponse));
  }


  @Post('refresh')
  async refresh(@Body() userDetailsDto: MobileInputRequest) {
    var loginresponse = await this.authService.refresh(JSON.parse(decryptData(userDetailsDto.key)));
    return encryptData(JSON.stringify(loginresponse));
  }


}