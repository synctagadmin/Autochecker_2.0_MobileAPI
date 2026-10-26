import { BadRequestException, forwardRef, HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Console } from 'console';
import { Model } from 'mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import * as mongoose from 'mongoose';
import { AUTO_ERRORMSG, SPARK_NOTIFY } from 'src/util/constant';
import { BASE64String, getDate, getSuccess, randomString } from '../util/utils';

import { decryptData, encryptData } from '../util/utils';

import { SettingService } from 'src/setting/setting.service';

export type User = any;

@Injectable()
export class UsersService {

  constructor(
    @InjectModel('UserDetails') private readonly userDetails: Model<any>,
    @InjectModel('UserRefreshToken') private readonly userRefreshToken: Model<any>,
    @InjectModel('ProductDetail') private readonly ProductDetail: Model<any>,
    public SettingService: SettingService, private mailerService: MailerService
  ) { }

  async logInUser(userInfo: any) {
    let userDetails;

    var decrpyt = encryptData(userInfo.password);
    console.log('pwd', decrpyt, userInfo.password)

    userDetails = await this.userDetails.findOne({ password: decrpyt, email: userInfo.email });

    if (userDetails) {

      if (userDetails.status === 2)
        throw new HttpException(AUTO_ERRORMSG.USER_NOT_EXIST, HttpStatus.UNAUTHORIZED);


      await this.userDetails.updateOne({
        _id: userDetails._id,
      }, {
        status: 1,
        modifiedDate: getDate()
      }).exec();
      return await this.getUserProfile(userDetails);
    }
    else
      return null;


  }

  async logInAuth(userInfo: any) {
    let userDetails;

    console.log('userInfo', userInfo)
    userDetails = await this.userDetails.findOne({ _id: userInfo, status: { $in: [0, 1] } }).exec();

    if (userDetails)
      return await this.getUserProfile(userDetails);
    else
      return null;
  }



  async ValidateUser(userId: string) {
    console.log('ValidateUser', userId)

    if (userId === undefined) {
      console.log('Here', userId)
      throw await new HttpException(AUTO_ERRORMSG.USER_NOT_EXIST, HttpStatus.FORBIDDEN);
      // throw new BadRequestException(AUTO_ERRORMSG.POST_NOT_EXIST);
    }
    // 

    console.log('userId')
    let userProfilePic = await this.userDetails.findOne({ _id: userId, status: { $in: [0, 1] } })
      .select({ "_id": 1 }).exec();
    console.log('userId', userProfilePic)
    if (userId === undefined) {
      console.log('Here', userId)
      throw await new HttpException(AUTO_ERRORMSG.USER_NOT_EXIST, HttpStatus.FORBIDDEN);
      // throw new BadRequestException(AUTO_ERRORMSG.POST_NOT_EXIST);
    }
    if (userProfilePic === null)
      throw new HttpException(AUTO_ERRORMSG.USER_NOT_EXIST, HttpStatus.UNAUTHORIZED);
  }

