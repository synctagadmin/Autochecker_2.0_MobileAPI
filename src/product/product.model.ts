import * as mongoose from 'mongoose';

export const ProductDetailsSchema = new mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, require: true, ref: "UserDetails" },
    userName: { type: String },
    status: { type: Number },
    partNumber: { type: String },
    partNumberTrim: { type: String },
    partNumberBase: { type: String },
    interChangePartNumber: { type: String },
    partTitle: { type: String },
    partQuantity: { type: Number },
    partMake: { type: String },
    partCountry: { type: String },
    partImages: { type: Object },
    baseImageURL: { type: String },
    boxNumber: { type: String },
    location: { type: String },
    // Multi-select: an ARRAY of {Id, name, colorCode}. Declared Object (i.e. Mixed), which
    // already accepts both this and the single object it used to hold, so documents
    // written before the change still hydrate. See util/partFields.ts.
    color: { type: Object },
    placement: { type: String },
    condition: { type: String },
    conditionId: { type: String },
    isLoadStatus: { type: Number },
    isProductStatus: { type: Number },
    price: { type: String },
    priceValue: { type: Number },
    loadedDate: { type: Number },
    itemID: { type: String },
    itemUploadDate: { type: Number },
    // Multi-select: an ARRAY of strings. Mixed rather than Array because every product
    // written before this change holds a bare string here, and a String-typed path would
    // mis-cast the array while an Array-typed one throws a CastError hydrating the old
    // value. Mixed reads both; util/partFields.ts normalises.
    texture: { type: mongoose.Schema.Types.Mixed },
    // Multi-select: an ARRAY of strings, drawn from settings.OtherInfo.Finish. New field,
    // so it is absent on every existing document - readers must treat that as [].
    finish: { type: mongoose.Schema.Types.Mixed },
    // Shipping weight (lbs + oz) and package dimensions in inches. Absent on existing
    // documents; absent in a request means "leave alone", not zero.
    lbs: { type: Number },
    oz: { type: Number },
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
    notes: { type: String },
    adminId: { type: mongoose.Types.ObjectId, require: true, ref: "admindetail" },
    adminName: { type: String },
    createdDate: { type: Number },
    relistFlag: { type: String },
    adminNote: { type: String },
    customFields: { type: String },
    id: { type: mongoose.Types.ObjectId, require: true },
    modifiedDate: { type: Number },
    isSelectedCheckBox: { type: Boolean },
    junkStatus: { type: Number },
    serialNumber: { type: String },
    uuid: { type: String },
    scrapPartNumber: { type: String },
    otherImages: { type: Object },
    isExcelFlag: { type: Number },
    interChangePartNumberFlag: { type: Number },
    totalQuantity: { type: Number },
    availableQuantity: { type: Number },
    ebayQuantity: { type: Number },
    ecomQuantity: { type: Number },
    addedToStock: { type: Boolean },
    clonedItem: { type: Boolean },
    returnId: { type: String }
});

export const SerialNumberLogsSchema = new mongoose.Schema({
    createdDate: { type: Number },
    modifiedDate: { type: Number },
    serialNumber: { type: String },
    type: { type: Number },
    description: { type: String },
    partNumber: { type: String },
    partId: { type: mongoose.Types.ObjectId },
    status: { type: Number },
    userType: { type: String },
    userName: { type: String }
})


export const ProductScrapDetailSchema = new mongoose.Schema({
    status: { type: Number },
    brand: { type: String },
    OtherData: { type: String },
    partNumber: { type: String },
    createdDate: { type: Number },
    modifiedDate: { type: Number }
});
export const ProductActivitySchema = new mongoose.Schema({
    partId: { type: mongoose.Types.ObjectId, require: true },
    userId: { type: mongoose.Types.ObjectId, require: true },
    userName: { type: String },
    activityId: { type: Number },
    activityName: { type: String },
    value: { type: String },
    colorValue: { type: Array },
    role: { type: String },
    createdDate: { type: Number },
    modifiedDate: { type: Number },
    screen: { type: String }
});



export const ProducteBayDataSchema = new mongoose.Schema({
    itemID: { type: String },
    viewItemURL: { type: String },
    partNumber: { type: String },
    brand: { type: String },
    OtherData: { type: String },
    price: { type: String },
    condition: { type: String },
    createdDate: { type: Number },
    modifiedDate: { type: Number }
});

export const uuids = new mongoose.Schema({
    uuid: { type: String },
    type: { type: String },
    createdDate: { type: Number }
});

export const FilteredStockSchema = new mongoose.Schema({
    createdDate: { type: Number },
    modifiedDate: { type: Number },
    interChange: { type: String },
    partNumber: { type: String },
    location: { type: String },
    status: { type: String },
    totalQuantity: { type: String },
    availableQuantity: { type: String },
    ebayQuantity: { type: String },
    ecomQuantity: { type: String },
    subIdArrayValue: { type: Array }
})

export const StockHistorySchema = new mongoose.Schema({
    partNumberSubId: { type: mongoose.Types.ObjectId, required: true },
    createdDate: { type: Number },
    modifiedDate: { type: Number },
    currentQuantity: { type: Number },
    oldQuantity: { type: Number },
    description: { type: String },
    comments: { type: String, default: "" },
    quantityChange: { type: Number },
    partNumber: { type: String },
    nonFilterRows: { type: Object },
    type: { type: String },
    Name: { type: String }
})

export const NonFilteredStockSchema = new mongoose.Schema({
    createdDate: { type: Number },
    modifiedDate: { type: Number },
    interChange: { type: String },
    totalQuantity: { type: String },
    splittedPartNumber: { type: String },
    partNumber: { type: String },
    location: { type: String },
    errorData: { type: Boolean },
    noMatching: { type: Boolean },
    multipleMatching: { type: Boolean },
    stockStatus: { type: Number },
    hasEbayData: { type: Boolean },
    description: { type: String },
    ebayPartNumber: { type: String },
    countUpdated: { type: Boolean },
    newInventoryPartNumber: { type: String },
    superSeededPartNumber: { type: String },
    alreadyExistsInStock: { type: Boolean },
    duplicateRecordExists: { type: Boolean },
    mergeHistory: { type: Object },
    productDetailStatus: { type: Array }
})
export const SuperSeededPartDetails = new mongoose.Schema({
    Id: { type: Number },
    BasePart: { type: String },
    SuperSeedList: { type: String },
    createdDate: { type: Number },
    modifiedDate: { type: Number }
});
