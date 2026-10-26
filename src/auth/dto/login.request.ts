import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";


export class LoginRequest {
  @ApiProperty()
  @IsString({ message: "Please enter 'email" })
  email:string;

  @ApiProperty()
  @IsString({ message: "Please enter 'fname" })
  fname:string;

  @ApiProperty()
  @IsString({ message: "Please enter 'fname" })
  mobilenumber:string;
}
