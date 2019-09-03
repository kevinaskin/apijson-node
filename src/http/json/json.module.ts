import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JsonService } from './json.service'
import { JsonController } from './json.controller'
import * as entity from '../../entities'

const { config, ...allEntity } = entity
const entities = Object.keys(allEntity).map(key => entity[key])

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  providers: [JsonService],
  controllers: [
    JsonController
  ],
  exports: []
})
export class JsonModule implements NestModule {
  public configure(consumer: MiddlewareConsumer) {
  }
}
