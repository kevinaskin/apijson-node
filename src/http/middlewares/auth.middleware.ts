import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'
import { ReqHasLoginId } from '../json/json.controller'
import { ApiJsonAppConfigService } from '../app-config/app-config.service'
import MiddlewareQueue from './MiddlewareQueue.ts'
import { In } from 'typeorm'
import { MemoryCacheStore } from '../main'

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private appService: ApiJsonAppConfigService) {}

  async use(req: Request & ReqHasLoginId, res: Response, next: Function) {
    const configObject = Object.assign({}, req.headers, req.query)
    const appCode = configObject['app-sign']
    if (!appCode) {
      res.status(400)
      res.send({
        code: 400,
        msg: '请提供应用名(app-sign)'
      })
    } else {
      const applicationConfig = await this.appService.findOne(
        'appConfig', 
        { app_code: appCode }
      )
      if (!applicationConfig) {
        res.send({
          code: 400,
          msg: '查不到该应用，请检查app-sign或联系管理员'
        })
      } else {
        // set api call info in memory
        const dateIns = new Date()
        MemoryCacheStore.setData(
          dateIns.getTime().toString(),
          `[${dateIns.getHours()}:${dateIns.getMinutes()}] ${appCode} ${JSON.stringify(req.body)}`
        )

        const reqIdList = applicationConfig.req_middleware_list
          .split(',')
          .filter(Boolean)
          .map(id => Number(id))
        // 取出req middleware
        const reqList = await this.appService.find('customMid', {
          id: In(reqIdList)
        })
        if (reqList && reqList.length) {
          const middlewareQueue = new MiddlewareQueue(
            reqList.map(item => item.function), req, res, next
          )
          middlewareQueue.execTaskList()
        } else {
          next()
        }
      }
    }
  }
}