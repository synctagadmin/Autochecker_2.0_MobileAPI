import { BadRequestException } from "@nestjs/common"
import { LoginRequest } from "src/auth/dto/login.request"
import { getFailed } from "./utils"

export const ValidateLogin=(loginRequest:any)=>{
     console.log(loginRequest)
     if(loginRequest.mobilenumber!='' && loginRequest.email!='')
     return getFailed("Please enter your email or mobile number")
}