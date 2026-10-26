import { BadRequestException, forwardRef, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Console } from 'console';
import { Model } from 'mongoose';

import * as mongoose from 'mongoose';
import { AUTO_ERRORMSG, SPARK_NOTIFY, stockHistoryMsg, colorCode } from 'src/util/constant';
import { BASE64String, encryptDataAccount, getDate, getSuccess, randomString, sleep } from '../util/utils';

import { decryptData, encryptData } from '../util/utils';

import { SettingService } from 'src/setting/setting.service';
import { UsersService } from 'src/users/users.service';

export type User = any;

@Injectable()
export class productService {

    constructor(
        @InjectModel('ProductDetail') private readonly ProductDetails: Model<any>,
        @InjectModel('ProductActivityLog') private readonly ProductActivityLog: Model<any>,
        @InjectModel('ProductScrapDetail') private readonly ProductScrapDetail: Model<any>,
        @InjectModel('uuids') private readonly uuids: Model<any>,
        @InjectModel('FilteredStock') public filteredStockModel: Model<any>,
        @InjectModel('NonFilteredStock') public NonFilterStockModel: Model<any>,
        @InjectModel('SuperSeededPartDetails') private readonly superSeededPartDetails: Model<any>,
        @InjectModel('StockHistory') public stockHistoryModel: Model<any>,
        @InjectModel('SerialNumberLogs') public serialNumberLogsModel: Model<any>,
        @InjectModel('UserDetails') private readonly userDetailsModel: Model<any>,
        @InjectModel('Setting') private readonly settingModel: Model<any>,


        public readonly usersService: UsersService,
    ) { }

    async UpdatePost() {
        this.ProductDetails.updateMany({ color: { $eq: null } }, {
            color: {
                "Id": "2",
                "colorCode": "#FFFFFF",
                "name": "White"
            }
        }).exec();


    }


    async createProductDetails(userInfo: any, userId: string) {

        var new1 = await this.usersService.ValidateUser(userId);

        console.log("Hi", userInfo.placement.replace(/\s?$/, ''), userInfo.partNumber)

        var list;
        let partTrim = ''; let make = '';

        const userDetil = await this.usersService.logInAuth(userId);
        if (userDetil) {
            if (userInfo.partMake == 'INFINITI' || userInfo.partMake == 'GMC' || userInfo.partMake == 'BMW' || userInfo.partMake == "ASTON MARTIN" || userInfo.partMake == "McLaren" || userInfo.partMake == "FIAT")
                make = userInfo.partMake
            else
                make = userInfo.partMake.toLowerCase().replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });

            console.log("make", make)

