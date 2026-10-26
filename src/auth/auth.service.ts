import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { getSuccess } from '../util/utils';
import { AUTO_ERRORMSG } from 'src/util/constant';

@Injectable()
export class AuthService {
  constructor(

    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,) { }

  async validateUser(userInfo: any) {

    console.log('userInfo', userInfo)

    const user = await this.usersService.logInAuth(userInfo);
    if (user) {
      return user;
    }
    return null;
  }

  async login(userInfo: any) {
    console.log('userInfo', userInfo)
    var result = await this.usersService.logInUser(userInfo);

    if (result) {
      var refresh = await this.usersService.refreshLoginToken(result.userId);
      const payload = { userId: result.userId };
      console.log(result.countryCode)
      const resultData = {
        accessToken: await this.jwtService.sign(payload, {
          expiresIn: 8592000
        }),
        mobilenumber: result.mobilenumber,
        profilepic: result.profilepic,
        email: result.email,
        userId: result.userId,
        fname: result.fname,
        lname: result.lname,
        isProfileUpdated: result.isProfileUpdated,
        refreshToken: refresh.refreshToken,
        countryCode: result.countryCode,
        location: result.location,
        gender: result.gender,
        dob: result.dob,
        jobTitle: result.jobTitle
      };


      console.log(result.userId, resultData.accessToken, resultData.refreshToken)

      return getSuccess(resultData);
    }
    else
      throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_MATCH)
  }


  async refresh(refreshModel: any) {
    var result = await this.usersService.refreshTokenUpdate(refreshModel);
    if (result) {
      const payload = { userId: result.userId };
      const resultData = {
        accessToken: await this.jwtService.sign(payload),
        refreshModel: result.refreshToken,
      };
      return getSuccess(resultData);
    }
  }
}