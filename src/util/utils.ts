import * as CryptoJS from 'crypto-js';

export const encryptData = (msg) => {
    var key = CryptoJS.enc.Utf8.parse('3s5v8y/B?E(H+MbQ');
    var iv = CryptoJS.enc.Utf8.parse('3s5v8y/B?E(H+MbQ');
    var encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(msg), key,
        {
            keySize: 128 / 8,
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

    var decrypted = CryptoJS.AES.decrypt(encrypted, key, {
        keySize: 128 / 8,
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    const enc = 'Encrypted ---:' + encrypted;
    return enc.slice(14);
}

export const encryptDataAccount = (msg) => {
    var key = CryptoJS.enc.Utf8.parse('3s5v8y/B?E(H+MbQ');
    var iv = CryptoJS.enc.Utf8.parse('3s5v8y/B?E(H+MbQ');

    // var encrypted = CryptoJS.AES.encrypt(JSON.stringify(msg, "xfnr3PVyckouBZxW");
    //  console.log(encrypted.toString());
    return CryptoJS.AES.encrypt(JSON.stringify(msg), key, {
        keySize: 128 / 8,
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    }).toString();
    // var encrypted = CryptoJS.AES.encrypt(msg, key,
    //     {
    //         keySize: 128 / 8,
    //         iv: iv,
    //         mode: CryptoJS.mode.CBC,
    //         padding: CryptoJS.pad.Pkcs7
    //     });
    //const enc = 'Encrypted ---:' + encrypted;
    // return enc.slice(14);

}
export const decryptData = (msg) => {
    let _key = CryptoJS.enc.Utf8.parse('3s5v8y/B?E(H+MbQ');
    let _iv = CryptoJS.enc.Utf8.parse('3s5v8y/B?E(H+MbQ');

    return CryptoJS.AES.decrypt(msg, _key, {
        keySize: 128 / 8,
        iv: _iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    }).toString(CryptoJS.enc.Utf8);
}


export const getDate = () => {
    return Math.trunc(new Date().getTime() / 1000)
}

export const getSuccess = (resultData: any) => {
    return {
        isOk: true,
        data: resultData
    }
}

export const getFailed = (message: string) => {
    return {
        isOk: false,
        message: message
    }
}

export const BASE64String = (length) => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}


export const randomString = (length) => {
    var result = '';

    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