            const country = userInfo.partCountry == 'NA' ? 'NA' : userInfo.partCountry.toLowerCase().replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });

            console.log('partNumber', userInfo.partNumber)

            if (make == 'Dodge' || make == 'Mitsubishi') {
                if (userInfo.partNumber.length > 11) {
                    let data = userInfo.partNumber.replace(/-001|1-|-|\s/g, "").trim()
                    console.log('partNumber2', data)
                    partTrim = data
                    // this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(value._id) }, {
                    //   partNumberTrim:  data
                    // }).exec();
                    // let data = userInfo.partNumber.replace(/-|_|\s/g, "|").trim();
                    // console.log('data', data);
                    // let newdata = data.split('|');
                    // if (newdata.length <= 2) {
                    //     for (var i = 0; i < newdata.length; i++) {
                    //         if (newdata[i].length >= 10) {
                    //             console.log('value', newdata[i], data, userInfo.partNumber)
                    //             partTrim = newdata[i];
                    //         }
                    //         else {
                    //             partTrim = userInfo.partNumber.replace(/-|_|\s/g, "").trim();
                    //         }
                    //     }
                    // }
                    // else {
                    //     partTrim = userInfo.partNumber.replace(/-|_|\s/g, "").trim();
                    // }
                }
                else {
                    console.log('partNumber', userInfo.partNumber.replace(/-001|1-|-|\s/g, "").trim())
                    partTrim = userInfo.partNumber.replace(/-|_|\s/g, "").trim();
                }
            }
            else {
                console.log('partNumber', userInfo.partNumber.replace(/-|_|\s/g, "").trim())
                partTrim = userInfo.partNumber.replace(/-|_|\s/g, "").trim();
            }

            let postclapLists = await this.ProductDetails.find({ partNumberTrim: partTrim, partMake: make }).sort({ modifiedDate: 'desc' }).exec();
            //console.log('hi', postclapLists);
            if (postclapLists != null && postclapLists.length > 0) {
                if (postclapLists[0].status == -1 || postclapLists[0].status == -2)
                    throw await new HttpException(AUTO_ERRORMSG.POST_JUNK_EXIST, HttpStatus.BAD_REQUEST);
            }
            let uuidRecord;
            if (userInfo.serialNumber && userInfo.serialNumber != 'NA') {
                if (!userInfo.allowDuplicate) {
                    let alreadyExists = await this.ProductDetails.find({ serialNumber: userInfo.serialNumber }).sort({ modifiedDate: 'desc' }).count();
                    if (alreadyExists && alreadyExists > 0) {
                        throw await new HttpException(AUTO_ERRORMSG.SERIAL_NUMBER_EXIST, HttpStatus.BAD_REQUEST);
                    } else {
                        uuidRecord = await this.uuids.findOne({ type: userInfo.serialNumber });
                        if (uuidRecord == null) {
                            throw await new HttpException(AUTO_ERRORMSG.UUID_DOES_NOT_MATCH_FOR_SERIAL_NUMBER, HttpStatus.BAD_REQUEST);
                        }
                    }
                } else {
                    uuidRecord = await this.uuids.findOne({ type: userInfo.serialNumber });
                    if (uuidRecord == null) {
                        throw await new HttpException(AUTO_ERRORMSG.UUID_DOES_NOT_MATCH_FOR_SERIAL_NUMBER, HttpStatus.BAD_REQUEST);
                    }
                }

            }

            let color = postclapLists && postclapLists.length > 0 ? this.getColor(postclapLists) : 'Red';
            // if (userInfo.condition == "New, flawed" && !userInfo.notes.includes('New OEM less the box never installed')) {
            //     userInfo.notes = userInfo.notes + ', ' + 'New OEM less the box never installed'
            // }
            let findScrapExists = await this.ProductDetails.find({ partNumberTrim: partTrim, partMake: make, isLoadStatus: 1 }).count();

            var user = await this.ProductDetails.create({
                userId: userId,
                userName: userDetil.displayName,
                status: 0,
                partNumber: userInfo.partNumber,
                partNumberTrim: partTrim,
                partNumberBase: partTrim,
                interChangePartNumber: 'NA',
                partTitle: userInfo.partTitle,
                partQuantity: userInfo.partQuantity,
                partMake: make,
                partCountry: country,
                partImages: userInfo.partImages,
                baseImageURL: userInfo.baseImageURL,
                location: userInfo.location,
                boxNumber: userInfo.boxNumber,
                color: Object.keys(userInfo.color).length != 0 ? userInfo.color : {},
                placement: userInfo.placement.replace(/\s?$/, ''),
                condition: userInfo.condition,
                conditionId: userInfo.conditionId,
                notes: userInfo.notes,
                texture: userInfo.texture,
                isProductStatus: 0,
                isLoadStatus: findScrapExists == 0 ? 0 : -2,
                relistFlag: color ? color : 'Red',
                adminId: userDetil.adminId,
                createdDate: getDate(),
                modifiedDate: getDate(),
                priceValue: 0,
                isSelectedCheckBox: false,
                serialNumber: userInfo.serialNumber ? userInfo.serialNumber : 'NA',
                uuid: userInfo.serialNumber && uuidRecord ? uuidRecord.uuid : 'NA',
                totalQuantity: userInfo.partQuantity,
                availableQuantity: userInfo.partQuantity,
                ebayQuantity: 0,
                ecomQuantity: 0,
                addedToStock: false,
                clonedItem: false
            });

            if (userInfo.serialNumber && userInfo.serialNumber != 'NA') {
                let createLog = await this.serialNumberLogsModel.create({
                    createdDate: getDate(),
                    modifiedDate: getDate(),
                    partNumber: userInfo.partNumber,
                    serialNumber: userInfo.serialNumber,
                    type: 1,
                    description: 'Serial number attached to a part number'
                })
            }


            list = {
                status: 1,
                message: "Saved Sucessfully"
            }
        }
        else {
            throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_MATCH)
        }
        return getSuccess(list);
    }


    async updateHistory(userInfo, from?) {
        console.log(userInfo, "userInfo");
        let updateObject = {
            addedToStock: true
        }
        if (from == 'nonFilter') {
            updateObject['partQuantity'] = userInfo.newQuantity;
            updateObject['totalQuantity'] = userInfo.newQuantity;
            updateObject['availableQuantity'] = userInfo.newQuantity;
        }
        let addedToStock = await this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(userInfo.id) },
            {
                $set: updateObject
            }).exec();
        //console.log(userInfo, 'userInfo');
        let trackHistory = await this.stockHistoryModel.create({
            partNumberSubId: userInfo.revertId ? userInfo.revertId : userInfo.id,
            partNumber: userInfo.partNumber,
            createdDate: getDate(),
            modifiedDate: getDate(),
            quantityChange: userInfo.quantityDiff,
            currentQuantity: userInfo.newQuantity,
            oldQuantity: userInfo.oldQuantity,
            description: userInfo.description,
            nonFilterRows: userInfo.nonFilterRows ? userInfo.nonFilterRows : {}
        });
        if (trackHistory) {
            return true;
        }
        // console.log(trackHistory, "trackHistory");
    }

    getColor(postclapLists) {
        let colorArray = [];
        let finalColorArray = [];
        let status = postclapLists.map((x: any) => x.status);
        if (status) {
            let colorStatusArray = [
                { "color": "Red", "status": [-1, 0, 1] },
                { "color": "Yellow", "status": [2, 3] },
                { "color": "Blue", "status": [4, 5] },
                { "color": "Green", "status": [6] }
            ];

            colorStatusArray.forEach(element => {
                let statusValue = element.status.filter(x => status.includes(x));
                statusValue = [...new Set(statusValue)];
                if (statusValue.length > 0) {
                    colorArray.push(element.color);
                }
            });
            if (colorArray && colorArray.length >= 2 && colorArray.includes('Red')) {
                finalColorArray = colorArray.filter(x => x != 'Red');
            } else {
                finalColorArray = colorArray;
            }
        }
        return status && finalColorArray.length > 0 ? (finalColorArray.length > 1 ? 'Orange' : finalColorArray[0]) : 'Red';

    }

    async delete() {

    }
    async postRequest(status?) {
        // this.ProductDetails.updateMany({ isLoadStatus: 1 }, {
        //     isLoadStatus: 0}).exec();

        // const postclapLists = await this.ProductDetails.find({ partNumberTrim: '81400C5000QQK', isLoadStatus: { $nin: [1, -1] }, partMake: { $in: ['Mitsubishi', 'Audi', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'GMC', 'Jeep', 'Dodge', 'Mazda', 'Oldsmobile', 'Pontiac', 'Ram', 'Saturn', 'BMW', 'Hyundai', 'Kia'] } }).select({ "partNumberTrim": 1, "partMake": 1, "isLoadStatus": 1 })
        //     .sort({ modifiedDate: 'desc' }).limit(6).exec();
        // Get the current date
        var matchObject;

        if (status && status == 'minusOne') {
            ////const today = new Date();

            // Subtract 1 day to get yesterday's date
            ////const yesterday = new Date(today);
            ////yesterday.setDate(today.getDate() - 1);

            // Set the time to the start of the day (midnight)
            ////yesterday.setHours(0, 0, 0, 0);

            // Convert the start of the day to epoch format
            ////const startOfDayEpoch = yesterday.getTime() / 1000; // divide by 1000 to convert milliseconds to seconds

            // Set the time to just before midnight
            ////yesterday.setHours(23, 59, 59, 999);

            // Convert just before midnight to epoch format
            ////const endOfDayEpoch = yesterday.getTime() / 1000;

            //// console.log(startOfDayEpoch, "startOfDayEpoch");
            //// console.log(endOfDayEpoch, "endOfDayEpoch");
            matchObject = {
                "isLoadStatus": { $in: [-1] }, partMake: {
                    $nin: ['ASTON MARTIN', 'Bentley', 'Bosch', 'Ferrari'
                        , 'Lamborghini', 'Maserati', 'McLaren', 'Rolls-Royce', 'Exotics','Other',
                    "Harley Davidson", "Kenworth", "Peterbuilt", "International", "Freightliner", "Komatsu", "John Deere", "Yale",
                    "Paccar"
                    ]
                }, status: { $in: [0, 1] },
                // $and: [{ "loadedDate": {$gte: startOfDayEpoch }}, {"loadedDate": {$lte: endOfDayEpoch}
                // partNumberTrim :{$in: [
                //     'MR587341','AY2727001291','74232AE021', '7801B003A',  '8330A059', 
                //     '8619053050', 'MB527551',  '8946550130', '4162A036',  '0261230101',  '8541G828',  '8108A010',
                //     'MR437265',  '8966633442',  '2430A262', '0280160587', '8301B115', '8966153564', 'J5T25094',
                //    '569001U500VA'
                //  ]}
                //partNumber :{$in: ['MR171364']}

            }
            console.log(matchObject, "match object in line 284");
        } else {
            console.log(matchObject, "match object in line 286");
            matchObject = {
                "isLoadStatus": { "$in": [0, -1] }, partMake: {
                    $nin: ['ASTON MARTIN', 'Bentley', 'Bosch', 'Ferrari'
                        , 'Lamborghini', 'Maserati', 'McLaren', 'Rolls-Royce', 'Exotics','Other',
                    "Harley Davidson", "Kenworth", "Peterbuilt", "International", "Freightliner", "Komatsu", "John Deere", "Yale",
                    "Paccar"
                    ]
                }, status: { $in: [0, 1] }
            }
        }
        let postclapLists = await this.ProductDetails.aggregate([
            {
                "$match": matchObject
            }, {
                $group: {
                    _id: "$partNumberTrim",
                    Brand: { "$first": "$partMake" }
                }
            },
            { $sort: { modifiedDate: -1 } },
            { "$project": { "partNumberTrim": "$_id", "partMake": "$Brand", "_id": 0 } },
            {
                $limit: 1
            }
        ]).exec();
        return postclapLists
    };

    async postRequestFindByPart(brand: string, partNumber: string) {
        const colorSkippedPart = partNumber.substring(0, partNumber.length - 2);

        const partNumberCond = {
            $or: [
            { partNumber: partNumber },
            { partNumber: new RegExp(`^${colorSkippedPart}[A-Za-z]{2}$`, "i") }
            ]
        };

        const postclapLists = await this.ProductScrapDetail.countDocuments({
            ...partNumberCond,
            brand: brand
        });

        return postclapLists;
    };


    async superSeededPartDetailsList(partNumber: string) {
        let postclapLists = await this.superSeededPartDetails.findOne({
            $or: [{ "SuperSeedList": { $regex: partNumber.replace(/-|_|\s/g, "").trim(), $options: 'i' } }, { "BasePart": { $regex: partNumber.replace(/-|_|\s/g, "").trim(), $options: 'i' } }]
        }).sort({ createdDate: 'desc' }).exec();
        return postclapLists
    };

    async saveScrap(data: any, brand: string, partNumber: string, status?) {

        let encrypt = encryptDataAccount(data);
        console.log('data.length: ', encrypt.length, brand, partNumber);

        let scrapExist2 = await this.postRequestFindByPart(brand, partNumber);
        console.log('scrapExist2', scrapExist2);
        if (scrapExist2 == 0) {

            //let finaldata = JSON.parse(data);
            console.log('finaldata', data && data.ListingDetails && data.ListingDetails.PartNumber ? data.ListingDetails.PartNumber : 'No Partnumber found');

            if (encrypt.length > 576) {
                if (data.ListingDetails.PartNumber != 'NA') {
                    var user = await this.ProductScrapDetail.create({
                        status: 1,
                        brand: brand,
                        OtherData: encrypt,
                        partNumber: partNumber.replace(/-|_|\s/g, "").trim(),
                        createdDate: getDate(),
                        modifiedDate: getDate()
                    });
                    await this.ProductDetails.updateMany({
                        partNumberTrim: partNumber,
                        partMake: brand
                    }, {
                        isLoadStatus: 1,
                        modifiedDate: getDate(),
                        loadedDate: getDate(),
                        partNumberBase: partNumber
                    });

                    await sleep(1000);
                }
                else {
                    await this.ProductDetails.updateMany({
                        partNumberTrim: partNumber,
                        partMake: brand
                    }, {
                        isLoadStatus: status && status == 'minusOne' ? -2 : -1,
                        modifiedDate: getDate(),
                        loadedDate: getDate(),
                        partNumberBase: partNumber
                    });
                }
            }
            else {
                console.log('data: ', data, brand, partNumber);
                await this.ProductDetails.updateMany({
                    partNumberTrim: partNumber,
                    partMake: brand
                }, {
                    isLoadStatus: status && status == 'minusOne' ? -2 : -1,
                    modifiedDate: getDate(),
                    loadedDate: getDate(),
                    partNumberBase: partNumber
                });
            }

        }
        else {
            await this.prodScrapUpdate(brand, partNumber);
        }
    };

    async prodScrapUpdate(brand: string, partNumber: string) {
        await this.ProductDetails.updateMany({
            partNumberTrim: partNumber,
            partMake: brand
        }, {
            isLoadStatus: 1,
            modifiedDate: getDate(),
            loadedDate: getDate(),
            partNumberBase: partNumber
        });

    }
    async view(searchText: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', searchText);
        if (searchText.paginator.nextPage === 0)
            throw new BadRequestException(AUTO_ERRORMSG.NEXTPAGE_NOT_EXIST);
        var clapList = [];
        var room_condition;

        if (searchText.user != '')
            room_condition = mongoose.Types.ObjectId(searchText.user);
        else
            room_condition = { '$ne': null };


        var skip = ((searchText.paginator.nextPage * searchText.paginator.pageSize) - searchText.paginator.pageSize);
        let postclapLists;
        let searchValue = searchText.partNo;
        let numericSearchValue = searchValue.replace(/^0+/, "");
        if (searchText.emptyLocation == true) {
            postclapLists = await this.ProductDetails.find({
                boxNumber: { $regex: searchText.boxNo, $options: 'i' },
                partMake: { $regex: searchText.brand, $options: 'i' },
                partTitle: { $regex: searchText.partTitle, $options: 'i' },
                userId: room_condition, status: { $gte: 2 },
                serialNumber: { $in: ['NA', '', undefined] },
                location: { $nin: ['NA', ''] },
                // $or: [
                //     { "partNumberTrim": { $regex: searchValue, $options: 'i' } },
                //     { "partNumberTrim": { $regex: numericSearchValue, $options: 'i' } },
                //     { "partNumberTrim": { $regex: `^0*${numericSearchValue}$` } },
                //     { "serialNumber": { $in: ['NA', '', undefined] } },
                //     { "location": { $nin: ['NA', ''] } }]
                $or: [
                    { "partNumberTrim": { $regex: searchValue, $options: 'i' } },
                    { "partNumberTrim": { $regex: numericSearchValue, $options: 'i' } },
                    { "partNumberTrim": { $regex: `^0*${numericSearchValue}$` } }]

            }).sort({ createdDate: 'desc' }).skip(skip).limit(searchText.paginator.pageSize + 1);
        } else {
            postclapLists = await this.ProductDetails.find({
                boxNumber: { $regex: searchText.boxNo, $options: 'i' },
                $or: [
                    { "partNumberTrim": { $regex: searchValue, $options: 'i' } },
                    { "partNumberTrim": { $regex: numericSearchValue, $options: 'i' } },
                    { "partNumberTrim": { $regex: `^0*${numericSearchValue}$` } }
                ],
                partMake: { $regex: searchText.brand, $options: 'i' },
                partTitle: { $regex: searchText.partTitle, $options: 'i' },
                userId: room_condition,
                status: { $nin: [-2, -1, 8] }
            })
                .sort({ createdDate: 'desc' }).skip(skip).limit(searchText.paginator.pageSize + 1);
        }

        let lastPaginateKey = 0;
        let previousPaginateKey = 0;

        console.log(postclapLists, 'postclapLists')

        await Promise.all(postclapLists.map(async (value, index) => {
            //  for (var t = 0; t < postclapLists.length; t++) {
            lastPaginateKey = value.createdDate;
            let baseImageURL = value.baseImageURL;

            if ((baseImageURL.includes("white1.jpg") || baseImageURL.includes("white2.jpg"))
                && value.partImages && value.partImages.length > 0) {
                baseImageURL = value.partImages.length > 2 ? value.partImages[2].URL : value.partImages[0].URL;
            }
            if (index < searchText.paginator.pageSize) {
                clapList.push({
                    _id: value._id,
                    status: value.status,
                    partNumber: value.partNumber,
                    partTitle: value.partTitle,
                    partQuantity: value.partQuantity,
                    userName: value.userName,
                    userId: value.userId,
                    partMake: value.partMake,
                    partCountry: value.partCountry,
                    baseImageURL: baseImageURL,
                    partImages: value.partImages,
                    location: value.location,
                    boxNumber: value.boxNumber,
                    color: value.color === undefined ? {} : value.color,
                    placement: value.placement === undefined ? '' : value.placement,
                    condition: value.condition === undefined ? '' : value.condition,
                    conditionId: value.conditionId === undefined ? 0 : value.conditionId,
                    texture: value.texture === undefined ? '' : value.texture,
                    notes: value.notes,
                    createdDate: value.createdDate,
                    modifiedDate: value.modifiedDate,
                    serialNumber: value.serialNumber && value.serialNumber != '' ? value.serialNumber : 'NA',
                    uuid: value.uuid && value.uuid != '' ? value.uuid : 'NA',
                    availableQuantity: value.availableQuantity,
                    ebayQuantity: value.ebayQuantity,
                    totalQuantity: value.totalQuantity
                });
            }
        }));

        if (postclapLists.length - 1 == searchText.paginator.pageSize) {
            lastPaginateKey = searchText.paginator.nextPage + 1;
            previousPaginateKey = searchText.paginator.nextPage - 1;
        }
        else {
            lastPaginateKey = 0;
            previousPaginateKey = searchText.paginator.nextPage - 1;
        }
        var result = {
            list: await clapList.sort(function (a, b) {
                return b.createdDate - a.createdDate;
            }),
            paginator: {
                pageSize: searchText.paginator.pageSize,
                pageNumber: searchText.paginator.nextPage + 1,
                totalPages: searchText.paginator.nextPage + 1,
                nextPage: lastPaginateKey,
                previousPage: previousPaginateKey,
            }
        };
        return getSuccess(result);
    }

    async removeSerialNumber(data, userId) {
        try {
            console.log(data, data._id, data.serialNumber, "data in line 7125");
            if (data && data._id && data.serialNumber) {
                let updateProductDetails: any = await this.ProductDetails.updateOne({ _id: mongoose.Types.ObjectId(data._id), serialNumber: data.serialNumber }, {
                    $set: {
                        serialNumber: '',
                        uuid: ''
                    }
                }).exec();
                console.log(updateProductDetails, "line no 511");
                if (updateProductDetails && updateProductDetails.nModified > 0) {
                    const userDetil = await this.usersService.logInAuth(userId);

                    let product = await this.ProductDetails.findOne({ _id: mongoose.Types.ObjectId(data._id) }).select({ status: 1 }).exec();
                    let createLog = await this.serialNumberLogsModel.create({
                        createdDate: getDate(),
                        modifiedDate: getDate(),
                        partNumber: data.partNumber,
                        serialNumber: data.serialNumber,
                        type: 2,
                        description: 'Serial number removed from a part number',
                        status: product.status,
                        partId: data._id,
                        userType: 'User',
                        userName: userDetil.displayName
                    })
                    let result = {
                        status: true,
                        message: "Serial Number removed successfully"
                    }
                    return getSuccess(result)
                } else {
                    throw new BadRequestException(AUTO_ERRORMSG.INVALID_REQUEST);
                }
            } else {
                console.log("line no 7149");
                throw new BadRequestException(AUTO_ERRORMSG.INVALID_REQUEST);
            }
        } catch (e) {
            console.log(e, "error in line 7141");
            throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);

        }
    }


    async serialNumberList(data) {
        let serialList = [];
        try {
            //     serialList = await this.serialNumberLogsModel.find({
            //         serialNumber: { $regex: data.serialNumber, $options: 'i' }
            //     }).select({serialNumber:1,modifiedDate:1}).collation({ locale: "en_US", numericOrdering: true }).exec();
            //    return serialList;


            const result = await this.serialNumberLogsModel.aggregate([
                // Match documents where serialNumber starts with the specified prefix
                {
                    $match: {
                        serialNumber: { $regex: data.serialNumber, $options: 'i' }
                    }
                },
                // Group by serialNumber and get the latest modifiedDate for each serialNumber
                {
                    $group: {
                        _id: '$serialNumber',
                        latestModifiedDate: { $max: '$modifiedDate' },
                    },
                },

                // Lookup to join with the 'productdetails' collection and filter out serialNumbers that exist in 'productdetails'
                {
                    $lookup: {
                        from: 'productdetails', // The collection to look up against
                        localField: '_id', // The serialNumber from serialNumberLogsModel
                        foreignField: 'serialNumber', // The field in 'productdetails' to match against
                        as: 'productDetails' // Alias for the result
                    }
                },

                // Match documents where the serialNumber is not present in 'productdetails'
                {
                    $match: {
                        'productDetails': { $size: 0 } // Ensure that there are no matching records in productdetails
                    }
                },

                // Lookup again to join back with the 'serialNumberLogs' collection to fetch the full document for the latest modifiedDate
                {
                    $lookup: {
                        from: 'serialnumberlogs', // The collection you're working with
                        let: { serialNumber: '$_id', modifiedDate: '$latestModifiedDate' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$serialNumber', '$$serialNumber'] },
                                            { $eq: ['$modifiedDate', '$$modifiedDate'] },
                                            { $eq: ['$type', 2] }, // Only get records where type is 2
                                        ],
                                    },
                                },
                            },
                        ],
                        as: 'latestLogs',
                    },
                },

                // Unwind the resulting array to flatten the results
                { $unwind: '$latestLogs' },

                // Replace the root to get only the document itself
                { $replaceRoot: { newRoot: '$latestLogs' } },

                // Sort by modifiedDate in descending order
                { $sort: { modifiedDate: -1 } }
            ]);

            return getSuccess(result);


        } catch (e) {
            console.log(e);
            throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);
        }



    }

    async serialNumberHistory(data) {
        try {
            if (data && data.serialNumber) {
                let fetchHistoryList = await this.serialNumberLogsModel.find({ serialNumber: data.serialNumber }).sort({ createdDate: -1 }).exec()
                // let result = {
                //     status: true,
                //     historyList: fetchHistoryList
                // }

                return getSuccess(fetchHistoryList);

            } else {
                throw new BadRequestException(AUTO_ERRORMSG.INVALID_REQUEST);
            }

        } catch (e) {
            console.log(e, "error in line 7168");
            throw new BadRequestException(AUTO_ERRORMSG.COMMON_ERROR_BLOCK);
        }
    }

    // serial number on UUID api
    async uuidProductList(pagination) {
        console.log(pagination, 'pagination')
        let skip: any;
        let getUUIDTableData: any;
        let getuuidTableList: any = [];
        let lastUUIDPaginateReportKey: any;
        let previousUUIDPaginateReportKey: any;
        let statusColor: any;
        if (pagination.paginator.nextPage === 0) {
            // console.log('userdetailData', pagination.paginator.nextPage);
            throw new BadRequestException(AUTO_ERRORMSG.INVALID_REQUEST);
        }
        // console.log(pagination, 'pagination')
        skip = ((pagination.paginator.nextPage * pagination.paginator.pageSize) - pagination.paginator.pageSize);
        // console.log(pagination.serialNumber, 'paginationserialNumber')
        let serialNum: any;
        if (pagination.serialNumber == "") {
            serialNum = { $nin: ["", null, "NA"] }
        } else {
            serialNum = { $nin: [null, 'NA', ""], $regex: pagination.serialNumber }//["/"+pagination.serialNumber+"/"] [`/${pagination.serialNumber}/`]  { $regex: pagination.serialNumber, $options: 'i' }
        }
        console.log(serialNum, 'serialNum')
        let colorStatus: any;

        // if (pagination.relistFlag == "") {
        colorStatus = [0, 1, -1, -2, 2, 3, 4, 5, 6, 7];
        // } else if (pagination.relistFlag == "new") {
        //     colorStatus = [0, 1, -1, -2];
        // } else if (pagination.relistFlag == "management") {
        //     colorStatus = [2, 3, 4, 5, 6, 7];
        // }
        console.log(colorStatus, 'colorStatus') //relistFlag: { $regex: pagination.relistFlag, $options: 'i' } 
        getUUIDTableData = await this.ProductDetails.find({ boxNumber: { $regex: pagination.boxNo, $options: 'i' }, partNumberTrim: { $regex: pagination.partNo, $options: 'i' }, partMake: { $regex: pagination.brand, $options: 'i' }, serialNumber: serialNum, status: { $in: colorStatus } }).skip(skip).limit(pagination.paginator.pageSize + 1).sort({ createdDate: -1 }).exec();
        console.log(getUUIDTableData.length, "getUUIDTableData");
        await Promise.all(getUUIDTableData.map(async (element, index) => {

            console.log(element.price, 'serialNumberElse');
            if (index < pagination.paginator.pageSize) {
                // let BlobUrl = Url.BlobURL;
                // let BlobContainerName = Url.BlobContainerName;
                let partImagesArry = [];
                element.partImages.forEach((element, index) => {
                    let containsData = element.URL.split('/');
                    console.log(containsData.length, 'containsData');
                    if (containsData.length == 4) {
                        let imgUrl = element.URL;
                        let dataImgId = {
                            'URL': imgUrl,
                            'id': index + 1
                        }
                        partImagesArry.push(dataImgId);

                    } else {
                        let dataImgId = {
                            'URL': element.URL,
                            'id': index + 1
                        }
                        console.log(dataImgId, 'dataImgId')
                        partImagesArry.push(dataImgId);
                    }

                    // let imgUrl = BlobUrl + BlobContainerName + '/' + element.URL;
                    // let dataImgId = {
                    //     'URL': imgUrl,
                    //     'id': index
                    // }
                    // partImagesArry.push(dataImgId);
                });

                var arrayPlacementData = [];
                var placementArray: any = [];
                if (element.placement != undefined) {
                    placementArray = element.placement.replace('NA', '').split(',');
                }
                // var placementArray = element.placement.replace('NA', '').split(',');
                for (var i = 0; i < placementArray.length; i++) {
                    if (placementArray[i] != '')
                        arrayPlacementData.push(({
                            'name': placementArray[i]
                        }));
                }
                var arrayNoteData = [];
                var noteArray: any = [];
                if (element.placement != undefined) {
                    noteArray = element.placement.replace('NA', '').split(',');
                }
                // var noteArray = element.notes.replace('NA', '').split(',');
                for (var i = 0; i < noteArray.length; i++) {
                    if (noteArray[i] != '')
                        arrayNoteData.push(({
                            'name': noteArray[i]
                        }));
                }
                let statusVlaue = await this.userDetailsModel.findOne({ _id: element.userId }).select({ "status": 1 }).exec();

                if (element.status == 0 || element.status == 1 || element.status == -1 || element.status == -2) {
                    statusColor = "Red";
                } else if (element.status == 2 || element.status == 3 || element.status == 4 || element.status == 5 || element.status == 6 || element.status == 7) {
                    statusColor = "Yellow";
                }

                // else if (element.status == 4 || element.status == 5) {
                //     statusColor = "Blue";
                // } else if (element.status == 6) {
                //     statusColor = "Green";
                // } else if (element.status == 7) {
                //     statusColor = "Purple";
                // }
                // let uuidData = {
                //     "partNumber": element.partNumber,
                //     "partNumberTrim": element.partNumberTrim,
                //     "partTitle": element.partTitle,
                //     'userStatus': statusVlaue.status,
                //     'partImages': partImagesArry,
                //     "userName": element.userName,
                //     "partMake": element.partMake,
                //     "boxNumber": element.boxNumber,
                //     "createdDate": element.createdDate,
                //     "status": element.status,
                //     "id": element._id,
                //     "placement": element.placement,
                //     "condition": element.condition,
                //     'notes': element.notes,
                //     'location': element.location == "" ? 'NA' : element.location,
                //     'partQuantity': element.partQuantity,
                //     'userId': element.userId,
                //     'country': element.partCountry,
                //     'modifiedDate': element.modifiedDate,
                //     'arrayPlacement': arrayPlacementData,
                //     'arrayNote': arrayNoteData,
                //     'texture': element.texture === undefined ? '' : element.texture,
                //     'color': element.color === undefined ? '' : element.color,
                //     'adminName': element.adminName,
                //     'adminNote': element.adminNote,
                //     'isLoadStatus': element.isLoadStatus == undefined ? 0 : element.isLoadStatus,
                //     'isProductStatus': element.isProductStatus == undefined ? 0 : element.isProductStatus,
                //     'isSelectedCheckBox': element.isSelectedCheckBox == undefined ? false : element.isSelectedCheckBox,
                //     'price': element.price == undefined ? 'NA' : element.price.replace(/\$/g, '').trim(),
                //     'relistFlag': statusColor,
                //     'serialNumberFlag': element.status == 6 || element.status == 7 ? (element.serialNumber && element.serialNumber != 'NA' ? element.serialNumber : '') : '',
                //     'serialNumber': element.serialNumber == null || element.serialNumber == undefined ? 'NA' : element.serialNumber,
                //     'uuid': element.uuid == null || element.uuid == undefined ? 'NA' : element.uuid,
                //     'totalQuantity': element.totalQuantity,
                //     'availableQuantity': element.availableQuantity,
                //     'ebayQuantity': element.ebayQuantity,
                //     'ecomQuantity': element.ecomQuantity
                // }

                let uuidData = {
                    _id: element._id,
                    status: element.status,
                    partNumber: element.partNumber,
                    partTitle: element.partTitle,
                    partQuantity: element.partQuantity,
                    userName: element.userName,
                    userId: element.userId,
                    partMake: element.partMake,
                    partCountry: element.partCountry,
                    baseImageURL: element.baseImageURL,
                    partImages: element.partImages,
                    location: element.location,
                    boxNumber: element.boxNumber,
                    color: element.color === undefined ? {} : element.color,
                    placement: element.placement === undefined ? '' : element.placement,
                    condition: element.condition === undefined ? '' : element.condition,
                    conditionId: element.conditionId === undefined ? 0 : element.conditionId,
                    texture: element.texture === undefined ? '' : element.texture,
                    notes: element.notes,
                    createdDate: element.createdDate,
                    modifiedDate: element.modifiedDate,
                    serialNumber: element.serialNumber == null || element.serialNumber == undefined ? 'NA' : element.serialNumber,
                    uuid: element.uuid == null || element.uuid == undefined ? 'NA' : element.uuid,
                    availableQuantity: element.availableQuantity,
                    ebayQuantity: element.ebayQuantity,
                    totalQuantity: element.totalQuantity
                }
                await getuuidTableList.push(uuidData)
            }

        }));
        if (getUUIDTableData.length - 1 == pagination.paginator.pageSize) {
            lastUUIDPaginateReportKey = pagination.paginator.nextPage + 1;
            previousUUIDPaginateReportKey = pagination.paginator.nextPage - 1;
        }
        else {
            lastUUIDPaginateReportKey = 0;
            previousUUIDPaginateReportKey = pagination.paginator.nextPage - 1;
        }
        let StatusNewList = {
            list: await getuuidTableList.sort(function (a, b) {
                return b.createdDate - a.createdDate;
            }),
            paginator: {
                pageSize: pagination.paginator.pageSize,
                pageNumber: pagination.paginator.nextPage + 1,
                totalPages: pagination.paginator.nextPage + 1,
                nextPage: lastUUIDPaginateReportKey,
                previousPage: previousUUIDPaginateReportKey
            }
        }
        return getSuccess(StatusNewList);
    }



    // async listWithoutLocation(searchText: any, userId: string) {
    //     var new1 = await this.usersService.ValidateUser(userId);
    //     console.log('hi', searchText);
    //     if (searchText.paginator.nextPage === 0)
    //         throw new BadRequestException(AUTO_ERRORMSG.NEXTPAGE_NOT_EXIST);
    //     var clapList = [];
    //     var room_condition;

    //     if (searchText.user != '')
    //         room_condition = mongoose.Types.ObjectId(searchText.user);
    //     else
    //         room_condition = { '$ne': null };


    //     var skip = ((searchText.paginator.nextPage * searchText.paginator.pageSize) - searchText.paginator.pageSize);
    //     const postclapLists = await this.ProductDetails.find({ boxNumber: { $regex: searchText.boxNo, $options: 'i' }, partNumberTrim: { $regex: searchText.partNo, $options: 'i' }, partMake: { $regex: searchText.brand, $options: 'i' }, partTitle: { $regex: searchText.partTitle, $options: 'i' }, location: {$in: ['NA', '']}, userId: room_condition, status: {$gte: 2} })
    //         .sort({ createdDate: 'desc' }).skip(skip).limit(searchText.paginator.pageSize + 1);
    //     let lastPaginateKey = 0;
    //     let previousPaginateKey = 0;

    //     console.log(postclapLists, 'postclapLists')

    //     await Promise.all(postclapLists.map(async (value, index) => {
    //         //  for (var t = 0; t < postclapLists.length; t++) {
    //         lastPaginateKey = value.createdDate;
    //         if (index < searchText.paginator.pageSize) {
    //             clapList.push({
    //                 _id: value._id,
    //                 status: value.status,
    //                 partNumber: value.partNumber,
    //                 partTitle: value.partTitle,
    //                 partQuantity: value.partQuantity,
    //                 userName: value.userName,
    //                 userId: value.userId,
    //                 partMake: value.partMake,
    //                 partCountry: value.partCountry,
    //                 baseImageURL: value.baseImageURL,
    //                 partImages: value.partImages,
    //                 location: value.location,
    //                 boxNumber: value.boxNumber,
    //                 color: value.color === undefined ? {} : value.color,
    //                 placement: value.placement === undefined ? '' : value.placement,
    //                 condition: value.condition === undefined ? '' : value.condition,
    //                 conditionId: value.conditionId === undefined ? 0 : value.conditionId,
    //                 texture: value.texture === undefined ? '' : value.texture,
    //                 notes: value.notes,
    //                 createdDate: value.createdDate,
    //                 modifiedDate: value.modifiedDate,
    //                 serialNumber : value.serialNumber && value.serialNumber != '' ? value.serialNumber : 'NA',
    //                 uuid: value.uuid && value.uuid != '' ? value.uuid : 'NA'
    //             });
    //         }
    //     }));

    //     if (postclapLists.length - 1 == searchText.paginator.pageSize) {
    //         lastPaginateKey = searchText.paginator.nextPage + 1;
    //         previousPaginateKey = searchText.paginator.nextPage - 1;
    //     }
    //     else {
    //         lastPaginateKey = 0;
    //         previousPaginateKey = searchText.paginator.nextPage - 1;
    //     }
    //     var result = {
    //         list: await clapList.sort(function (a, b) {
    //             return b.createdDate - a.createdDate;
    //         }),
    //         paginator: {
    //             pageSize: searchText.paginator.pageSize,
    //             pageNumber: searchText.paginator.nextPage + 1,
    //             totalPages: searchText.paginator.nextPage + 1,
    //             nextPage: lastPaginateKey,
    //             previousPage: previousPaginateKey,
    //         }
    //     };
    //     return getSuccess(result);
    // }

    async findpartDetails(userInfo: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', new1);
        let postclapLists;
        if (userInfo.objectId && userInfo.objectId != '') {
            postclapLists = await this.ProductDetails.findOne({ _id: userInfo.objectId }).sort({ modifiedDate: 'desc' }).exec();
        } else {
            postclapLists = await this.ProductDetails.findOne({ partNumberTrim: userInfo.id }).sort({ modifiedDate: 'desc' }).exec();
        }
        console.log('hi', postclapLists);
        if (postclapLists === null) {
            throw await new HttpException(AUTO_ERRORMSG.POST_NOT_EXIST, HttpStatus.NOT_FOUND);
        }
        if (postclapLists.status == -1 || postclapLists.status == -2)
            throw await new HttpException(AUTO_ERRORMSG.POST_JUNK_EXIST, HttpStatus.CONFLICT);

        console.log('postclapLists', postclapLists.status);
        if (!postclapLists.serialNumber) {
            postclapLists['serialNumber'] = 'NA';
        }
        if (!postclapLists.uuid) {
            postclapLists['uuid'] = 'NA';
        }

        return getSuccess(postclapLists);
    }


    async findpartDetailsById(userInfo: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', new1);
        let postclapLists = await this.ProductDetails.findOne({ _id: userInfo.id }).sort({ modifiedDate: 'desc' }).exec();
        console.log('hi', postclapLists);
        if (postclapLists === null) {
            throw await new HttpException(AUTO_ERRORMSG.POST_NOT_EXIST, HttpStatus.NOT_FOUND);
        }
        // if (postclapLists.status == 3)
        //     postclapLists.status = 2
        if (postclapLists.status >= -1)
            throw await new HttpException(AUTO_ERRORMSG.POST_JUNK_EXIST, HttpStatus.NOT_FOUND);
        console.log('postclapLists', postclapLists.status);

        return getSuccess(postclapLists);
    }

    async getBoxNo(userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', new1);
        let postclapLists = await this.ProductDetails.findOne({ userId: userId, clonedItem: { $ne: true } }).select({ "boxNumber": 1, "partMake": 1 }).sort({ createdDate: 'desc' }).exec();

        console.log('hi', postclapLists);

        return getSuccess(postclapLists);
    }


    async getUserList(userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', new1);
        //  let postclapLists = await this.ProductDetails.findOne({}).select({ "boxNumber": 1 }).sort({ createdDate: 'desc' }).exec();

        var connectionList = await this.ProductDetails.aggregate([
            {
                $match: {
                    $and: [{ "status": 0 }]
                }
            },
            {
                $group: {
                    _id: "$userId",
                    name: { $first: '$userName' },
                }
            }
        ]).exec();

        console.log('hi', connectionList);
        if (connectionList === null) {
            throw await new HttpException(AUTO_ERRORMSG.BOX_NOT_EXIST, HttpStatus.NOT_FOUND);
        }
        return getSuccess(connectionList);
    }


    async updateLocation(userInfo: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('login', new1);
        var list;
        const userDetil = await this.usersService.logInAuth(userId);
        if (userDetil) {
            // let postclapListArray = await this.ProductDetails.find({ partNumberTrim: userInfo.partTrim, partMake: userInfo.make }).sort({ modifiedDate: 'desc' }).exec();
            // console.log('line no 453 postclapListArray', postclapListArray );
            let postclapLists = await this.ProductDetails.findOne({ _id: userInfo.id }).sort({ modifiedDate: 'desc' }).exec();
            // let postclapLists = postclapListArray.find(x => x._id == userInfo.id);
            // console.log('line no 456 postclapLists', postclapLists );
            if (postclapLists === null) {
                throw await new HttpException(AUTO_ERRORMSG.POST_NOT_EXIST, HttpStatus.NOT_FOUND);
            }
            // if ((postclapLists.status == 2 || postclapLists.status == 3 || postclapLists.status == 4) && (postclapLists.itemID != null || postclapLists.itemID != undefined)) {
            //     if (postclapLists.location.length != 0)

            //         console.log('postclapLists', postclapLists.serialNumber);
            //     if (postclapLists.location != 'NA' || (postclapLists.serialNumber != undefined && postclapLists.serialNumber != 'NA'))
            //         throw await new HttpException(AUTO_ERRORMSG.POST_LISTED_EXIST, HttpStatus.NOT_FOUND);

            // }
            console.log('Welcome', postclapLists);
            const country = userInfo.partCountry == 'NA' ? 'NA' : userInfo.partCountry.toLowerCase().replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });

            let uuidRecord;
            if (postclapLists.serialNumber == '' || postclapLists.serialNumber == null ||
                postclapLists.serialNumber == undefined || postclapLists.serialNumber == 'NA') {
                if (userInfo.serialNumber && userInfo.serialNumber != '' && userInfo.serialNumber != 'NA') {
                    let alreadyExists = await this.ProductDetails.find({ serialNumber: userInfo.serialNumber }).sort({ modifiedDate: 'desc' }).count();
                    if (alreadyExists && alreadyExists > 0) {
                        throw await new HttpException(AUTO_ERRORMSG.SERIAL_NUMBER_EXIST, HttpStatus.BAD_REQUEST);
                    } else {
                        uuidRecord = await this.uuids.findOne({ type: userInfo.serialNumber });
                        if (uuidRecord == null) {
                            throw await new HttpException(AUTO_ERRORMSG.UUID_DOES_NOT_MATCH_FOR_SERIAL_NUMBER, HttpStatus.BAD_REQUEST);
                        } else {
                            let createLog = await this.serialNumberLogsModel.create({
                                createdDate: getDate(),
                                modifiedDate: getDate(),
                                partNumber: postclapLists.partNumberTrim,
                                serialNumber: userInfo.serialNumber,
                                type: 1,
                                description: 'Serial number attached to a part number'
                            });
                        }
                    }
                }
            } else {
                if (postclapLists.uuid == '' || postclapLists.uuid == null ||
                    postclapLists.uuid == undefined || postclapLists.uuid == 'NA') {
                    uuidRecord = await this.uuids.findOne({ type: userInfo.serialNumber });
                    if (uuidRecord == null) {
                        throw await new HttpException(AUTO_ERRORMSG.UUID_DOES_NOT_MATCH_FOR_SERIAL_NUMBER, HttpStatus.BAD_REQUEST);
                    }
                }
            }

            // if (userInfo.condition == "New, flawed" && !userInfo.notes.includes('New OEM less the box never installed')) {
            //     userInfo.notes = userInfo.notes + ', ' + 'New OEM less the box never installed'
            // }
            //let color = postclapListArray && postclapListArray.length > 0 ? this.getColor(postclapListArray) : 'Red';

            await this.ProductDetails.updateOne({
                _id: userInfo.id,
            }, {
                userName: userDetil.displayName,
                status: postclapLists.status >= 2 ? postclapLists.status : 1,
                partTitle: userInfo.partTitle,
                partQuantity: postclapLists.status > 1 ? +postclapLists.partQuantity : (+postclapLists.totalQuantity + (+userInfo.partQuantity)),
                partCountry: country,
                baseImageURL: userInfo.baseImageURL,
                partImages: userInfo.partImages,
                location: userInfo.location,
                boxNumber: userInfo.boxNumber,
                color: userInfo.color,
                placement: userInfo.placement.replace(/\s?$/, ''),
                condition: userInfo.condition,
                conditionId: userInfo.conditionId,
                notes: userInfo.notes,
                texture: userInfo.texture,
                // relistFlag: color,
                modifiedDate: getDate(),
                serialNumber: userInfo.serialNumber ? userInfo.serialNumber : (postclapLists.serialNumber ? postclapLists.serialNumber : 'NA'),
                uuid: userInfo.serialNumber && uuidRecord ? uuidRecord.uuid : (postclapLists.uuid ? postclapLists.uuid : 'NA'),
                totalQuantity: +postclapLists.totalQuantity + (+userInfo.partQuantity),
                availableQuantity: +postclapLists.availableQuantity + (+userInfo.partQuantity),
            }).exec();

            this.createActivityLog(userInfo.changes, userId, userDetil.displayName, userInfo.id);
            if (userInfo.partQuantity && +userInfo.partQuantity != 0) {
                let trackHistory = await this.stockHistoryModel.create({
                    partNumberSubId: userInfo.id,
                    partNumber: userInfo.partNumber,
                    createdDate: getDate(),
                    modifiedDate: getDate(),
                    quantityChange: +userInfo.partQuantity,
                    currentQuantity: +postclapLists.totalQuantity + (+userInfo.partQuantity),
                    oldQuantity: +postclapLists.totalQuantity,
                    description: stockHistoryMsg.STOCK_INCREASED_THROUGH_MOBILE,
                    type: 'User',
                    Name: userDetil.displayName
                });
            }

            // let stockDetails = await this.filteredStockModel.find({ partNumber: postclapLists.partNumberTrim }).exec();
            // console.log(stockDetails, "stockDetails");
            // if (stockDetails && stockDetails.length == 1) {
            //     let stockDetailsSubIdValue = stockDetails[0].subIdArrayValue.filter(x => x.subId.toString() != userInfo.id.toString());
            //     let subIdArrayMatchingValue = stockDetails[0].subIdArrayValue.filter(x => x.subId.toString() == userInfo.id.toString());
            //     let totalQuantity = (+stockDetails[0].totalQuantity) + (+userInfo.partQuantity);
            //     let availableQuantity = (+stockDetails[0].availableQuantity) + (+userInfo.partQuantity);
            //     let quantityDiff = +userInfo.partQuantity;
            //     if (subIdArrayMatchingValue && subIdArrayMatchingValue.length > 0) {
            //         quantityDiff = +userInfo.partQuantity;
            //         subIdArrayMatchingValue[0].totalQuantity = +subIdArrayMatchingValue[0].totalQuantity + (+userInfo.partQuantity);
            //         subIdArrayMatchingValue[0].availableQuantity = +subIdArrayMatchingValue[0].totalQuantity - (+subIdArrayMatchingValue[0].ebayQuantity);
            //         subIdArrayMatchingValue[0].boxNumber = userInfo.boxNumber;
            //         subIdArrayMatchingValue[0].location = userInfo.location;
            //         stockDetailsSubIdValue.push(subIdArrayMatchingValue[0]);
            //     } else {
            //         quantityDiff = +userInfo.partQuantity;
            //         stockDetailsSubIdValue.push({
            //             subId: userInfo.id,
            //             createdDate: getDate(),
            //             modifiedDate: getDate(),
            //             interChange: '',
            //             partNumber: postclapLists.partNumberTrim,
            //             partMake: postclapLists.partMake,
            //             boxNumber: userInfo.boxNumber,
            //             location: userInfo.location,
            //             status: postclapLists.status,
            //             itemId: postclapLists.itemID,
            //             totalQuantity: +postclapLists.totalQuantity + (+userInfo.partQuantity),
            //             availableQuantity: +postclapLists.availableQuantity + (+userInfo.partQuantity),
            //             ebayQuantity: +postclapLists.ebayQuantity,
            //             ecomQuantity: 0,
            //             // baseImageURL : userInfo.baseImageURL
            //         });
            //     }
            //     let updateFilteredData = await this.filteredStockModel.updateOne({ partNumber: postclapLists.partNumberTrim }, {
            //         $set: {
            //             modifiedData: getDate(),
            //             totalQuantity: totalQuantity,
            //             availableQuantity: availableQuantity,
            //             subIdArrayValue: stockDetailsSubIdValue
            //         }
            //     });
            //     if (updateFilteredData && quantityDiff != 0) {
            //         userInfo.quantityDiff = quantityDiff;
            //         userInfo.oldQuantity = (+postclapLists.totalQuantity);
            //         userInfo.partNumber = postclapLists.partNumberTrim;
            //         userInfo.newQuantity = (+postclapLists.totalQuantity) + (+userInfo.partQuantity);
            //         userInfo.description = "(" + (+userInfo.partQuantity) + ")" + stockHistoryMsg.QUANTITY_INCREASED_THROUGH_MOBILE;
            //         await this.updateHistory(userInfo);
            //     }

            // }
            // else {
            //     let nonFilteredStock: any = this.NonFilterStockModel.find({ splittedPartNumber : postclapLists.partNumberTrim}).exec();
            //     let newQuantity = (+nonFilteredStock[0].totalQuantity) + ((+postclapLists.totalQuantity) + (+userInfo.partQuantity));
            //     if (nonFilteredStock && nonFilteredStock.length == 1) {
            //         let subIdArray = [
            //             {
            //                 subId: userInfo.id,
            //                 createdDate: getDate(),
            //                 interChange: nonFilteredStock[0].interChange,
            //                 partNumber: postclapLists.partNumberTrim,
            //                 partMake: userInfo.partMake,
            //                 boxNumber: userInfo.boxNumber,
            //                 location: userInfo.location,
            //                 status: postclapLists.status,
            //                 itemId: postclapLists.itemID,
            //                 totalQuantity: newQuantity,
            //                 availableQuantity: newQuantity,
            //                 ebayQuantity: postclapLists.ebayQuantity,
            //                 ecomQuantity: 0
            //             }
            //         ];
            //         let createFilteredData = await this.filteredStockModel.create({
            //             createdDate: getDate(),
            //             modifiedDate: getDate(),
            //             interChange: '',
            //             partNumber: postclapLists.partNumberTrim,
            //             location: userInfo.location,
            //             totalQuantity: newQuantity,
            //             availableQuantity: newQuantity,
            //             ebayQuantity: postclapLists.ebayQuantity,
            //             ecomQuantity: 0,
            //             subIdArrayValue: subIdArray
            //         })
            //         if (createFilteredData) {
            //             let deleteNonFilteredData = await this.NonFilterStockModel.deleteOne({_id : mongoose.Types.ObjectId(nonFilteredStock[0]._id)})
            //             userInfo.partNumber = postclapLists.partNumberTrim;
            //             userInfo.oldQuantity = postclapLists.totalQuantity;
            //             userInfo.newQuantity = newQuantity;
            //             userInfo.quantityDiff = newQuantity - postclapLists.totalQuantity;
            //             userInfo.description = userInfo.quantityDiff > 0 ? 'Quantity increased and moved to Stock while Mobile edit' : 'Quantity decreased and moved to Stock while Mobile edit'
            //             this.updateHistory(userInfo);
            //         }
            //     }               

            // }

            list = {
                status: 1,
                message: "Updated Sucessfully"
            }
        }
        else {
            throw new BadRequestException(AUTO_ERRORMSG.USER_NOT_EXIST)
        }
        return getSuccess(list);
    }


    async createActivityLog(data: any, userId: string, name: string, id: string) {
        await Promise.all(data.map(async (value, index) => {

            if (value.value != '' && value.Id != 7) {
                console.log('colors', index, value)
                var user = await this.ProductActivityLog.create({
                    userId: userId,
                    userName: name,
                    partId: id,
                    status: 1,
                    role: "User",
                    value: value.Id == 7 ? "" : value.value,
                    createdDate: getDate(),
                    modifiedDate: getDate(),
                    activityId: value.Id,
                    activityName: value.name,
                    colorValue: value.Id == 7 ? value.colorValue : [],
                });
            }
            else if (value.Id == 7) {
                console.log('colorValue', index, value.colorValue.length)
                if (value.colorValue.length != 0)
                    var user = await this.ProductActivityLog.create({
                        userId: userId,
                        userName: name,
                        partId: id,
                        status: 1,
                        role: "User",
                        value: value.Id == 7 ? "" : value.value,
                        createdDate: getDate(),
                        modifiedDate: getDate(),
                        activityId: value.Id,
                        activityName: value.name,
                        colorValue: value.Id == 7 ? value.colorValue : [],
                    });
            }
        }));

    }

    async getActivitylist(searchText: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', searchText);
        if (searchText.paginator.nextPage === 0)
            throw new BadRequestException(AUTO_ERRORMSG.NEXTPAGE_NOT_EXIST);
        var clapList = [];
        var room_condition;

        if (searchText.activityId === undefined || searchText.activityId.length == 0)
            room_condition = { '$ne': 0 };
        else
            room_condition = { $in: searchText.activityId };


        var skip = ((searchText.paginator.nextPage * searchText.paginator.pageSize) - searchText.paginator.pageSize);
        const postclapLists = await this.ProductActivityLog.find({ activityId: room_condition, partId: searchText.id })
            .sort({ createdDate: 'desc' }).skip(skip).limit(searchText.paginator.pageSize + 1);
        let lastPaginateKey = 0;
        let previousPaginateKey = 0;

        await Promise.all(postclapLists.map(async (value, index) => {
            //  for (var t = 0; t < postclapLists.length; t++) {
            lastPaginateKey = value.createdDate;
            if (index < searchText.paginator.pageSize) {
                clapList.push({
                    activityId: value.activityId,
                    userName: value.userName,
                    value: value.activityId == 7 ? "" : value.value,
                    colorValue: value.activityId == 7 ? value.colorValue : [],
                    activityName: value.activityName,
                    role: value.role,
                    createdDate: value.createdDate
                });
            }
        }));

        if (postclapLists.length - 1 == searchText.paginator.pageSize) {
            lastPaginateKey = searchText.paginator.nextPage + 1;
            previousPaginateKey = searchText.paginator.nextPage - 1;
        }
        else {
            lastPaginateKey = 0;
            previousPaginateKey = searchText.paginator.nextPage - 1;
        }
        var result = {
            list: await clapList.sort(function (a, b) {
                return b.createdDate - a.createdDate;
            }),
            paginator: {
                pageSize: searchText.paginator.pageSize,
                pageNumber: searchText.paginator.nextPage + 1,
                totalPages: searchText.paginator.nextPage + 1,
                nextPage: lastPaginateKey,
                previousPage: previousPaginateKey,
            }
        };
        return getSuccess(result);
    }

    async getActivityStatus(data: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', new1);
        let postclapLists = await this.ProductActivityLog.find({ partId: data.partId }).select({ "boxNumber": 1 }).count().exec();
        console.log('hi', postclapLists);

        return getSuccess(postclapLists);
    }

    async partSearch(userInfo: any, userId: string) {
        var new1 = await this.usersService.ValidateUser(userId);
        console.log('hi', userInfo);
        let searchValue = userInfo.partNo;
        let numericSearchValue = searchValue.replace(/^0+/, "");
        try {
            let result = await this.ProductDetails.aggregate([
                {
                    "$search": {
                        "index": "partsearch",
                        "compound": {
                            "should": [
                                {
                                    "autocomplete": {
                                        "path": "partNumberTrim",
                                        "query": searchValue
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "path": "partNumberTrim",
                                        "query": numericSearchValue
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "path": "partNumberTrim",
                                        "query": `0${searchValue}`
                                    }
                                }
                            ],
                            "minimumShouldMatch": 1
                        }

                    }
                },
                {
                    $project: { partNumberTrim: 1, condition: 1, status: 1 }
                },
                {
                    $sort:
                    {
                        "createdDate": -1,
                    }
                },
                {
                    "$group": {
                        "_id": "$_id",
                        "partNumber": { "$first": "$partNumberTrim" },
                        "condition": { "$first": "$condition" },
                        "status": { "$first": "$status" }
                    }
                }
            ]);

            console.log('result', result);
            // let getColorCode = await result.map(async(x: any) => {
            //     console.log(x, "x in line 962");
            //   if(x && x.partNumber) {
            //     let matchingParts = await this.ProductDetails.find({partNumberTrim : x.partNumber}).select({status: 1}).exec();
            //     console.log(matchingParts, "matchingParts");
            //     let color = this.getColor(matchingParts);
            //     console.log(color, "color in line 967");
            //     console.log(colorCode[color], "colorCode[color]");
            //     x['colorCode'] = colorCode[color];
            //     console.log(x.colorCode, "colorcode");
            //   }
            // })
            // let results = await Promise.all(getColorCode);
            return getSuccess(result);
        } catch (e) {
            throw await new HttpException(e.message, HttpStatus.NOT_FOUND);
        }
    }

    async loadNewInventory() {

        let moveToStockList = await this.ProductDetails.find({ addedToStock: false, status: { $in: [0, 1] } }).sort({ modifiedDate: 'desc' }).limit(5).exec();

        await moveToStockList.forEach(async (userInfo) => {

            let partTrim: any;
            let superSeedListById = await this.superSeededPartDetails.findOne({ SuperSeedList: { $regex: userInfo.partNumberTrim, $options: 'i' } }).exec();

            if (superSeedListById != null) {
                partTrim = superSeedListById.BasePart;
            }
            else {
                partTrim = userInfo.partNumberTrim;
            }

            console.log('partNumber', partTrim);
            let stockDetails = await this.filteredStockModel.find({ partNumber: partTrim }).exec();

            if (stockDetails && stockDetails.length == 1) {
                let stockDetailsSubIdValue = stockDetails[0].subIdArrayValue.filter(x => x.subId.toString() != userInfo._id.toString());

                let subIdArrayMatchingValue = stockDetails[0].subIdArrayValue.filter(x => x.subId.toString() == userInfo._id.toString());

                let totalQuantity = 0;
                let availableQuantity = 0;
                if (subIdArrayMatchingValue && subIdArrayMatchingValue.length > 0) {
                    totalQuantity = ((+stockDetails[0].totalQuantity) - (+subIdArrayMatchingValue[0].totalQuantity)) + (+userInfo.partQuantity);
                    availableQuantity = (totalQuantity - (+stockDetails[0].ebayQuantity));
                    subIdArrayMatchingValue[0].totalQuantity = (+userInfo.partQuantity);
                    subIdArrayMatchingValue[0].availableQuantity = (+userInfo.partQuantity) - (+subIdArrayMatchingValue[0].ebayQuantity);
                    stockDetailsSubIdValue.push(subIdArrayMatchingValue[0]);
                } else {
                    totalQuantity = (+stockDetails[0].totalQuantity) + (+userInfo.partQuantity);
                    availableQuantity = (+stockDetails[0].availableQuantity) + (+userInfo.partQuantity);
                    stockDetailsSubIdValue.push({
                        subId: userInfo._id,
                        createdDate: getDate(),
                        modifiedDate: getDate(),
                        interChange: '',
                        partNumber: partTrim,
                        partMake: userInfo.partMake,
                        boxNumber: userInfo.boxNumber,
                        location: userInfo.location,
                        status: 0,
                        itemId: '',
                        totalQuantity: +userInfo.partQuantity,
                        availableQuantity: +userInfo.partQuantity,
                        ebayQuantity: 0,
                        ecomQuantity: 0,
                        //baseImageURL :userInfo.baseImageURL
                    });
                    console.log(stockDetailsSubIdValue, "stockDetailsSubIdValue in line no 212");
                }

                let updateFilteredData = await this.filteredStockModel.updateOne({ partNumber: partTrim }, {
                    $set: {
                        modifiedDate: getDate(),
                        totalQuantity: totalQuantity.toString(),
                        availableQuantity: availableQuantity.toString(),
                        subIdArrayValue: stockDetailsSubIdValue
                    }
                }).exec();
                //console.log(updateFilteredData, "updateFilteredData");
                if (updateFilteredData) {
                    userInfo.partNumber = partTrim;
                    userInfo.id = userInfo._id;
                    userInfo.oldQuantity = 0;
                    userInfo.newQuantity = +userInfo.partQuantity;
                    userInfo.quantityDiff = +userInfo.partQuantity;
                    userInfo.description = stockHistoryMsg.ADDED_STOCK_FROM_MOBILE;
                    await this.updateHistory(userInfo);
                }
            } else {
                //let postclapLists = await this.ProductDetails.find({ partNumberTrim: partTrim}).sort({ modifiedDate: 'desc' }).exec();
                //console.log(postclapLists,'postclapLists');
                if (userInfo && userInfo.length == 0) {
                    let nonFilteredStock: any = await this.NonFilterStockModel.find({ description: { $regex: partTrim.replace(/-|_|\s/g, "").trim(), $options: 'i' } }).exec();
                    //console.log(nonFilteredStock, "nonFilteredStock");
                    if (nonFilteredStock && nonFilteredStock.length == 1) {
                        let subIdArray = [
                            {
                                subId: userInfo._id,
                                createdDate: getDate(),
                                interChange: nonFilteredStock[0].interChange,
                                partNumber: partTrim,
                                partMake: userInfo.partMake,
                                boxNumber: userInfo.boxNumber,
                                location: userInfo.location,
                                status: 0,
                                itemId: '',
                                totalQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity),
                                availableQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity),
                                ebayQuantity: 0,
                                ecomQuantity: 0,
                                // baseImageURL: userInfo.baseImageURL,
                                nonFilterRows: [
                                    {
                                        stockId: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0]._id ? nonFilteredStock[0]._id : '',
                                        interChange: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].interChange ? nonFilteredStock[0].interChange : '',
                                        partNumber: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].partNumber ? nonFilteredStock[0].partNumber : '',
                                        totalQuantity: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].totalQuantity ? nonFilteredStock[0].totalQuantity : '',
                                        location: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].location ? nonFilteredStock[0].location : '',
                                        splittedPartNumber: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].splittedPartNumber ? nonFilteredStock[0].splittedPartNumber : ''
                                    }
                                ]
                            }
                        ];
                        //console.log(subIdArray, "subIdArray");
                        let createFilteredData = await this.filteredStockModel.create({
                            createdDate: getDate(),
                            modifiedDate: getDate(),
                            interChange: nonFilteredStock[0].interChange,
                            partNumber: partTrim,
                            location: userInfo.location,
                            totalQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity),
                            availableQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity),
                            ebayQuantity: 0,
                            ecomQuantity: 0,
                            subIdArrayValue: subIdArray
                        })
                        //console.log(createFilteredData, "createFilteredData");
                        if (createFilteredData) {
                            let deleteNonFilteredData = await this.NonFilterStockModel.deleteOne({ _id: mongoose.Types.ObjectId(nonFilteredStock[0]._id) }).exec();
                            console.log(deleteNonFilteredData, "deleteNonFilteredData");
                            userInfo.partNumber = partTrim;
                            userInfo.oldQuantity = 0;
                            userInfo.newQuantity = (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity);
                            userInfo.quantityDiff = (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity);
                            userInfo.id = userInfo._id;
                            userInfo.description = `${nonFilteredStock[0].totalQuantity}` + stockHistoryMsg.QUANTITY_INCREASED_BY_ADDING_TO_EXCEL;
                            userInfo.nonFilterRows = {
                                stockId: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0]._id ? nonFilteredStock[0]._id : '',
                                interChange: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].interChange ? nonFilteredStock[0].interChange : '',
                                partNumber: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].partNumber ? nonFilteredStock[0].partNumber : '',
                                totalQuantity: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].totalQuantity ? nonFilteredStock[0].totalQuantity : '',
                                location: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].location ? nonFilteredStock[0].location : '',
                                splittedPartNumber: nonFilteredStock && nonFilteredStock[0] && nonFilteredStock[0].splittedPartNumber ? nonFilteredStock[0].splittedPartNumber : ''
                            }
                            // let productDetailUpdate = await this.ProductDetails.updateOne({_id: mongoose.Types.ObjectId(user._id)}, {
                            //     $set : {
                            //          partQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity),
                            //          totalQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity),
                            //          availableQuantity: (+nonFilteredStock[0].totalQuantity) + (+userInfo.partQuantity)
                            //     }
                            // })
                            await this.updateHistory(userInfo, 'nonFilter');
                        }
                    } else {
                        let subIdArray = [
                            {
                                subId: userInfo._id,
                                createdDate: getDate(),
                                interChange: '',
                                partNumber: partTrim,
                                partMake: userInfo.partMake,
                                boxNumber: userInfo.boxNumber,
                                location: userInfo.location,
                                status: 0,
                                itemId: '',
                                totalQuantity: (+userInfo.partQuantity),
                                availableQuantity: (+userInfo.partQuantity),
                                ebayQuantity: 0,
                                ecomQuantity: 0,
                                // baseImageURL : userInfo.baseImageURL
                            }
                        ];
                        //console.log(subIdArray, "subIdArray");
                        let createFilteredData = await this.filteredStockModel.create({
                            createdDate: getDate(),
                            modifiedDate: getDate(),
                            interChange: '',
                            partNumber: partTrim,
                            location: userInfo.location,
                            totalQuantity: (+userInfo.partQuantity),
                            availableQuantity: (+userInfo.partQuantity),
                            ebayQuantity: 0,
                            ecomQuantity: 0,
                            subIdArrayValue: subIdArray
                        })
                        //console.log(createFilteredData, "createFilteredData");
                        if (createFilteredData) {
                            userInfo.partNumber = partTrim;
                            userInfo.oldQuantity = 0;
                            userInfo.newQuantity = (+userInfo.partQuantity);
                            userInfo.quantityDiff = (+userInfo.partQuantity);
                            userInfo.id = userInfo._id;
                            userInfo.description = stockHistoryMsg.ADDED_STOCK_FROM_MOBILE;
                            await this.updateHistory(userInfo);
                        }
                    }
                }

            }

        });
        //console.log('userId.revertId', userInfo.revertId)


        // if (userInfo.revertId && userInfo.revertId != '' && userInfo.revertId != 'NA') {
        //     console.log(userInfo.revertId, "revertId in line no 348");
        //     let revertIdDetails = await this.ProductDetails.find({ _id: mongoose.Types.ObjectId(userInfo.revertId) }).exec();
        //     // console.log(revertIdDetails, "revertIdDetails");
        //     if (revertIdDetails && revertIdDetails.length == 1) {
        //         let stockDetails = await this.filteredStockModel.find({ partNumber: revertIdDetails[0].partNumber }).exec();
        //         //  console.log(stockDetails, "stockDetails");
        //         if (stockDetails && stockDetails.length == 1) {
        //             let revertMatchStock = stockDetails[0].subIdArrayValue.filter(x => x.subId.toString() == userInfo.revertId.toString());
        //             //  console.log(revertMatchStock, "revertMatchStock");
        //             let noMatchStock = stockDetails[0].subIdArrayValue.filter(x => x.subId.toString() != userInfo.revertId.toString());
        //             // console.log(noMatchStock, "noMatchStock in line no 340");
        //             if (revertMatchStock && revertMatchStock.length == 1) {
        //                 stockDetails[0].totalQuantity = stockDetails[0].totalQuantity - revertMatchStock[0].totalQuantity;
        //                 stockDetails[0].availableQuantity = stockDetails[0].availableQuantity - revertMatchStock[0].availableQuantity;
        //                 revertMatchStock[0].totalQuantity = 0;
        //                 revertMatchStock[0].availableQuantity = 0;
        //             }
        //             noMatchStock.concat(revertMatchStock[0]);
        //             //  console.log(noMatchStock, "noMatchStock in line no 348");
        //             let stockUpdate = await this.filteredStockModel.updateOne({ partNumber: revertIdDetails[0].partNumber }, {
        //                 $set: {
        //                     modifiedDate: getDate(),
        //                     totalQuantity: stockDetails[0].totalQuantity,
        //                     availableQuantity: stockDetails[0].availableQuantity,
        //                     subIdArrayValue: noMatchStock
        //                 }
        //             }).exec();
        //             // console.log(stockUpdate, "stockUpdate");
        //         }
        //         let revertProductUpdate = await this.ProductDetails.updateOne({ _id: userInfo.revertId }, {
        //             $set: {
        //                 partQuantity: 0,
        //                 totalQuantity: 0,
        //                 availableQuantity: 0,
        //                 modifiedDate: getDate()
        //             }
        //         }).exec();
        //         if (revertProductUpdate) {
        //             //  console.log(revertProductUpdate, "revertProductUpdate");
        //             userInfo.partNumber = revertIdDetails[0].partNumber;
        //             userInfo.oldQuantity = +revertIdDetails[0].totalQuantity;
        //             userInfo.newQuantity = 0;
        //             userInfo.quantityDiff = 0 - (+revertIdDetails[0].totalQuantity);
        //             //userInfo.revertId = +revertIdDetails[0]._id;
        //             userInfo.description = stockHistoryMsg.STOCK_DECREASED_AND_ADDED_TO_NEW_ITEM;
        //             await this.updateHistory(userInfo);
        //         }
        //     }

        // }
    }




    async updatePlacementListValue(request, userId) {
        try {
            let updatePlacementList: any = await this.settingModel.updateOne({}, {
                $set: {
                    "OtherInfo.Placement": request.Placement
                }
            }).exec();
            if (updatePlacementList) {
                return { isOk: true, message: 'Placement updated successfully' }
            } else {
                return { isOk: false, message: 'Placement updation failed' }
            }

        } catch (error) {
            console.log(error, "error in line 1483");
        }
    }

    async updateColorListValue(request, userId) {
        try {
            let updatePlacementList: any = await this.settingModel.updateOne({}, {
                $set: {
                    "OtherInfo.Colors": request.Colors
                }
            }).exec();
            if (updatePlacementList) {
                return { isOk: true, message: 'Color updated successfully' }
            } else {
                return { isOk: false, message: 'Color updation failed' }
            }

        } catch (error) {
            console.log(error, "error in line 1483");
        }
    }




}


