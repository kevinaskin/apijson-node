import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JsonService } from './json.service'
import { JsonController } from './json.controller'
import * as entity from '../../entities'
import { ApiJsonConfigEntity } from '../configEntities/config.entity'
import { ApiJsonAppConfigService } from '../app-config/app-config.service'
import { ApiJsonAppConfigEntity, ApiJsonRoleConfigEntity, ApiJsonTableRightEntity, ApiJsonCustomMidEntity, ApiJsonTableConfigEntity, ApiJsonDBConfigEntity } from '../configEntities'

const { config, ...allEntity } = entity
const entities = Object.keys(allEntity).map(key => entity[key])

@Module({
  imports: [
    TypeOrmModule.forFeature(entities, 'default'), 
    TypeOrmModule.forFeature([
      ApiJsonConfigEntity,
      ApiJsonAppConfigEntity,
      ApiJsonRoleConfigEntity,
      ApiJsonTableRightEntity,
      ApiJsonCustomMidEntity,
      ApiJsonTableConfigEntity,
      ApiJsonDBConfigEntity,
    ], 'apijsonDB'),
  ],
  providers: [JsonService, ApiJsonAppConfigService],
  controllers: [
    JsonController
  ],
  exports: []
})
export class JsonModule implements NestModule {
  public configure(consumer: MiddlewareConsumer) {
  }
}
