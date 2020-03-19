import { Post, Controller, Body, HttpException, HttpStatus, Logger, Req, Get, Res } from '@nestjs/common'
import { ApiUseTags, ApiBearerAuth } from '@nestjs/swagger'
import { set as safeSet, get as safeGet } from 'lodash'

import { JsonService } from './json.service'
import { jsonBodyParser } from '../../core'
import { successHandler, baseHandler, HTTP_CODE } from '../../helper'
import { JOB_TYPE, JobInterface } from '../../core/traverse'
import { Request } from 'express-serve-static-core'
import { config as entityConfig } from '../../entities'
import { throwError, checkHasRightAndAction } from './utils'
import { ApiJsonAppConfigService } from '../app-config/app-config.service'

export type ReqHasLoginId = {
  loginId?: any
}

export const BENCHED_MAX_LENGTH = 50

@ApiBearerAuth()
@ApiUseTags('api')
@Controller('api')
export class JsonController {
  constructor (
    private readonly jsonService: JsonService,
    private readonly appConfigService: ApiJsonAppConfigService,
  ) {
  }

  @Post('/transaction')
  async execTransaction (@Body() queryBody: object, @Req() req?: Request & ReqHasLoginId): Promise<any> {
    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue: jobList, errors, originalJson, RequestParser } = parserResult
    
