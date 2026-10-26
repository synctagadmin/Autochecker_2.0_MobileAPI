import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
//import * as timeout from 'connect-timeout'; // <-

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true, });
  app.setGlobalPrefix('api');
  app.enableCors();
 // app.use(timeout('5s'));
  const config = new DocumentBuilder()
    .setTitle('Auto Parts Checker')
    .setDescription('Auto Parts Checker API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  app.useGlobalPipes(new ValidationPipe({ skipMissingProperties: true }));

  //app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        console.log(validationErrors)
        return new BadRequestException(validationErrors);
      },
    })
  );

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3001, '0.0.0.0', function () {
    console.log('Listening to port:  ' + 3001);
  });
}
bootstrap();
