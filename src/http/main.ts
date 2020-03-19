import { NestFactory } from '@nestjs/core'
import { ApplicationModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { join } from 'path'

import * as cookieParser from 'cookie-parser'
import * as expressSession from 'express-session'
import MemoryStore from '../cache'

const SQLiteStore = require('connect-sqlite3')(expressSession)
export const MemoryCacheStore = new MemoryStore()

async function bootstrap(port = 9771) {
  const appOptions = {
    cors: {
      origin: process.env.NODE_EVN === 'production' ? [
        /\.guahao\.cn$/, /\.guahao\.com$/,
        /\.guahao-test\.com$/,
        /\.guahao-test\.cn$/,
      ] : [
        /\.guahao\.cn$/, /\.guahao\.com$/,
        /\.guahao-test\.com$/,
        /\.guahao-test\.cn$/,
        /192.168.94.186/, // 测试环境服务器
        /127.0.0.1/,
        /localhost/
      ],
      methods: 'GET,POST',
      optionsSuccessStatus: 204,
      maxAge: 10 * 60 * 1000,
      credentials: true,
    },
  }
  const app = await NestFactory.create<NestExpressApplication>(ApplicationModule, appOptions)

  app.useStaticAssets(join(__dirname, '../..', 'public'))
  app.setBaseViewsDir(join(__dirname, '../..', 'views'))
  app.setViewEngine('ejs')

  const secret = '__ai-apijson-node__secret__'
  app.use(expressSession({
    name: 'apijson',
    secret,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
    saveUninitialized: false,
    resave: false,
    store: new SQLiteStore({
      db: 'sessionDB.db',
      dir: '.',
      table: 'sessions'
    })
  }))
  app.use(cookieParser(secret))

  const options = new DocumentBuilder()
    .setTitle('AI-APIJSON-NODE')
    .setDescription('APIJSON node版本')
    .setVersion('0.0.1')
    .build()
  const document = SwaggerModule.createDocument(app, options)
  SwaggerModule.setup('/docs', app, document)

  await app.listen(port)
}
bootstrap()