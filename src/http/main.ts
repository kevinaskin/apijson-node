import { NestFactory } from '@nestjs/core'
import { ApplicationModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

async function bootstrap(port = 3000) {
  const appOptions = {
    cors: true,
  }
  const app = await NestFactory.create(ApplicationModule, appOptions)

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