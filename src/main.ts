import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import passport from 'passport';
import * as redis from 'redis';
import { AppModule } from './app.module';
import { AllExceptionFilter, getSessionKeyAuthPrefix, TimeoutInterceptor } from './libs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = new Logger('bootstrap');
  const configService = app.get(ConfigService);

  const environment = configService.get<string>('NODE_ENV', 'development');

  if (environment === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.enableCors({
    origin: (_origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor());
  app.setGlobalPrefix('api/v1');

  // Set up Redis client
  const redisClient = redis.createClient({
    url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
    password: configService.get<string>('REDIS_PASSWORD') || undefined,
  });
  redisClient.connect().then(() => {
    logger.verbose('Connected to Redis for session storage');
  }).catch((error) => {
    logger.error('Redis connection error:', error);
  });

  app.use(
    session({
      name: 'market.ai.sid',
      store: new RedisStore({
        client: redisClient,
        prefix: getSessionKeyAuthPrefix(),
      }),
      secret: configService.get<string>('SESSION_SECRET', 'default-secret-change-in-production'),
      resave: true,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
        httpOnly: true,
        secure: environment === 'production',
        sameSite: environment === 'production' ? 'none' : 'lax',
        domain: environment === 'production' ? configService.get('COOKIE_DOMAIN') : undefined,
      },
      proxy: environment === 'production',
    }),
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  const swaggerEnable = configService.get('SWAGGER_ENABLE') === 'true';
  if (swaggerEnable) {
    const config = new DocumentBuilder()
      .setTitle('Market AI API')
      .setDescription('Crypto Market Analysis with AI - API Endpoints')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: {
        filter: true,
        persistAuthorization: true,
      },
    });
  }

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port, () => {
    logger.verbose(`Server on port: ${port}`);
    logger.debug(`Development Local: ${environment === 'development' ? `http://localhost:${port}/api/v1/docs` : 'Disabled in production'}`);
  });
}
bootstrap();
