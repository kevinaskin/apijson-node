import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response } from 'express'
import { ReqHasLoginId } from '../json/json.controller'
import { baseHandler } from '../../helper'

export type ReqWithSession = {
  session?: any
}

@Injectable()
export class UserAuthMiddleware implements NestMiddleware {
  async use(req: Request & ReqHasLoginId & ReqWithSession, res: Response, next: Function) {
    if (req.session.userInfo) {
      next()
    } else {
      res.send(baseHandler(403, {
        redirect: '/'
      }, 'not login'))
    }
  }
}