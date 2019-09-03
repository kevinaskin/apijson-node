import { Get, Controller } from '@nestjs/common'

@Controller()
export class AppController {
  /**
   * 健康检查接口
   */
  @Get('/test')
  root(): string {
    return 'ok'
  }
}