    RequestParser.flushJob()
    Logger.log(errors.join('; '))
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
    }
    
    const jobListCopy = JSON.parse(JSON.stringify(jobList))
    const DB_SET = new Set()
    while (jobList.length) {
      let currentJob = jobList.pop()
      // console.log('JOB ID =>', currentJob.id)
      // 检查权限
      const action = currentJob.config && currentJob.config.transaction
      if (!action) {
        throwError(`[ERROR] transaction action loss`, HttpStatus.BAD_REQUEST)
      }
      await checkHasRightAndAction(req, currentJob, action, this.appConfigService)
      const column = entityConfig[currentJob.table].column
      const hasOperator = column.findIndex(i => i.key === 'operator') > -1
      const hasLoginIdInRequest = !!req.loginId
      if (hasOperator && hasLoginIdInRequest) {
        currentJob.options.operator = req.loginId
      }
      const uuidKey = entityConfig[currentJob.table].uuid
      const uniqueKey = entityConfig[currentJob.table].uniqueKey
      const uuidKeyOrUniqueKey = uuidKey || uniqueKey || undefined
      if (currentJob.config.db) {
        DB_SET.add(currentJob.config.db)
      }
      console.log(currentJob + '\n\n')
    }
    
    if (DB_SET.size > 1) {
      throwError(
        `[ERROR] Transactions should within single Database`,
        HttpStatus.BAD_REQUEST
      )
    } else if (DB_SET.size < 1) {
      throwError(
        `[ERROR] Database config loss`,
        HttpStatus.BAD_REQUEST
      )
    } else {
      /**
       * res {
       *  err?: string,
       *  ...
       * }
       */
      const result: any = await this.jsonService.transaction(
        jobListCopy,
        [ ...DB_SET ][0]
      )
      if (result.err) {
        throwError(result, HttpStatus.INTERNAL_SERVER_ERROR)
      }
      return successHandler({
        message: '[INFO] transaction exec success',
        requestBody: originalJson,
        result
      })
    }
  }

  @Post('/delete')
  async delete (@Body() queryBody: object, @Req() req?: Request & ReqHasLoginId): Promise<any> {

    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue: jobList, errors, originalJson, RequestParser } = parserResult
    // console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    Logger.log(errors.join('; '))
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
    }

    if (jobList.find(job => {
      return job.config && job.config.transaction
    })) {
      throwError(
        `[ERROR] use "/api/transaction" to exec transaction job instead`,
        HttpStatus.BAD_REQUEST
      )
    }

    if (jobList.find(job => {
      return job.$$type === JOB_TYPE.LIST_UNION || job.$$type === JOB_TYPE.UNION
    })) {
      throwError(
        `[ERROR] delete request is not support union operation "@", please check your request body`,
        HttpStatus.BAD_REQUEST)
    }

    if (jobList.some(job => job.$$type !== JOB_TYPE.SINGLE)) {
      throwError(
        `[ERROR] delete request is not support this query (single job only).`,
        HttpStatus.BAD_REQUEST)
    }

    while (jobList.length) {
      let currentJob = jobList.pop()
      // console.log('JOB ID =>', currentJob.id)
      // 检查权限
      await checkHasRightAndAction(req, currentJob, 'delete', this.appConfigService)
      const column = entityConfig[currentJob.table].column
      // 记录操作人
      const hasOperator = column.findIndex(i => i.key === 'operator') > -1
      const hasLoginIdInRequest = !!req.loginId
      if (hasOperator && hasLoginIdInRequest) {
        currentJob.options.operator = req.loginId
      }
      const uuidKey = entityConfig[currentJob.table].uuid
      const uniqueKey = entityConfig[currentJob.table].uniqueKey
      const uuidKeyOrUniqueKey = uuidKey || uniqueKey || undefined
      if (uuidKeyOrUniqueKey) {
        if (!currentJob.options[uuidKeyOrUniqueKey]) {
          throwError(`[ERROR] "${ uuidKeyOrUniqueKey }" is required in delete method`, HttpStatus.BAD_REQUEST)
        }
        try {
          await this.jsonService.delete(
            {
              [uuidKeyOrUniqueKey]: currentJob.options[uuidKeyOrUniqueKey]
            },
            currentJob.table,
          )
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
      } else {
        throwError(`[ERROR] there is something wrong with your query`, HttpStatus.BAD_REQUEST)
      }
    }

    return successHandler({
      message: '[INFO] delete success',
      requestBody: originalJson
    })
  }

  @Post('/update')
  async update (@Body() queryBody: object, @Req() req?: Request & ReqHasLoginId): Promise<any> {

    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue: jobList, errors, originalJson, RequestParser } = parserResult
    // console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    Logger.log(errors.join('; '))
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
    }

    if (jobList.find(job => {
      return job.config && job.config.transaction
    })) {
      throwError(
        `[ERROR] use "/api/transaction" to exec transaction job instead`,
        HttpStatus.BAD_REQUEST
      )
    }

    if (jobList.find(job => {
      return job.$$type === JOB_TYPE.LIST_UNION || job.$$type === JOB_TYPE.UNION
    })) {
      throwError(
        `[ERROR] update request is not support union operation "@", please check your request body`,
        HttpStatus.BAD_REQUEST)
    }

    while (jobList.length) {
      let currentJob = jobList.pop()
      // console.log('JOB ID =>', currentJob.id)
      // console.log("currentJob", JSON.stringify(currentJob, null, 2))
      // 检查权限
      await checkHasRightAndAction(req, currentJob, 'update', this.appConfigService)
      const column = entityConfig[currentJob.table].column
      const hasOperator = column.findIndex(i => i.key === 'operator') > -1
      const hasLoginIdInRequest = !!req.loginId
      if (hasOperator && hasLoginIdInRequest) {
        currentJob.options.operator = req.loginId
      }
      if (currentJob.options['$$WHERE_FIELD']) {
        if (currentJob.options['$$WHERE_FIELD'].length > 1) {
          throwError(`WHERE options is more than 1, please check your query again`, HttpStatus.BAD_REQUEST)
        }
        const validWhereField = currentJob.options['$$WHERE_FIELD'][0]
        delete currentJob.options['$$WHERE_FIELD']
        try {
          await this.jsonService.update(
            {
              [validWhereField.key]: validWhereField.value
            },
            currentJob.table,
            currentJob.options
          )
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
      } else {
        const uuidKey = entityConfig[currentJob.table].uuid
        const uniqueKey = entityConfig[currentJob.table].uniqueKey
        const uuidKeyOrUniqueKey = uuidKey || uniqueKey || undefined
        if (uuidKeyOrUniqueKey) {
          if (!currentJob.options[uuidKeyOrUniqueKey]) {
            throwError(`[ERROR] "${ uuidKeyOrUniqueKey }" is required in update method`, HttpStatus.BAD_REQUEST)
          }
          try {
            await this.jsonService.update(
              {
                [uuidKeyOrUniqueKey]: currentJob.options[uuidKeyOrUniqueKey]
              },
              currentJob.table,
              currentJob.options
            )
          } catch (e) {
            throwError(e.message, HttpStatus.BAD_REQUEST)
          }
        } else {
          throwError(`[ERROR] there is something wrong with your query`, HttpStatus.BAD_REQUEST)
        }
      }
    }

    return successHandler({
      message: '[INFO] update success',
      requestBody: originalJson
    })
  }

  @Post('/add')
  async add (@Body() queryBody: object, @Req() req?: Request & ReqHasLoginId): Promise<any> {

    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    let insertRes: any

    const { queue: jobList, errors, originalJson, RequestParser } = parserResult
    // console.log('RELEASE requestParser instance')
    RequestParser.flushJob()
    if (errors.length) {
      throwError(errors.join('; '), HttpStatus.BAD_REQUEST)
    }

    if (jobList.find(job => {
      return job.config && job.config.transaction
    })) {
      throwError(
        `[ERROR] use "/api/transaction" to exec transaction job instead`,
        HttpStatus.BAD_REQUEST
      )
    }

    if (jobList.find(job => {
      return job.$$type === JOB_TYPE.LIST_UNION || job.$$type === JOB_TYPE.UNION
    })) {
      throwError(
        `[ERROR] add request is not support union operation "@", please check your request body`,
        HttpStatus.BAD_REQUEST)
    }

    // if (jobList.length > 1) {
    //   throwError(
    //     `[ERROR] add request is not support transaction insert, please request single table payload.`,
    //     HttpStatus.BAD_REQUEST)
    // }

    while (jobList.length) {
      let currentJob = jobList.pop()
      // console.log('JOB ID =>', currentJob.id)
      // 检查权限
      await checkHasRightAndAction(req, currentJob, 'add', this.appConfigService)
      const column = entityConfig[currentJob.table].column
      const hasOperator = column.findIndex(i => i.key === 'operator') > -1
      const hasLoginIdInRequest = !!req.loginId
      if (hasOperator && hasLoginIdInRequest) {
        currentJob.options.operator = req.loginId
      }

      const { ...payload } = currentJob.options // incase for functional column
      try {
        insertRes = await this.jsonService.insert(currentJob.table, payload)

      } catch (e) {
        throwError(e.message, HttpStatus.BAD_REQUEST)
      }
    }
    const insertData = insertRes && insertRes.generatedMaps && insertRes.generatedMaps[0] && insertRes.generatedMaps[0]
    if (insertData) {
      return successHandler({
        message: '[INFO] insert success',
        insertData
      })
    }
    return baseHandler(500, {}, '[ERROR] insert failed with some errors.')
  }

  @Post('/get')
  async query (@Body() queryBody: object, @Req() req?: Request): Promise<any> {
    const parserResult = jsonBodyParser(queryBody)
    if (!parserResult) {
      throwError('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { queue: jobList, errors, originalJson, RequestParser } = parserResult
    // console.log('RELEASE requestParser instance')
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

    const normalizedData: (data: object | null) => object = data => {
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
      // console.log('JOB ID =>', currentJob.id)
      // console.log('currentJob', currentJob)
      // 检查权限
      await checkHasRightAndAction(req, currentJob, 'get', this.appConfigService)
      let data, totalCount

      if (currentJob.$$type === JOB_TYPE.SINGLE) {
        try {
          data = await this.jsonService.findOne(currentJob.table, currentJob.options) || {}
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
        safeSet(res, currentJob.replacePath, data)
      }

      if (currentJob.$$type === JOB_TYPE.LIST) {
        try {
          data = await this.jsonService.find(currentJob.table, currentJob.options, currentJob.ListOptions || {})
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
        try {
          const { select, ...rest } = currentJob.options
          totalCount = await this.jsonService.count(currentJob.table, rest)
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
        const count = currentJob.ListOptions.count || 10
        safeSet(res, currentJob.replacePath, {
          data,
          page: currentJob.ListOptions.page || 1,
          count,
          totalPage: totalCount / count | 0 + 1,
          totalCount
        })
      }

      if (currentJob.$$type === JOB_TYPE.UNION) {
        const { referArgs, referVar } = currentJob.options
        const referData = safeGet(res, referArgs, undefined)
        if (!referData) {
          throwError(`[ERROR] union job exec failed, for "${ referArgs.join('/') }" is undefined`, HttpStatus.BAD_REQUEST)
        }
        try {
          data = await this.jsonService.findOne(currentJob.table, {
            [referVar]: referData
          })
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
        safeSet(res, currentJob.replacePath, data)
      }

      if (currentJob.$$type === JOB_TYPE.LIST_UNION) {
        const { referArgs, referVar, ...restOptions } = currentJob.options

        const referData = safeGet(res, referArgs, undefined)
        if (!referData) {
          throwError(`[ERROR] union job exec failed, for "${ referArgs.join('/') }" is undefined`, HttpStatus.BAD_REQUEST)
        }
        try {
          data = await this.jsonService.find(currentJob.table, {
            [referVar]: referData,
            ...restOptions
          }, currentJob.ListOptions)
        } catch (e) {
          throwError(e.message, HttpStatus.BAD_REQUEST)
        }
        safeSet(res, currentJob.replacePath, data)
      }
    }

    res = normalizedData(res)

    return successHandler(res)
  }
}
