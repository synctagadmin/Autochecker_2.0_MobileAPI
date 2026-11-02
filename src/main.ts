/**
 * Sentry FIRST, before every other import.
 *
 * The SDK instruments http and mongoose by patching those modules, and whatever is
 * loaded ahead of this line is never instrumented - ./app.module is what pulls Mongoose
 * in, so the order here is load-bearing rather than tidiness. instrument.ts loads dotenv
 * itself for the same reason: app.module's own dotenv.config() runs too late to put
 * SENTRY_DSN in the environment for this.
 *
 * A no-op unless SENTRY_DSN and SENTRY_ENVIRONMENT are both set.
 */
import './instrument';
import { reportProcessFault } from './observability/report';
import { SentryExceptionFilter } from './observability/sentry-exception.filter';
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

  /**
   * Report faults on their way to a response.
   *
   * BaseExceptionFilter needs the http adapter, which is why HttpAdapterHost was already
   * imported here. The filter delegates to it, so no response changes shape.
   */
  app.useGlobalFilters(new SentryExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  /**
   * The faults that never reach a filter.
   *
   * This service has 17 `forEach(async ...)` call sites: a rejection inside one happens
   * after the response has gone, so nothing is returned to the phone and nothing is
   * logged anywhere a person looks. The process is deliberately NOT killed - one bad row
   * in a background pass should not take every concurrent user's request with it - but
   * surviving silently is how those bugs stayed invisible.
   */
  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
    reportProcessFault(reason, 'unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
    reportProcessFault(err, 'uncaughtException');
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // PORT comes from the environment profile (config/env.profiles.json) or the deployment's
  // .env; 3001 is what this service has always listened on and stays the default, so an
  // existing deployment that sets nothing behaves exactly as before.
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0', function () {
    console.log('Listening to port:  ' + port);
  });
}
bootstrap();
