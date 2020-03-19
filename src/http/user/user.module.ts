import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApiJsonUserEntity } from '../configEntities/user.entity'
import { ApiJsonUserController } from './user.controller'
import { ApiJsonUserService } from './user.service'
import { UserAuthMiddleware } from '../middlewares/user-auth.middleware'


@Module({
  imports: [TypeOrmModule.forFeature([ApiJsonUserEntity], 'apijsonDB')],
  providers: [ApiJsonUserService],
  controllers: [
    ApiJsonUserController
  ],
  exports: []
})
export class ApiJsonUserModule implements NestModule {
  public configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserAuthMiddleware).exclude(
      '/common/login'
    )
  }
}
