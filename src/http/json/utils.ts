import { Post, Controller, Body, HttpException, HttpStatus, Logger, Req, Get, Res, flatten } from '@nestjs/common'
import { JOB_TYPE, JobInterface } from '../../core/traverse'
import { ApiJsonAppConfigService } from '../app-config/app-config.service'
import { Request } from 'express-serve-static-core'
import { In } from 'typeorm'
import { config } from '../../entities'
import { getField } from "../../core/sql-parser/column-parser";



function throwError(msg: string, code: number) {
  Logger.error(msg)
  throw new HttpException(msg, code)
}

const INNER_OPTION_TYPES = ['$$WHERE_FIELD', '$$DATE_RANGE', '$$IN_FIELD', '$$LIKE_FIELD']

async function checkHasRightAndAction(
  req:Request,
  job: JobInterface,
  action: string,
  appConfigService: ApiJsonAppConfigService
) {
  let tableConfig = config
  // 获取权限配置
  let rightConfig = {}
  let appSign = req.headers['app-sign'] as string || req.query['app-sign'] as string || ''
  if (!appSign) {
    throwError(`please submit the app-sign for your application in headers`, HttpStatus.FORBIDDEN)
  }
  const app = await appConfigService.findOne('appConfig', { app_code: appSign })
  if (!app) {
    throwError(`no such a app`, HttpStatus.BAD_REQUEST)
  }
  const appRoles = app.app_roles.split(',').filter(Boolean).map(id => Number(id))
  const rolesList = await appConfigService.find('roleConfig', {
    id: In(appRoles)
  })
  const tableIdList: any[] = rolesList.map(i => {
    return i.table_right_list.split(',').filter(Boolean).map(id => Number(id))
  })
  
  const tablesList = await appConfigService.find('tableRight', {
    id: In(flatten(tableIdList))
  })
  const tables = await appConfigService.find('tableConfig', {})
  tablesList.forEach(config => {
    // config.table '1'
    const _table = tables.find(t => t.id === Number(config.table))
    if (!_table) {
      throwError(`[no table] invalid table "${job.table}"`, HttpStatus.BAD_REQUEST)
    }
    const name = _table.filename

    if (rightConfig[name]) {
      if (config.add_right) rightConfig[name].add_right = 1
      if (config.del_right) rightConfig[name].del_right = 1
      let getFields = config.get_fields.split(',').filter(Boolean)
      let updatetFields = config.update_fields.split(',').filter(Boolean)
      let getSet = new Set([
        ...rightConfig[name].get_fields,
        ...getFields
      ])
      let updateSet = new Set([
        ...rightConfig[name].update_fields,
        ...updatetFields
      ])
      rightConfig[name].get_fields = [...getSet]
      rightConfig[name].update_fields = [...updateSet]
    } else {
      rightConfig[name] = {
        add_right: config.add_right,
        del_right: config.del_right,
        get_fields: config.get_fields.split(',').filter(Boolean),
        update_fields: config.update_fields.split(',').filter(Boolean),
      }
    }
  })
  if (rightConfig) {
    try {
      const targetTable = rightConfig[job.table]
      if (!targetTable) {
        throwError(`invalid table "${job.table}"`, HttpStatus.BAD_REQUEST)
      }
      if (action === 'add') {
        if (!targetTable.add_right) {
          throwError(`you have no right to ${action} this table ${job.table}`, HttpStatus.FORBIDDEN)
        }
      } else if (action === 'delete') {
        if (!targetTable.del_right) {
          throwError(`you have no right to ${action} this table ${job.table}`, HttpStatus.FORBIDDEN)
        }
      }
      if (action === 'get') {
        if (job.options.select && job.options.select.length) {
          // let invalidFields = []
          // job.options.select.forEach(field => {
          //   if (targetTable.get_fields.indexOf(field) === -1) {
          //     invalidFields.push(field)
          //     const index = job.options.select.indexOf(field)
          //     job.options.select.splice(index, 1)
          //   }
          // })
          // if (!job.options.select.length) {
          //   throwError(`you have no right to do "${action}" with ${job.table} at fields "${invalidFields.join(', ')}"`, HttpStatus.FORBIDDEN)
          // }
          let invalidFields = []
          for (let i = job.options.select.length - 1; i >= 0; i--) {
            const fieldSQL = job.options.select[i];
            const field = getField(fieldSQL);
            if (!field || targetTable.get_fields.indexOf(field) === -1) {
              invalidFields.push(fieldSQL);
              job.options.select.splice(i, 1)
            }
          }
          if (!job.options.select.length) {
            throwError(`you have no right to do "${ action }" with ${ job.table } at fields "${ invalidFields.join(', ') }"`, HttpStatus.FORBIDDEN)
          }
        } else {
          job.options.select = targetTable.get_fields
        }
      }
      if (action === 'update') {
        let invalidFields = []
        const updateValidFields = [
          ...targetTable.update_fields,
          tableConfig[job.table].uniqueKey,
          tableConfig[job.table].primary,
          tableConfig[job.table].uuid,
          ...INNER_OPTION_TYPES
        ]
        Object.keys(job.options).forEach(key => {
          if (updateValidFields.indexOf(key) === -1) {
            invalidFields.push(key)
            delete job.options[key]
          }
        })
        if (invalidFields.length) {
          throwError(`you have no right to do "${action}" with ${job.table} at fields "${invalidFields.join(', ')}"`, HttpStatus.FORBIDDEN)
        }
      }
    } catch (e) {
      throwError(e.message, HttpStatus.BAD_REQUEST)
    }
  } else {
    throwError(`invalid app-sign provided "${appSign}"`, HttpStatus.BAD_REQUEST)
  }
}

export {
  throwError,
  checkHasRightAndAction,
}
