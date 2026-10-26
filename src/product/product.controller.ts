import { Body, Controller, Post, UseGuards, Request, UnauthorizedException, Get, Param, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MobileInputRequest } from 'src/users/users.model';
import { decryptData, encryptData } from 'src/util/utils';

import { productService } from './product.service';
import { AUTO_ERRORMSG, LOADER_KEY } from 'src/util/constant';

@Controller('product')
@ApiTags('product')
@ApiBearerAuth()
export class productController {
    constructor(private productService: productService) { }



    @Post('addProduct')
    @UseGuards(JwtAuthGuard)
    async updateProfile(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            const profileUpdateModel = JSON.parse(decryptData(userDetailsDto.key));
            return encryptData(JSON.stringify(await this.productService.createProductDetails(profileUpdateModel, req.user.userId)));
        }
    }


    @Post('list')
    @UseGuards(JwtAuthGuard)
    async view(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            var post = JSON.parse(decryptData(userDetailsDto.key));
            const result = await this.productService.view(post, req.user.userId);
            return encryptData(JSON.stringify(result));
        }
    }


    // @Post('listWithoutLocation')
    // @UseGuards(JwtAuthGuard)
    // async listWithoutLocation(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
    //     if (req.user.userId == undefined) {
    //         throw new UnauthorizedException("Unauthorized")
    //     } else {
    //         var post = JSON.parse(decryptData(userDetailsDto.key));
    //         const result = await this.productService.listWithoutLocation(post, req.user.userId);
    //         return encryptData(JSON.stringify(result));
    //     }
    // }

    @Post('partStatus')
    @UseGuards(JwtAuthGuard)
    async GetpartByNo(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        var post = JSON.parse(decryptData(userDetailsDto.key));
        var resultProfile = await this.productService.findpartDetails(post, req.user.userId);
        return encryptData(JSON.stringify(resultProfile));
    }


    @Post('getPartDetailsById')
    @UseGuards(JwtAuthGuard)
    async GetpartDetailsByd(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        var post = JSON.parse(decryptData(userDetailsDto.key));
        var resultProfile = await this.productService.findpartDetailsById(post, req.user.userId);
        return encryptData(JSON.stringify(resultProfile));
    }

    @Get('getBoxNo')
    @UseGuards(JwtAuthGuard)
    async GetBoxNo(@Request() req) {
        var resultProfile = await this.productService.getBoxNo(req.user.userId);
        return encryptData(JSON.stringify(resultProfile));
    }


    @Get('getUserList')
    @UseGuards(JwtAuthGuard)
    async GetUserList(@Request() req) {
        var resultProfile = await this.productService.getUserList(req.user.userId);
        return encryptData(JSON.stringify(resultProfile));
    }

    @Post('updateProduct')
    @UseGuards(JwtAuthGuard)
    async UpdateLocation(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        var post = JSON.parse(decryptData(userDetailsDto.key));
        var resultProfile = await this.productService.updateLocation(post, req.user.userId);
        return encryptData(JSON.stringify(resultProfile));
    }


    @Post('getActivitylist')
    @UseGuards(JwtAuthGuard)
    async GetActivitylist(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            var post = JSON.parse(decryptData(userDetailsDto.key));
            const result = await this.productService.getActivitylist(post, req.user.userId);
            return encryptData(JSON.stringify(result));
        }
    }

    @Post('getActivityStatus')
    @UseGuards(JwtAuthGuard)
    async GetActivityStatus(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            var post = JSON.parse(decryptData(userDetailsDto.key));
            const result = await this.productService.getActivityStatus(post, req.user.userId);
            return encryptData(JSON.stringify(result));
        }
    }


    @Post('partSearch')
    @UseGuards(JwtAuthGuard)
    async PartSearch(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        var post = JSON.parse(decryptData(userDetailsDto.key));
        var resultProfile = await this.productService.partSearch(post, req.user.userId);
        return encryptData(JSON.stringify(resultProfile));
    }


    @Get('loadMewInventory/:key')
    @UseGuards(JwtAuthGuard)
    async loadNewInventory(@Param('key') key: string) {
        if (LOADER_KEY.KEY != key)
            throw new BadRequestException(AUTO_ERRORMSG.LOADER_KEY_NOT_MATCHED)
        console.log('brandLists')
        await this.productService.loadNewInventory();
    }

    @Post('removeSerialNumber')
    @UseGuards(JwtAuthGuard)
    async removeSerialNumber(@Body() data: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            console.log(data);
            let dataValue = await this.productService.removeSerialNumber(JSON.parse(decryptData(data.key)), req.user.userId);
            return encryptData(JSON.stringify(dataValue));
        }

    }

    @Post('serialNumberHistory')
    @UseGuards(JwtAuthGuard)
    async serialNumberHistory(@Body() data: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            console.log(data);
            let dataValue = await this.productService.serialNumberHistory(JSON.parse(decryptData(data.key), req.user.userId));
            return encryptData(JSON.stringify(dataValue));
        }
    }

    // serial number api 
    @Post('RFIDList')
    @UseGuards(JwtAuthGuard)
    async serialNumberList(@Request() req, @Body() data: MobileInputRequest) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            console.log(data);
            let dataValue = await this.productService.serialNumberList(JSON.parse(decryptData(data.key), req.user.userId));
            return encryptData(JSON.stringify(dataValue));
        }
    }


    // serial number on UUID api table
    @Post('uuidProductTableList')
    @UseGuards(JwtAuthGuard)
    async uuidProductList(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            let dataValue = await this.productService.uuidProductList(JSON.parse(decryptData(userDetailsDto.key), req.user.userId));
            return encryptData(JSON.stringify(dataValue));
        }
    }


     @Post('updatePlacement')
    @UseGuards(JwtAuthGuard)
    async updatePlacementList(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            let dataValue = await this.productService.updatePlacementListValue(JSON.parse(decryptData(userDetailsDto.key)), req.user.userId);
            return encryptData(JSON.stringify(dataValue));
        }
    }


    @Post('updateColor')
    @UseGuards(JwtAuthGuard)
    async updateColorList(@Body() userDetailsDto: MobileInputRequest, @Request() req) {
        if (req.user.userId == undefined) {
            throw new UnauthorizedException("Unauthorized")
        } else {
            let dataValue = await this.productService.updateColorListValue(JSON.parse(decryptData(userDetailsDto.key)), req.user.userId);
            return encryptData(JSON.stringify(dataValue));
        }
    }


}



