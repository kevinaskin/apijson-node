import { Get, Controller, Render, Req, Inject, Request } from '@nestjs/common'
import { config } from '../entities'

@Controller()
export class AppController {
  /**
   * 健康检查接口
   */
  @Get('/test')
  async root(): Promise<string> {
    return 'ok'
  }

  @Get('/caniuse')
  getEntity(@Req() req?): object {
    return config
  }

  @Get('/old')
  @Render('admin')
  home() {
    return {}
  }

  @Get('/')
  @Render('admin-v2')
  renderV2() {
    return {}
  }
}
