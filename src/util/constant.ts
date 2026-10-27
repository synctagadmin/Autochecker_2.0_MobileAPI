export const AUTO_ERRORMSG = {
    APPLICATION_ERROR: 'Oops! Something went wrong',
    THREAD_LIMIT_AVAILABLE: 'Member limit available',
    THREAD_LIMIT_EXIST: 'Member limit exceeds',
    LAT_LONG__NOT_EXIST: 'Location data unavailable',
    LOGGED_USER_NOT_EXIST: 'Current logged user does not exist',
    USER_NOT_EXIST: 'User does not exist',
    USER_NOT_MATCH: 'Invalid Email Id or Password',
    EMAIL_NOT_MATCH: 'Email id does not exist',
    EMAIL_SEND: 'Email sent sucessfully',
    PWD_NOT_MATCH: 'Existing password does not match',
    POST_NOT_EXIST: 'Auto part does not exist',
    POST_LISTED_EXIST: 'Auto part already listed in eBay',
    BOX_NOT_EXIST: 'Box No does not exist',
    POST_EXIST: 'Part info already exist',
    POST_DELETE: 'This auto part is deleted by the user',
    POSTTYPE_NOT_EXIST: 'Post type does not exist',
    POST_ALLOWANONMOUS: 'Anonymous user does not exist',
    NEXTPAGE_NOT_EXIST: 'No more data available',
    NO_MORE_DATA: 'No more auto part available',
    COMMON_ERROR_BLOCK: 'Oops! Something went wrong',
    COUNTRY_CODE: 'Country code is missing',
    LOADER_KEY_NOT_MATCHED: 'The key does not match ',
    POST_JUNK_EXIST: 'This auto part number has been classified as junk data',
    SERIAL_NUMBER_EXIST: 'RFID number already exist',
    UUID_DOES_NOT_MATCH_FOR_SERIAL_NUMBER: 'No matching UUID was found for the respective RFID number',
    INVALID_REQUEST: 'Invalid Request'
}


export const SPARK_NOTIFY = {
    CLAP: 1,
    VIEW: 2,
    THREAD: 3,
    THREAD_REQUEST: 4,
    CONTACT: 5,
    THREAD_REVEAL: 6,
    BUBBLE: 7,
    MONETIZETHREAD: 8,
}

export const SPARK_MONETIZE = {
    PENDING: 2,
    SUCESS: 3,
    REFUNDINIT: 4,
    REFUNDSUCESS: 5,
    PAYMENTSUCESS: 6
}

export const SPARK_THREAD_STATUS = {
    REQUESTNOTACCEPTED: 0,
    INACTIVE: 1,
    ACTIVE: 2,
    LEFT: 3
}

/**
 * The shared key the loader endpoints check before they will run
 * (load.controller.ts compares it against the `key` on the request).
 *
 * It was a literal in this file, in a public repository, which made the check decorative:
 * anyone reading the source could satisfy it. No fallback, for the same reason as
 * JWT_SECRET - a deployment that falls back to the published value looks fixed and is not.
 *
 * Read through a getter rather than at module load. This file is imported by nearly every
 * module here, some of them before app.module.ts's body runs dotenv.config(), and the
 * loader only ever reads this per request - long after .env is in place either way.
 */
export const LOADER_KEY = {
    get KEY(): string {
        const key = process.env.LOADER_KEY;
        if (!key) {
            throw new Error(
                'LOADER_KEY is not set. Put it in this repository\'s .env (local) or the ' +
                'deployment\'s shared/.env at /var/www/autochecker/mobileapi/shared/.env. ' +
                'See .env.example.',
            );
        }
        return key;
    },
}

export const stockHistoryMsg = {
    QUANTITY_INCREASED_BY_ADDING_TO_EXCEL: ' Quantity(s) increased by adding it to Excel quantity and Added to Stock through Mobile',
    STOCK_INCREASED_THROUGH_MOBILE: 'Stock increased through Mobile',
    QUANTITY_DECREASED_THROUGH_MOBILE: 'Quantity(s) decreased through Mobile',
    ADDED_STOCK_FROM_MOBILE: 'Added Stock through Mobile',
    STOCK_DECREASED_AND_ADDED_TO_NEW_ITEM: 'Quantity(s) decreased and appended to the new item created'
}

export const colorCode = {
    Red: "#ff0000",
    Yellow: "#FFFF00",
    Orange: "#FFA500",
    Blue: "#0000FF",
    Green: "#099521",
    Purple: "#A569BD"
}