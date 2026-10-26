import * as mongoose from 'mongoose';

export const UserDetailsSchema = new mongoose.Schema({
  mobilenumber: { type: String },
  profilepic: { type: String },
  devicetoken: { type: String },
  lname: { type: String },
  manufacturer: { type: String },
  appversion: { type: String },
  fcmtoken: { type: String },
  app_version_with_build: { type: String },
  email: { type: String },
  password: { type: String },
  jobTitle: { type: String },
  fname: { type: String },
  osversion: { type: String },
  devicetype: { type: Number },
  uniqueId: { type: String },
  providerName: { type: String },
  dob: { type: Number },
  location: { type: String },
  isProfileUpdated: { type: Boolean },
  countryCode: { type: String },
  gender: { type: Number },
  displayName: { type: String },
  createdDate: { type: Number },
  modifiedDate: { type: Number },
  status: { type: Number },
  adminId: { type: mongoose.Types.ObjectId, require: true, ref: "admindetail" }
});

export const AdminloginSchema = new mongoose.Schema({
  phone: { type: String },
  password: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  dateOfBirth: { type: Number },
  emailId: { type: String },
  gender: { type: String },
  role: { type: String },
  createdDate: { type: Number },
  modifiedDate: { type: Number }
});

export const UserRefreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, require: true, ref: "UserDetails" },
  refreshToken: { type: String },
  createdDate: { type: Number },
  modifiedDate: { type: Number }
});

import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";


export class MobileInputRequest {
  @ApiProperty()
  @IsString({ message: "Please enter 'key" })
  key: string;
}

export class UserTokenModel {
  @ApiProperty()
  @IsString({ message: "Please enter 'username" })
  username: string;
}
