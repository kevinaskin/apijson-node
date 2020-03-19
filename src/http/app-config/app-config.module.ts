import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { 
  ApiJsonAppConfigEntity,
  ApiJsonRoleConfigEntity,
  ApiJsonCustomMidEntity,
  ApiJsonTableRightEntity,
  ApiJsonTableConfigEntity,
  ApiJsonDBConfigEntity,
} from '../configEntities'
import { ApiJsonAppConfigController } from './app-config.controller'
import { ApiJsonAppConfigService } from './app-config.service'
import { UserAuthMiddleware } from '../middlewares/user-auth.middleware'


@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiJsonAppConfigEntity,
      ApiJsonRoleConfigEntity,
      ApiJsonCustomMidEntity,
      ApiJsonTableRightEntity,
      ApiJsonTableConfigEntity,
      ApiJsonDBConfigEntity,
    ], 'apijsonDB'),
  ],
  providers: [ApiJsonAppConfigService],
  controllers: [
    ApiJsonAppConfigController
  ],
  exports: [ApiJsonAppConfigService]
})
export class ApiJsonAppConfigModule implements NestModule {
  public configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserAuthMiddleware).exclude(
      '/common/login'
    )
  }
}
