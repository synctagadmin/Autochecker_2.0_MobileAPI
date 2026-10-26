// const https = require('https');

import { BadRequestException, HttpStatus } from "@nestjs/common";
import { triggerAsyncId } from "async_hooks";

// export const httpsPost = (msg) => {

//   var username = 'rzp_test_wwVVWvbM40vF9d';
//   var password = '9FVA7fUBnwpuG7ZLLd7K0tm8';
//   var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

//   const data = JSON.stringify({
//     "amount": 2500,
//     "currency": "INR"
//   });




//   var hostName = "api.razorpay.com";
//   var path = "/v1/payments/pay_JlEMXEqnoT87iQ/capture";

//   const options = {
//     hostname: hostName,
//     path: path,
//     port: 8080,
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': auth,
//       'Content-Length': Buffer.byteLength(data)
//     }
//   };

//   console.log(`options:'` + options)
//   const req = https.request(options, (res) => {
//     console.log(`statusCode: ${res.statusCode}`)
//     res.on('data', (chunk) => {
//       console.log(`BODY: ${chunk}`);
//     });
//     res.on('end', () => {
//       console.log('No more data in response.');
//     });
//   });

//   req.on('error', (error) => {
//     console.log('error is ' + error);
//   });

//   req.write(data);
//   req.end();
// }
const Razorpay = require('razorpay');

export const httpsPost = async (obj) => {
  var instance = new Razorpay({
    key_id: 'rzp_test_wwVVWvbM40vF9d',
    key_secret: '9FVA7fUBnwpuG7ZLLd7K0tm8',
  });
  //var obj = JSON.parse(msg);
  console.log('msg', obj);
  let data1;
  try {
    data1 = await instance.payments.capture(obj.id, obj.amount, obj.currency);
  }
  catch (e) {
    throw new BadRequestException(e.description);
  }  //console.log(JSON.stringify(data1, null, 4));
  // var data = await instance.payments.fetch(obj.id);
  //console.log(JSON.stringify(data, null, 4));
  return JSON.stringify(data1, null, 4);
};