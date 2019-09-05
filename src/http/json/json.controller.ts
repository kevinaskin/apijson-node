import { Post, Controller, Body, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { ApiUseTags, ApiBearerAuth } from '@nestjs/swagger'
import { set as safeSet, get as safeGet } from 'lodash'

import { JsonService } from './json.service'
import { jsonBodyParser } from '../../core'
import { successHandler, baseHandler, HTTP_CODE } from '../../helper'
import { JOB_TYPE } from '../../core/traverse'

function throwError(msg: string, code: number) {
  Logger.error(msg)
  throw new HttpException(msg, code)
}

@ApiBearerAuth()
@ApiUseTags('apijson')
@Controller('apijson')
export class JsonController {
  constructor(private readonly jsonService: JsonService) {}

  @Post('/update')
  async update(@Body() queryBody: object): Promise<any> {

    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue:jobList, errors, originalJson, RequestParser } = parserResult
    console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
    }

    if (jobList.find(job => {
      return job.$$type === JOB_TYPE.LIST_UNION || job.$$type === JOB_TYPE.UNION
    })) {
      throwError(
        `[ERROR] update request is not support union operation "@", please check your request body`,
        HttpStatus.BAD_REQUEST)
    }

    if (jobList.length > 1) {
      throwError(
        `[ERROR] update request is not support transaction insert, please request single table payload.`,
        HttpStatus.BAD_REQUEST)
    }

    while (jobList.length) {
      let currentJob = jobList.pop()
      console.log('JOB ID =>', currentJob.id)
      const primaryKey = currentJob.config.primary
      if (!currentJob.options[primaryKey]) {
        throwError(`[ERROR] "${primaryKey}" is required in update method`, HttpStatus.BAD_REQUEST)
      }
      try {
        await this.jsonService.update(
          currentJob.options[primaryKey], 
          currentJob.table, 
          currentJob.options
        )
      } catch (e) {
        throwError(e.message, HttpStatus.BAD_REQUEST)
      }
    }

    return successHandler({
      message: '[INFO] update success',
      requestBody: originalJson
    })
  }

  @Post('/add')
  async add(@Body() queryBody: object): Promise<any> {

    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue:jobList, errors, originalJson, RequestParser } = parserResult
    console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
    }

    if (jobList.find(job => {
      return job.$$type === JOB_TYPE.LIST_UNION || job.$$type === JOB_TYPE.UNION
    })) {
      throwError(
        `[ERROR] add request is not support union operation "@", please check your request body`,
        HttpStatus.BAD_REQUEST)
    }

    if (jobList.length > 1) {
      throwError(
        `[ERROR] add request is not support transaction insert, please request single table payload.`,
        HttpStatus.BAD_REQUEST)
    }
    while (jobList.length) {
      let currentJob = jobList.pop()
      console.log('JOB ID =>', currentJob.id)

      const {...payload} = currentJob.options // incase for functional column
      try {
        await this.jsonService.insert(currentJob.table, payload)
      } catch (e) {
        throwError(e.message, HttpStatus.BAD_REQUEST)
      }
    }

    return successHandler({
      message: '[INFO] insert success',
      requestBody: originalJson
    })
  }

  @Post('/get')
  async query(@Body() queryBody: object): Promise<any> {
    
    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue:jobList, errors, originalJson, RequestParser } = parserResult
    console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
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
      if (!data) return {}
      Object.keys(data).forEach(key => {
        const normalizedKey = key
          .replace(/\#/g, '') // replace "#" operation arg
          .replace(/\[\]/g, '')
        if (normalizedKey !== key) {
          const tmp = data[key]
          data[normalizedKey] = tmp
          delete data[key]
          if (typeof data[normalizedKey] === 'object') {
            normalizedData(data[normalizedKey])
          }
        } else {
          if (typeof data[key] === 'object') {
            normalizedData(data[key])
          }
        }
      })
      return data
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
          throwError(`[ERROR] union job exec failed, for "${referArgs.join('/')}" is undefined`, HttpStatus.BAD_REQUEST)
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
          throwError(`[ERROR] union job exec failed, for "${referArgs.join('/')}" is undefined`, HttpStatus.BAD_REQUEST)
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