import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common'
import { AppController } from './app.controller'
import { Connection } from 'typeorm'
import { JsonModule } from './json/json.module'
import { AuthMiddleware } from './middlewares/auth.middleware'
import { JsonController } from './json/json.controller'
import { ApiJsonUserModule } from './user/user.module'
import { ApiJsonAppConfigModule } from './app-config/app-config.module'
import { dbConfig } from './dbConfig'

@Module({
  imports: [
    ...dbConfig,
    JsonModule,
    ApiJsonUserModule,
    ApiJsonAppConfigModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
  ],
})
// export class ApplicationModule {}
export class ApplicationModule implements NestModule {
  constructor(
    private readonly connection: Connection, 
    // private readonly routeAliasService: ApiJsonRouteAliasService
  ) {
    // this.cacheRoutes()
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes(
      JsonController
    )
  }

  // async cacheRoutes() {
  //   const routeAliasList = await this.routeAliasService.find()
  //   // todo Map route alias to memory cache
  //   // console.log('==>', routeAliasList)
  // }
}
