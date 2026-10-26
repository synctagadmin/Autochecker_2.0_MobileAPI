import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Console } from 'console';
//const puppeteer = require('puppeteer');
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { AUTO_ERRORMSG, SPARK_NOTIFY } from 'src/util/constant';
import { decryptData, encryptData, encryptDataAccount, getDate, getSuccess } from 'src/util/utils';
import * as dotenv from 'dotenv';
import { productService } from 'src/product/product.service';
import { SettingService } from 'src/setting/setting.service';
var fs = require('fs');
dotenv.config();
//jaleel babu
const axios = require('axios');
@Injectable()
export class LoadService {
  constructor(
    @InjectModel('UserDetails') private readonly userDetails: Model<any>,
    @InjectModel('ProductDetail') private readonly ProductDetails: Model<any>,
    @InjectModel('WebsiteList') private readonly WebsiteSetting: Model<any>,
    @InjectModel('SuperSeededPartDetails') private readonly superSeededPartDetails: Model<any>,
    @InjectModel('EbayListingData') private readonly ebayListingData: Model<any>,
    @InjectModel('ProductScrapDetail') private readonly ProductScrapDetail: Model<any>,
    public readonly ProductService: productService,
    public readonly settingService: SettingService,
  ) { }


  async getSearchList(status?) {
    try {
      var postresponse = await this.ProductService.postRequest(status);
      console.log('postresponse: ', postresponse);
      var settingresponse = await this.settingService.BrandList();
      //await Promise.all(postresponse.map(async (value, index) => {

      //  postresponse.forEach(async (value) => {
      //
      await postresponse.reduce(async (a, value) => {
        let getUrl = settingresponse.find(x => x.Name == value.partMake);
        console.log('getUrl: ', getUrl);
        if (getUrl != undefined) {
          console.log('value.partNumberTrim: ', value.partMake, value.partNumberTrim);

          let ifSuperSedeedExist = await this.ProductService.superSeededPartDetailsList(value.partNumberTrim);
          console.log('ifSuperSedeedExist: ', ifSuperSedeedExist);

          if (ifSuperSedeedExist != null) {
            let postclapLists = await this.ProductScrapDetail.findOne({ partNumber: ifSuperSedeedExist.BasePart, brand: value.partMake })
            console.log('scrapExist: ', postclapLists);

            if (postclapLists != null) {

              console.log('postclapLists: ', ifSuperSedeedExist, postclapLists);
              // var user = await this.ProductScrapDetail.create({
              //   status: 2,
              //   brand: value.partMake,
              //   OtherData: postclapLists.OtherData,
              //   partNumber: value.partNumberTrim.replace(/-|_|\s/g, "").trim(),
              //   createdDate: getDate(),
              //   modifiedDate: getDate()
              // });
              await this.ProductDetails.updateMany({
                partNumberTrim: value.partNumberTrim,
                partMake: value.partMake
              }, {
                partNumberBase: ifSuperSedeedExist.BasePart,
                isLoadStatus: 1,
                modifiedDate: getDate(),
                loadedDate: getDate()
              });

            }
            else {
              console.log('IF', postclapLists, value.partNumberTrim);
              await this.getScrapValue(getUrl.Value, value.partNumberTrim).then(async (data) => {
                let encrypt = encryptDataAccount(data);
                console.log(data);
                if (!data || data == undefined || data == null || (data && data.ListingDetails.Title == 'NA') || encrypt.length < 576) {
                  if (this.containsOnlyAlphabets(value.partNumberTrim.substring(value.partNumberTrim.length - 2))) {
                    let trimedPartNumber = value.partNumberTrim.substring(0, value.partNumberTrim.length - 2);
                    data = await this.getScrapValue(getUrl.Value, trimedPartNumber);
                  }
                }
                await this.ProductService.saveScrap(data, value.partMake, value.partNumberTrim, status);
                //=> boop
              });;
            }

          }
          else {
            let scrapExist = await this.ProductService.postRequestFindByPart(value.partMake, value.partNumberTrim);
            console.log('scrapExist: ', scrapExist);
            if(scrapExist == 0 && this.containsOnlyAlphabets(value.partNumberTrim.substring(value.partNumberTrim.length-2))){
              let colorSkippedPart = value.partNumberTrim.substring(0,value.partNumberTrim.length-2)
              scrapExist = await this.ProductScrapDetail.find({
                  partNumber: new RegExp(`^${colorSkippedPart}[A-Za-z]{2}$`, "i")
              }).count()
              if(scrapExist > 0){
                let sameColorPart = await this.ProductScrapDetail.findOne({
                    partNumber: new RegExp(`^${colorSkippedPart}[A-Za-z]{2}$`, "i")
                }).sort({createdDate:-1});
                let sameColorExistscrapData = decryptData(sameColorPart.OtherData)
                await this.ProductService.saveScrap(sameColorExistscrapData,value.partMake,value.partNumberTrim,status)
                await this.scrapPrepossing(value.partNumberTrim, sameColorExistscrapData);
              }
            }
            if (scrapExist == 0) {
              console.log('IF', scrapExist, value.partNumberTrim);
              await this.getScrapValue(getUrl.Value, value.partNumberTrim).then(async (data) => {
                console.log(data);
                let encrypt = encryptDataAccount(data);
                if (!data || data == undefined || data == null || (data && data.ListingDetails.Title == 'NA') || encrypt.length < 576) {
                  if (this.containsOnlyAlphabets(value.partNumberTrim.substring(value.partNumberTrim.length - 2))) {
                    let trimedPartNumber = value.partNumberTrim.substring(0, value.partNumberTrim.length - 2);
                    data = await this.getScrapValue(getUrl.Value, trimedPartNumber);
                  }
                }
                await this.ProductService.saveScrap(data, value.partMake, value.partNumberTrim, status);
                await this.scrapPrepossing(value.partNumberTrim, data);
                //=> boop
              });
            }
            else if (scrapExist >= 1) {
              // console.log('ELSE: ', scrapExist, value.isLoadStatus);
              await this.ProductService.prodScrapUpdate(value.partMake, value.partNumberTrim);
            }
          }
        }
        else {
          // getUrl is undefined when this part's brand is not in BrandList(), which returns
          // only websitelists rows with IsScrap: 1. There is no scraper URL for it and there
          // will not be one until the brand is re-enabled, so retrying can never succeed.
          //
          // Until now the part was skipped in SILENCE - no status write, no log. postRequest
          // selects isLoadStatus { $in: [0, -1] } with $limit: 1, so with nothing written the
          // SAME part came back every three minutes for ever and nothing else in the queue was
          // ever reached. Observed stuck on 8971359482 (Isuzu, IsScrap: 0); Isuzu is the one
          // disabled brand missing from postRequest's hardcoded $nin list, which is how it
          // gets selected in the first place.
          //
          // -2 rather than -1: brandSearchList selects -1 as well, so -1 would leave the part
          // in the very pool it was just drawn from and change nothing. -2 appears in neither
          // selector, and the dashboard already renders it as "Can't able to search"
          // (AdminUI default.component.ts, IsloadedStatusData), which is exactly what it is.
          console.warn('SCRAPE_SKIPPED_BRAND_DISABLED', {
            partNumber: value.partNumberTrim,
            brand: value.partMake
          });
          await this.ProductDetails.updateMany({
            partNumberTrim: value.partNumberTrim,
            partMake: value.partMake
          }, {
            isLoadStatus: -2,
            modifiedDate: getDate()
          });
        }
        await a;
      }, Promise.resolve());
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  containsOnlyAlphabets(str) {
    return /^[a-zA-Z]+$/.test(str);
  }

  async scrapPrepossing(partNumber: string, data: any) {

    console.log('getPriceValueData', data);

    let decryptValue = data;
    console.log('decryptValue', decryptValue && decryptValue.ListingDetails && decryptValue.ListingDetails.Supersession ? (decryptValue.ListingDetails.Supersession.replace(/-|_|\s/g, "").trim(), partNumber) : 'Invalid decrypt Value');
    if (decryptValue && decryptValue.ListingDetails && decryptValue.ListingDetails.Supersession.replace(/-|_|\s/g, "").trim() != "NA") {
      let dataValue = await this.superSeededPartDetails.create({
        BasePart: partNumber,
        SuperSeedList: decryptValue.ListingDetails.Supersession.replace(/-|_|\s/g, "").trim(),
        createdDate: getDate(),
        modifiedDate: getDate()

      });
      await this.ProductScrapDetail.updateMany({ partNumber: partNumber }, { $set: { status: 2, modifiedDate: getDate() } });
    }
    else {
      await this.ProductScrapDetail.updateMany({ partNumber: partNumber }, { $set: { status: -1, modifiedDate: getDate() } });
    }

  }

  /**
   * Base URL of the scraper service, with a guaranteed trailing slash.
   *
   * Set SCRAPER_URL per environment (same variable name AdminAPI uses). The default is the
   * AWS scraper-v2 box, which nginx fronts with TLS on behalf of its :3050 listener.
   *
   * This used to be hard-coded to the retired Azure scrapers on :3000 -
   * http://20.204.137.250:3000/ (staging) and http://20.7.146.191:3000/ (production).
   * Both the old service and scraper-v2 answer the same /get<Brand>?id=<partNumber> shape,
   * so only the host changes here.
   */
  private scraperBase(): string {
    const raw = process.env.SCRAPER_URL || 'https://scrapernew.autochecker.com/';
    return raw.endsWith('/') ? raw : raw + '/';
  }

  async getScrapValue(data: string, partNumber: string) {
    if (data == 'getAlfaRomeo') {
      data = 'getDodge';
    }
    return await axios.get(this.scraperBase() + data + '?id=' + partNumber)
      .then(async (res) => {
        // console.log(`Status: ${res.status}`);
        console.log('Body: ', res.data);
        if (partNumber.startsWith('0')) {
          if (!res.data.ListingDetails.PartNumber.startsWith('0') && partNumber.substring(1) == res.data.ListingDetails.PartNumber) {
            res.data.ListingDetails.PartNumber = partNumber;
          }
        }
        return await res.data;
      }).catch((err) => {
        console.error(err.statusMessage);
      });
  }

  async loadContact() {
    console.log('userDetails');
    let userDetails = await this.userDetails.find({
      IsApproved: true,
    });

    userDetails.forEach(async (user) => {
      console.log('userDetails', user.mobilenumber);




    });
  }

  async postMedialoader() {
    const storageName: string = process.env.STORAGECONTAINERNAME as string;

  }

  async loaderForSyncContactChanges() {


  }
  async loaderreveal() {
    console.log('contactSync');


  }

  async UpdatePost() {


    const postclapLists = await this.ProductDetails.find({}).select({ "partNumber": 1, "partMake": 1 }).exec();

    // let value = "GD7B-76-201A";
    postclapLists.forEach(async (value) => {
      console.log('value1', value.partNumber)
      if (value.partMake == 'Dodge' || value.partMake == 'Mitsubishi') {
        if (value.partNumber.length > 11) {
          let data = value.partNumber.replace(/-001|001|1-|-|\s/g, "").trim()
          console.log('partNumber2', data)

          this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
            partNumberTrim: data
          }).exec();
          // let newdata = data.split('|');
          // console.log('data', newdata.length);
          // if (newdata.length <= 2) {
          //   for (var i = 0; i < newdata.length; i++) {
          //     if (newdata[i].length >= 10) {
          //       console.log('value', newdata[i], data, value)
          //       this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
          //         partNumberTrim: newdata[i]
          //       }).exec();
          //     }
          //     // else {
          //     //   console.log('partNumber',newdata[i], value.partNumber.replace(/-|_|\s/g, "").trim())
          //     //   this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
          //     //     partNumberTrim: value.partNumber.replace(/-|_|\s/g, "").trim()

          //     //   });
          //     // }
          //   }
          // }
          // else {
          //   console.log('partNumber1', value.partNumber.replace(/-|_|\s/g, "").trim())
          //   this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
          //     partNumberTrim: value.partNumber.replace(/-|_|\s/g, "").trim()

          //   });
          // }
        }
        else {
          let data = value.partNumber.replace(/-001|001|1-|-|_|\s/g, "").trim()
          console.log('partNumber2', data)
          this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
            partNumberTrim: data
          }).exec();
        }
      }
      else {
        let data = value.partNumber.replace(/-001|001|1-|-|_|\s/g, "").trim()
        console.log('partNumber2', data)
        this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
          partNumberTrim: data

        }).exec();
      }


    });

    // });

    //var postresponse = await this.ProductService.delete();
    // this.ProductScrapDetail.deleteMany().exec();
    // this.ProductDetails.updateMany({ condition: 'AFTERMARKET' }, {
    //   conditionId: 7000, condition: 'Aftermarket'
    // }).exec();

    // this.ProductDetails.updateMany({ condition: 'REMANUFACTURED' }, {
    //   conditionId: 2500, condition: 'Remanufactured'
    // }).exec();


    // this.ProductDetails.updateMany({ condition: 'USED' }, {
    //   conditionId: 3000, condition: 'Used'
    // }).exec();



    // this.ProductDetails.updateMany({ condition: 'NEW IN BOX' }, {
    //   conditionId: 1000, condition: 'New In Box'
    // }).exec();

    // this.ProductDetails.updateMany({ condition: 'NEW WITHOUT BOX' }, {
    //   conditionId: 1500, condition: 'New Without Box'
    // }).exec();


    let setting = await this.WebsiteSetting
      .find({ Name: 'Mercedes-Benz' })
      .exec();

    setting.forEach(async (element) => {
      // const postclapLists = await this.ProductDetails.find({ partMake: 'Gmc' }).select({ "partMake": 1 }).limit(1).exec();
      // console.log('element', postclapLists, element);

      // this.ProductDetails.updateMany({ partMake: 'Gmc'}, {
      //   partMake: element.Name
      // }).exec();

      // const ebayListingData1 = await this.ebayListingData.find({ brand: element.Name.toUpperCase() }).select({ "brand": 1 }).limit(1).exec();
      // console.log('ebayListingData', ebayListingData1);

      // this.ebayListingData.updateMany({ brand: 'Mercedes-benz' }, {
      //   brand: element.Name
      // }).exec();


      // this.ProductScrapDetail.updateMany({ brand: element.Name.toUpperCase() }, {
      //     brand: element.Name
      //   }).exec();

      // const productScrapDetail = await this.ProductScrapDetail.find({ brand: element.Name.toUpperCase() }).select({ "brand ": 1 }).limit(1).exec();
      // console.log('ProductScrapDetail', productScrapDetail);



    }); /**/
    // const postclapLists = await this.ebayListingData.find().select({}).exec();


  }

  async NewUpdatePost() {

    // await this.ProductDetails.updateMany({}, {
    //   isLoadStatus: 0,
    //   modifiedDate: getDate(),
    //   loadedDate: getDate()
    // }).exec();
    // await this.WebsiteSetting.deleteMany({}).exec();

    // const postclapLists = await this.ProductScrapDetail.find({}).select({ "OtherData": 1, "partNumber": 1 }).sort({ "createdDate": -1 }).exec();
    // postclapLists.forEach(async (value) => {
    //   var decrpyt = decryptData(value.OtherData);
    //   //console.log('decrpyt', value);
    //   let finaldata = JSON.parse(decrpyt);
    //   if (finaldata.ListingDetails.PartNumber == 'NA') {
    //     console.log('PartNumber', value.partNumber, finaldata.ListingDetails.PartNumber);
    //     // await this.ProductDetails.updateOne({ partNumberTrim: value.partNumber }, {
    //     //   isLoadStatus: 0,
    //     //   modifiedDate: getDate(),
    //     //   loadedDate: getDate()
    //     // }).exec();


    //     // await this.ProductScrapDetail.deleteOne({ _id: value._id }).exec();

    //   }

    // });

    const postclapLists = await this.ProductDetails.find({ isLoadStatus: 0 }).select({ "partCountry": 1 }).sort({ "createdDate": -1 }).exec();
    postclapLists.forEach(async (value) => {
      //var decrpyt = decryptData(value.OtherData);
      //console.log('decrpyt', value);
      //let finaldata = JSON.parse(decrpyt);
      let make = "";
      if (value.partCountry != 'NA')
        make = value.partCountry.toLowerCase().replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });

      console.log('partCountry', value.partCountry, make.replace('Made In ', "").trim());
      // await this.ProductDetails.updateOne({ partNumberTrim: value.partNumber }, {
      //   isLoadStatus: 0,
      //   loadedDate: getDate()
      // }).exec();


      //  await this.ProductScrapDetail.deleteOne({ partNumber: value.partNumberTrim }).exec();

      //}

    });



    return null;
  }

  async NewUpdatePost1() {


    let allBasedId = await this.ProductDetails.aggregate([

      { "$match": { "isLoadStatus": { "$nin": [1, -1] } } },
      { $sort: { modifiedDate: -1 } },
      {
        $group: {
          _id: "$partNumberTrim",
          Brand: { "$first": "$partMake" }
        }
      },
      { "$project": { "partNumberTrim": "$_id", "partMake": "$Brand", "_id": 0 } },
      {
        $limit: 6
      }

    ]).exec();

    const postclapLists = await this.ProductScrapDetail.aggregate([
      { "$group": { "_id": "$partNumber", "count": { "$sum": 1 } } },
      { "$match": { "_id": { "$ne": null }, "count": { "$gt": 1 } } },
      { "$project": { "partNumber": "$_id", "_id": 0 } }
    ]);
    console.log('postclapLists', allBasedId);


    // const postclapLists = await this.ProductScrapDetail.find({}).select({ "OtherData": 1, "partNumber": 1 }).sort({ "createdDate": -1 }).exec();
    postclapLists.forEach(async (value) => {
      await this.ProductDetails.updateOne({ partNumberTrim: value.partNumber }, {
        isLoadStatus: 0,
        modifiedDate: getDate(),
        loadedDate: getDate()
      }).exec();


      await this.ProductScrapDetail.deleteMany({ partNumber: value.partNumber }).exec();
    });
    return null;
  }


  async ThreadReveal(element: any, isMaster: Boolean, date: Number) {


  }

  async delete(username) {
    console.log('selecte enter ');
    let contactSync = [];
    if (username != '') {



    } else {
      contactSync = await this.userDetails
        .find()
        .sort({ modifiedDate: 'desc' })
        .exec();
    }
    console.log(contactSync);
    contactSync.forEach(async (element) => {
      console.log(element);

      // await this.userRefreshToken.deleteMany({ userId: element._id }).exec();

      // await this.userBlocks.deleteMany({ userId: element._id }).exec();
      // await this.socialUserInfo.deleteMany({ userId: element._id }).exec();
      //await this.userDetails.deleteMany({ _id: element._id }).exec();
    }); /**/

    var user = await this.userDetails
      .find()
      .sort({ modifiedDate: 'desc' })
      .exec();

    user.forEach(async (element) => {
      console.log(element);
      // await this.userDetails.deleteMany({ _id: element._id }).exec();
    });



  }

  async clapCountCheck(param) {


    // connectionList.forEach(async (element) => {






  }



  async generalUpdate(param) {

    let updateAccount = await this.userDetails.findOne({
      mobilenumber: '9999999994'
    }).exec();

    console.log('updateAccount', updateAccount.accountDetails);
    var postresponse = JSON.parse(Buffer.from(updateAccount.accountDetails, 'base64').toString('ascii'));

    console.log('postresponse', postresponse);

    var encrypt = encryptDataAccount(postresponse);


    console.log('encrypt', encrypt);
    var decrpyt = decryptData(encrypt);
    console.log('decrpyt', decrpyt);
    this.userDetails.updateOne({ mobilenumber: '9999999994' }, {
      accountDetails: encrypt
    }).exec();


    this.userDetails.updateMany({ isSkip: { $eq: null } }, {
      isSkip: false, isAgree: 0
    }).exec();


    // var connectionList = await this.claps.aggregate([

    //   {
    //     $group: {
    //       _id: { postId: "$postId", postCreateduserId: "$postCreateduserId" },
    //       "profileCount": { "$sum": 1 }
    //     }
    //   },
    //   {
    //     $match: { "profileCount": { $gte: 10 } }
    //   },
    //   { $sort: { profileCount: -1 } }
    // ]).exec();
    // console.log('connectionList', connectionList)

    // connectionList.forEach(async element => {

    //   let threadmaster = await this.userDetails.findOne({
    //     _id: element._id.connectionfriendId
    //   }).exec();
    //   // console.log('threadmaster',threadmaster)
    //   if (threadmaster == null) {

    //     console.log(element._id.connectionfriendId)
    //     await this.connection.deleteMany({ connectionfriendId: element._id.connectionfriendId }).exec();
    //   }
    // });


    //console.log(Buffer.from("eyJhY2NfbnVtYmVyIjoiMjY2MjI3MjcyODI4OCIsImlmc2NfY29kZSI6IjAwMDAwMDAwMDkiLCJ1cGlfbnVtYmVyIjoiJjI2Mzc3eXdlaG9lb3EiLCJhYWRoYXJfbnVtYmVyIjoiNTQ5MDQ4NDg2NDY0IiwicGFuX251bWJlciI6IkRSS1BLOTU4OTcifQ", 'base64').toString('ascii'))
    // this.userDetails.updateMany({ nft: 1 }, {
    //   monetize: 1
    // // }).exec();
    // this.userDetails.updateMany({Approvedby : {$eq : null}}, {
    //   Approvedby: '62de6c779d084e190753c4e1' 
    // }).exec();

    // let allBasedId = await this.MonetizeTransactionDetails.aggregate([

    //   { $group: { _id: { baseUserId: "$baseUserId" } } }

    // ]).exec();
    // allBasedId.forEach(async element => {
    //   console.log(element._id.baseUserId)
    //   let threadmaster = await this.threadMaster.findOne({
    //     userId: element._id.baseUserId
    //   }).select({ "displayName": 1 });
    //   if (threadmaster != null) {
    //     console.log('threadmaster', threadmaster.displayName)

    //     this.MonetizeTransactionDetails.updateMany({ baseUserId: element._id.baseUserId }, {
    //       displayName: threadmaster.displayName
    //     }).exec();
    //   }
    // });
    // let threadmaster = await this.threadMaster.findOne({
    //   _id: element.threadId,
    // });

    // console.log('allBasedId', allBasedId)

    // this.userDetails.updateMany({}, {
    //   isSkip: false, isAgree: 0
    // }).exec();

    // this.userDetails.updateMany({ accountDetails : { '$eq': null } }, {
    //   accountDetails: ''
    // }).exec();

    // this.userDetails.updateMany({ isSkip: { $eq: null } }, {
    //   isSkip: false, isAgree: 0
    // }).exec();

    // this.post.updateMany({ nft: { '$ne': 1 } }, {
    //   nft: 0
    // }).exec();

    // this.userDetails.updateMany({ cardDetails: { '$eq': null } }, {
    //   cardDetails: null
    // }).exec();

    //  this.userDetails.updateMany({}, { "$unset": { "cardDetails": 1 } }).exec()

    // let allBasedId = await this.MonetizeTransactionDetails.aggregate([

    //   { $group: { _id: { basePostId: "$basePostId", baseUserId: "$baseUserId" } } }

    // ]).exec();

    // console.log('allBasedId', allBasedId)
    // allBasedId.forEach(async element => {
    //   console.log(element._id.basePostId)

    //   let value = await this.post.findOne({ _id: element._id.basePostId, userId: element._id.baseUserId }).select({
    //     "_id": 1,
    //     "createdDate": 1

    //   }).exec();
    //   if (value != null) {
    //     if (value.createdDate != 0 || value.monetizeActualAmount != undefined) {

    //       this.MonetizeTransactionDetails.updateMany({ basePostId: element._id.basePostId, baseUserId: element._id.baseUserId }, {
    //         createdDate: value.createdDate
    //       }).exec();
    //       console.log('createdDate', value)
    //     }
    //     else {
    //       // this.MonetizeTransactionDetails.updateMany({ basePostId: element._id.basePostId, baseUserId: element._id.baseUserId, status: 6 }, {
    //       //   actualAmount: value.monetizeActualAmount, paymentStatus: false
    //       // }).exec();
    //       console.log('monetizeActualAmount', value)
    //     }
    //   }
    // });



    // this.post.updateMany({isRepost: { '$eq': null }}, {
    //   isRepost: false
    // }).exec();
    // this.post.updateMany({ monetize: 1 , monetizeActualAmount : {$ne: 0}}, {
    //   monetizePlatformAmount: 0,
    //   monetizeTax: 0,
    //   monetizeActualAmount: 0
    // }).exec();

    //let postLists = await this.MonetizeTransactionDetails    .find({}).exec();


    // postLists.forEach(async (user) => {
    //   console.log(user.basePostId,user.amount);
    //   await this.post.updateOne({ _id: mongoose.Types.ObjectId(user.basePostId) }, {
    //     monetizeAmount: user.amount, monetize: 1
    //   }).exec();
    // });

  }

  async saveMonetizeWebHookData(username: any) {

    try {
      var newData = JSON.stringify(username)
      // console.log('saveMonetizeWebHookData', newData);
      // console.log('saveMonetizeWebHookData', value);

    } catch (error) {
      //throw new NotFoundException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK, error);
    }
  }

  async webhook(url: any) {

    try {
      console.log('url', url)


      //   const browser = await puppeteer.launch({ headless: false });
      //   const page = await browser.newPage();
      //   console.log("We are scraping from " + url + ":");
      //   await page.setDefaultNavigationTimeout(60000);
      //   await page.goto(url);


      //   const [link] = await page.$x('//*[@id="fitmentTab"][text() = "What This Fits"]');
      //   await link.click();



      //   // loop trough items



      //   let hrefs = await page.evaluate(() => {

      //     let Element = Array.from(document.body.querySelectorAll('a'), (el) => el.href);
      //     return Array.from(new Set(Element));
      //   });



      //   //console.log('hrefs', hrefs)

      //   await Promise.all([
      //     // Manual clicking of the link
      //     page.$eval('#ctl00_Content_PageBody_ProductTabsLegacy_showAllApplications', el => el.click()),

      //     page.waitForNavigation()
      //   ]).catch(e => console.log(e));

      // //  const ddd = await page.$eval('#ctl00_Content_PageBody_ProductTabsLegacy_div_applicationListContainer', el => el.innerHTML);

      //   const data3 = await page.$$eval('#ctl00_Content_PageBody_ProductTabsLegacy_div_applicationListContainer > table tr td', tds => tds.map((td) => {

      //     // return {
      //     //   "Make": td[0].innerText,
      //     //   "Year": td[0].innerText,
      //     // }
      //     return td.innerText._id;
      //   }));

      //   console.log('data', data3)


      // const data = await page.evaluate(() => {
      //   const tds = Array.from(document.body.querySelectorAll('#ctl00_Content_PageBody_ProductTabsLegacy_div_applicationListContainer'))
      //   return tds.map(d => {
      //     const name = d.querySelectorAll("table tr td");
      //     if (name.length > 0) {
      //       console.log("Make", d[0].innerText)
      //       console.log("Year", d[1].innerText)
      //       return tds.map(td => td.innerHTML)
      //     }
      //   })

      // });


      // console.log('data', ddd)
      // let res = [];
      // for (let i = 0; i < hrefs.length; i++) {
      //   if (hrefs[i].indexOf("ctl00$Content_PageBody$ProductTabsLegacy$showAllApplications") > -1) {
      //     res.push(hrefs[i]);
      //   }
      // }

      // console.log('res', res)
      // for (let i = 0; i < res.length; i++) {
      //   await page.goto(res[i]);
      //   let item_name = await page.evaluate(() => {
      //     let selector = document.body.querySelector('h1');
      //     if (selector === null) return null;
      //     return selector.textContent;
      //   });
      //   if (item_name === null) continue;
      //   let spans = await page.evaluate(() => {
      //     return Array.from(document.body.querySelectorAll('span'), (el) => el.textContent);
      //   });
      //   let price, promotion;
      //   for (let j = 0; j < spans.length; j++) {
      //     if (spans[j] != null && (spans[j].indexOf("$") > -1)) {
      //       if ((spans[j].indexOf("SAVE") > -1)) {
      //         promotion = spans[j];
      //         price = spans[j + 2];
      //         break;
      //       }
      //     }
      //   }
      //   if (promotion === undefined
      //     || price === undefined
      //     || price.indexOf("$") === -1
      //     || promotion.indexOf("$") === -1
      //   ) continue;
      //   console.log({ "name": item_name, "price": price, "promotion": promotion });
      // }

      // await browser.close();
    }

    catch (error) {
      //throw new NotFoundException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK, error);
    }
  }


}