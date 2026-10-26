import * as mongoose from 'mongoose';

export const SettingSchema = new mongoose.Schema({
  Type: { type: Number, required: 'Please enter your MobileType', },
  Name: { type: String, required: true },
  GooglePlayKey: { type: String, required: true },
  BlobURL: { type: String, required: true },
  BlobContainerName: { type: String, required: true },
  BlobConnection: { type: String, required: true },
  ContactMail: { type: String, required: true },
  PrivacyURL: { type: String, required: true },
  TermsURL: { type: String, required: true },
  VersionInfo: { type: Object, required: true },

  OtherInfo: { type: Object, required: true },

  AWSAccessKey: { type: String },
  AWSSecretKey: { type: String },
  AWSRegion: { type: String },
  // 1 - Google Vision, 2 - AWS
  OCRAccountUsage: { type: Number, default: 1 },



});


export const WebsiteSettingSchema = new mongoose.Schema({
  Id: { type: Number },
  Name: { type: String },
  Level: { type: Number },
  Website: { type: String },
  AlterWebsite1: { type: String },
  AlterWebsite2: { type: String },
  IsScrap: { type: Number },
  Value: { type: String },
  createdDate: { type: Number },
  modifiedDate: { type: Number }
});

export const ItemTypeSettingSchema = new mongoose.Schema({
  Id: { type: Number },
  Name: { type: String },
  Value: { type: Array },
  createdDate: { type: Number },
  modifiedDate: { type: Number }
});



export interface Setting extends mongoose.Document {
  id: string;
  Type: Number;
  Name: string;
  GooglePlayKey: string;
}