  async refreshLoginToken(userId: any) {
    let socialuserinfo;
    try {
      socialuserinfo = await this.userRefreshToken.findOne({ userId: userId });
    } catch (error) {
      throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);
    }
    var refreshToken = BASE64String(25);
    if (socialuserinfo != null) {
       /** */ await this.userRefreshToken.findOneAndUpdate({ userId: userId }, {
      userId: userId,
      refreshToken: refreshToken,
      modifiedDate: getDate(),
    }).exec();
    } else {
      await this.userRefreshToken.create({
        refreshToken: refreshToken,
        userId: userId,
        createdDate: getDate(),
        modifiedDate: getDate()
      });
    }
    return {
      refreshToken: refreshToken,
      userId: userId,
    };
  }

  async refreshTokenUpdate(refreshModel: any) {
    let socialuserinfo;
    try {
      socialuserinfo = await this.userRefreshToken.findOne({ userId: refreshModel.userId, refreshToken: refreshModel.refreshToken });
    } catch (error) {
      throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);
    }
    var refreshToken = BASE64String(25);
    if (socialuserinfo != null) {
       /** */ await this.userRefreshToken.findOneAndUpdate({ userId: refreshModel.userId, refreshToken: refreshModel.refreshToken }, {
      userId: refreshModel.userId,
      refreshToken: refreshToken,
      modifiedDate: getDate(),
    }).exec();
    } else {
      throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_EXIST)
    }
    return {
      refreshToken: refreshToken,
      userId: refreshModel.userId,
    };
  }


  /***
   * Get Proflie 
   * Get Post timeline 
   */

  async findNFTUserDetails(userId: string) {
    let userDetails;

    try {

      userDetails = await this.userDetails.findOne({ _id: userId });

    } catch (error) {
      throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_EXIST);
    }
    console.log(userDetails.nft)
    const userdetailsData = {
      nft: userDetails.nft,
      monetize: userDetails.monetize,
      isKYC: userDetails.isKYC,
      isSkip: userDetails.isSkip,
      isAgree: userDetails.isAgree

    }
    return getSuccess(userdetailsData);
  }

  async updatePasswordDetails(userInfo: any, userId: string) {

    var new1 = await this.ValidateUser(userId);

    console.log('userInfo', userInfo, userId)
    let userDetails;
    var decrpyt = encryptData(userInfo.oldPassword);
    console.log('pwd', decrpyt, userInfo.oldPassword);
    userDetails = await this.userDetails.findOne({ password: decrpyt, _id: userId });
    if (userDetails) {
      await this.userDetails.findOneAndUpdate({ _id: userId }, {
        password: encryptData(userInfo.newPassword),
        modifiedDate: getDate()
      }).exec();
      return getSuccess(true)
    }
    else {
      throw new BadRequestException(AUTO_ERRORMSG.PWD_NOT_MATCH)
    }
  }

  async getAdminDetailEmail(data: any) {
    console.log(data, 'Id')
    var dataValue;
    var dataId = await this.userDetails.findOne({ email: data.emailId }).select({ "_id": 1, "fname": 1, "lname": 1, "password": 1, "email": 1, "mobilenumber": 1 }).exec();
    console.log(dataId, 'data')
    if (dataId != null) {
      var password = decryptData(dataId.password);
      await this.mailerService.sendMail({
        to: dataId.email,
        subject: 'Forget Password Credentials',
        template: './confirmation',
        context: {
          name: dataId.fname,
          Username: dataId.email,
          Password: password,
          // urlLink:process.env.
        },
      });
      dataValue = AUTO_ERRORMSG.EMAIL_SEND
    }
    else {
      throw new BadRequestException(AUTO_ERRORMSG.EMAIL_NOT_MATCH);
    }

    console.log(dataValue, 'dataVlaue')
    return getSuccess(dataValue);
  }
  async findUserDetails(userId: string) {

    var new1 = await this.ValidateUser(userId);
    console.log('hi', new1);
    let userDetails;
    try {
      userDetails = await this.userDetails.findOne({ _id: userId }).select({ "fname": 1, "lname": 1, "profilepic": 1, "jobTitle": 1, "mobilenumber": 1, "countryCode": 1, "email": 1 });

    } catch (error) {
      throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_EXIST);
    }
    if (!userDetails) {
      throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_EXIST);

    }
    let data = {
      fname: userDetails.fname,
      lname: userDetails.lname,
      email: userDetails.email,
      profilepic: userDetails.profilepic,
      jobTitle: userDetails.jobTitle,
      mobilenumber: userDetails.mobilenumber,
      countryCode: userDetails.countryCode
    }
    return getSuccess(data)
  }


  async updateUserDetails(userInfo: any, userId: string) {

    var new1 = await this.ValidateUser(userId);
    console.log('userInfo', userInfo)

    console.log('userId', userId)

    if (userInfo.countryCode === null || userInfo.countryCode === '')
      throw new BadRequestException(AUTO_ERRORMSG.COUNTRY_CODE);

    await this.userDetails.findOneAndUpdate({ _id: userId }, {
      profilepic: userInfo.profilepic,
      fname: userInfo.fname,
      lname: userInfo.lname,
      displayName: userInfo.fname + ' ' + userInfo.lname,
      isProfileUpdated: true,
      modifiedDate: getDate(),
      jobTitle: userInfo.jobTitle

    }).exec();

    let userDetails = await this.userDetails.findById({ _id: userId }).select({ "fname": 1, "lname": 1, "profilepic": 1, "jobTitle": 1, "mobilenumber": 1, "countryCode": 1 });

    await this.ProductDetail.updateMany({ userId: userId }, {
      userName: userDetails.fname + ' ' + userDetails.lname,
    }).exec();


    let data = {
      fname: userDetails.fname,
      lname: userDetails.lname,
      profilepic: userDetails.profilepic,
      jobTitle: userDetails.jobTitle,
      mobilenumber: userDetails.mobilenumber,
      countryCode: userDetails.countryCode
    }
    return getSuccess(data)
  }

  private getUserProfile(userDetails: any) {

    const userdetails = {
      mobilenumber: userDetails.mobilenumber,
      profilepic: userDetails.profilepic,
      email: userDetails.email,
      fname: userDetails.fname,
      lname: userDetails.lname,
      location: userDetails.location,
      gender: userDetails.gender,
      countryCode: userDetails.countryCode,
      dob: userDetails.dob,
      userId: userDetails._id,
      isProfileUpdated: userDetails.isProfileUpdated,
      jobTitle: userDetails.jobTitle,
      adminId: userDetails.adminId,
      displayName: userDetails.displayName

    }


    console.log(userdetails)
    return userdetails;
  }


  /**
   * TODO//:Post details update display name and pic
   * TODO//:Clap details update display name and pic
   * TODO//:View details update display name and pic
   * TODO//:Thread details update display name and pic
   * TODO//:Connections details update display name and pic
   * @param userInfo 
   * @param userId 
   * @param socialUserId 
   */
  async updateUser(userInfo: any, userId: string, socialUserId: string) {
    if (userInfo.countryCode === null || userInfo.countryCode === '')
      throw new BadRequestException(AUTO_ERRORMSG.COUNTRY_CODE);

    await this.userDetails.findOneAndUpdate({ _id: userId }, {
      osversion: userInfo.osversion,
      //isVerified: userInfo.isVerified,
      manufacturer: userInfo.manufacturer,
      fcmtoken: userInfo.fcmtoken,
      app_version_with_build: userInfo.app_version_with_build,
      devicetype: userInfo.devicetype,
      appversion: userInfo.appversion,
      // countryCode: userInfo.countryCode,
      devicetoken: userInfo.devicetoken,
      modifiedDate: getDate(),
    }).exec();


  }




  async logOut(userId: string) {
    // let userdetails = await this.userDetails.findById({ _id: userId });
    // if (userdetails != null)
    //   return getSuccess(true);
    // else
    console.log('logout', userId)
    return getSuccess(true);
  }

  async isApproedUpdate(userId: string, approvedBy: string, approvedbyName: string) {

    await this.userDetails.updateOne({
      _id: userId,
    }, {
      IsApproved: true,
      Approvedby: approvedBy,
      ApprovedDate: getDate(),
      modifiedDate: getDate()
    }).exec();
    return true;
  }




  async AccountDelete(userId: string) {
    console.log('userId', userId)

    await this.ValidateUser(userId);


    let user = await this.userDetails
      .findOne({ _id: userId })
      .exec();

    console.log('adta', user)
    if (user != null) {
      if (user.monetize == 1)
        throw await new HttpException("Please contact us at info@sparkme.app", HttpStatus.BAD_REQUEST);

      //  await this.socialUserInfo.deleteMany({ userId: user._id }).exec();
      await this.userDetails.deleteOne({ _id: user._id }).exec();
      await this.userRefreshToken.deleteOne({ userId: user._id });
      return getSuccess(true);
    }

    return getSuccess(false);

  }





  async getUserProfileBase(userId) {
    let userProfilePic = await this.userDetails.findById({ _id: userId, IsApproved: true, isProfileUpdated: true })
      .select({ "lname": 1, "fname": 1, "gender": 1, "profilepic": 1, "clapCount": 1, "viewCount": 1, "threadCount": 1, "connectionCount": 1 });

    if (userProfilePic === null)
      throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_EXIST);

    return {
      profilepic: userProfilePic.profilepic,
      fname: userProfilePic.fname,
      lname: userProfilePic.lname,
      gender: userProfilePic.gender,
      clapCount: userProfilePic.clapCount,
      viewCount: userProfilePic.viewCount,
      threadCount: userProfilePic.threadCount,
      connectionCount: userProfilePic.connectionCount,
    }
  }




  async getTokenId(userID: string) {
    let userDetails;
    try {
      userDetails = await this.userDetails.findOne({ _id: userID }).select({
        "_id": 1, "fcmtoken": 1, "displayName": 1, "devicetype": 1, "gender": 1,
        "profilepic": 1
      });;

    } catch (error) {
      throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);
    } return userDetails;
  }




}




