import { Get, Controller } from '@nestjs/common'
import { config } from '../entities'

@Controller()
export class AppController {
  /**
   * 健康检查接口
   */
  @Get('/test')
  root(): string {
    return 'ok'
  }

  @Get('/table')
  getTable(): any {
    return config
  }
}