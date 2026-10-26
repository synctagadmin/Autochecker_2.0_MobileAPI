import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info: Error) {
   /// console.log('hiu', user, info, err)
    if (info) {
      // do stuff when token is expired
      console.log('token expired', info);
      // throw new UnauthorizedException("auauthorized")
    }

    return user;
  }

}