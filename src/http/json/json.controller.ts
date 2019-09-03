import { Post, Controller, Body, HttpException, HttpStatus } from '@nestjs/common'
import { ApiUseTags, ApiBearerAuth } from '@nestjs/swagger'
import { set as safeSet, get as safeGet } from 'lodash'

import { JsonService } from './json.service'
import { jsonBodyParser } from '../../core'
import { successHandler, baseHandler, HTTP_CODE } from '../../helper'
import { JOB_TYPE } from '../../core/traverse'

@ApiBearerAuth()
@ApiUseTags('apijson')
@Controller('apijson')
export class JsonController {
  constructor(private readonly jsonService: JsonService) {}

  @Post()
  async query(@Body() queryBody: object): Promise<any> {
    
    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throw new HttpException('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue:jobList, errors, originalJson, RequestParser } = parserResult
    console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    if (errors.length) {
      throw new HttpException(errors.join('; '), HttpStatus.BAD_REQUEST)
    }
    let res = JSON.parse(JSON.stringify(originalJson))
    if (!jobList.length) {
      return baseHandler(
        HTTP_CODE.WARNING,
        res,
        '[info] there is no SQL found to be exec'
      )
    }

    const normalizedData = data => {
      data = JSON.stringify(data)
      data = data
        .replace(/\#/g, '') // replace "#" operation arg
        .replace(/\[\]/g, '')

      return JSON.parse(data)
    }

    while (jobList.length) {
      let currentJob = jobList.pop()
      console.log('JOB ID =>', currentJob.id)
      let data
      
      if (currentJob.$$type === JOB_TYPE.SINGLE) {
        data = await this.jsonService.findOne(currentJob.table, currentJob.options) || {}
        safeSet(res, currentJob.replacePath, data)
      }

      if (currentJob.$$type === JOB_TYPE.LIST) {
        data = await this.jsonService.find(currentJob.table, currentJob.options, currentJob.ListOptions || {})
        safeSet(res, currentJob.replacePath, data)
      }

      if (currentJob.$$type === JOB_TYPE.UNION) {
        const { referArgs, referVar } = currentJob.options
        const referData = safeGet(res, referArgs, undefined)
        if (!referData) {
          throw new HttpException(`[ERROR] union job exec failed, for "${referArgs.join('/')}" is undefined`, HttpStatus.BAD_REQUEST)
        }
        data = await this.jsonService.findOne(currentJob.table, {
          [referVar]: referData
        })
        safeSet(res, currentJob.replacePath, data)
      }

      if (currentJob.$$type === JOB_TYPE.LIST_UNION) {
        const { referArgs, referVar, ...restOptions } = currentJob.options

        const referData = safeGet(res, referArgs, undefined)
        if (!referData) {
          throw new HttpException(`[ERROR] union job exec failed, for "${referArgs.join('/')}" is undefined`, HttpStatus.BAD_REQUEST)
        }
        data = await this.jsonService.find(currentJob.table, {
          [referVar]: referData,
          ...restOptions
        }, currentJob.ListOptions)
        safeSet(res, currentJob.replacePath, data)
      }
    }

    res = normalizedData(res)

    return successHandler(res)
  }
}