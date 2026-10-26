import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AUTO_ERRORMSG } from 'src/util/constant';
import { getDate, getSuccess } from '../util/utils';
import { Setting } from './setting.model';
const reader = require('xlsx')


@Injectable()
export class SettingService {
  constructor(
    @InjectModel('Setting') private readonly settingModel: Model<Setting>,
    @InjectModel('WebsiteList') private readonly WebsiteSetting: Model<any>,
    @InjectModel('ItemTypeList') private readonly ItemType: Model<any>,
  ) { }



  async findSetting(type: Number) {
    let setting;

    try {
      setting = await this.settingModel.findOne({ Type: type });
    } catch (error) {
      throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);
    }
    if (!setting) {
      throw new BadRequestException('Setting not avaiable');
    }

    var result =
    {
      Type: setting.Type,
      Name: setting.Name,
      GooglePlayKey: setting.GooglePlayKey,
      BlobURL: setting.BlobURL,
      BlobContainerName: setting.BlobContainerName,
      BlobConnection: setting.BlobConnection,
      ContactMail: setting.ContactMail,
      PrivacyURL: setting.PrivacyURL,
      TermsURL: setting.TermsURL,
      VersionInfo: setting.VersionInfo,
      OtherInfo: setting.OtherInfo,
      AWSAccessKey: setting.AWSAccessKey,
      AWSSecretKey: setting.AWSSecretKey,
      AWSRegion: setting.AWSRegion,
      OCRAccountUsage: setting.OCRAccountUsage
    }
    return getSuccess(result);
  }
  async ExcelUpload() {

    const file = reader.readFile('./newEbay.xlsx')



    // 👇️️ {'key0': 'zero', 'key1': 'one', 'key2': 'two'}

    let data = []

    const sheets = file.SheetNames

    for (let i = 0; i < sheets.length; i++) {
      const temp = reader.utils.sheet_to_json(
        file.Sheets[file.SheetNames[i]])
      temp.forEach((res) => {
        // console.log(res.Value)
        if (res.Id != undefined) {
          // var user = await this.WebsiteSetting.create({
          //   Id: res.Id,
          //   Name: res.Name,
          //   Level: res.Level,
          //   Website: res.Website,
          //   AlterWebsite1: res.AlterWebsite,
          //   AlterWebsite2: res.AlterWebsite2,
          //   IsScrap: res.IsScrap,
          //   Value: res.Value,
          //   createdDate: getDate(),
          //   modifiedDate: getDate()
          // });
          // const arr = res.Value;
          //  console.log(arr)
          // const obj3 = {};

          // await arr.forEach(async (element, index) => {
          //   obj3['name'] = element;
          // });

          // console.log(res.Value)
          // let str = ["Serpentine Belt", "Toothed Belt", "V-Belt"];
          // console.log(str)
          // let output2 = str.map(item => ({ name: item }));
          // console.log(output2)
          res.Value2 = JSON.parse(res.Value);
          //console.log(res.Id)
          data.push(res)
        }
      })
    }

    await data.forEach(async (element, index) => {
      console.log(element)
      console.log(element.Id, element.Name, element.Value2)
      let output2 = element.Value2.map(item => ({ name: item }));
      console.log(output2)
      var user = this.ItemType.create({
        Id: element.Id,
        Name: element.Name,
        Value: output2,
        createdDate: getDate(),
        modifiedDate: getDate()
      });
    });


  }
  async BrandList() {
    let setting = [];
    try {
      setting = await this.WebsiteSetting
        .find({ IsScrap: 1 }).select({ "Name": 1, "Value": 1 })
        .exec();
      return setting;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async BrandListView() {
    let setting = [];
    let list = [];
    console.log('setting');
    try {
      setting = await this.WebsiteSetting
        .find()
        .exec();


    } catch (error) {
      throw new BadRequestException(error);
    }
    if (!setting) {
      throw new BadRequestException('website Setting not avaiable');
    }


    await Promise.all(setting.map(async (element, index) => {
      // tagDetails.forEach(element => {
      list.push({
        Id: element.Id,
        Name: element.Name
      })
    }));

    var result = await list.sort(function (a, b) {
      a = a.Name.toLowerCase();
      b = b.Name.toLowerCase();
      if (a == b) return 0;
      return a < b ? -1 : 1;
    });

    return getSuccess(result);
  }
}