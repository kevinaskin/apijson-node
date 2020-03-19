import { Injectable, HttpStatus } from '@nestjs/common'
import {
  Repository, Between, getRepository, In, Like,
  getConnection,
} from 'typeorm'
import { throwError } from './utils'

import * as EntityList from '../../entities'
import { config } from '../../entities'

import crypto = require('crypto')

export const PRIMARY_KEY_SALT = 'ai-apijson-node_7750472938641455'

@Injectable()
export class JsonService {
  entityList: any

  constructor () {
    this.entityList = EntityList
  }

  async transaction (jobList, dbConn) {
    const conn = getConnection(dbConn)
    const queryRunner = conn.createQueryRunner()
    let result: any = {}

    let __index = 1
    let data: any = {}

    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      while (jobList.length) {
        let currentJob = jobList.shift()
        // 处理字符串模板
        const strTplList = currentJob.options[`$$STRING_TPL`] || []
        if (strTplList.length) {
          strTplList.forEach(({ key, value }) => {
            const val = eval('`' + value + '`')
            currentJob.options[key] = val
          })
        }

        const currentRepository = await queryRunner
          .manager
          .getRepository(`${ currentJob.table }Entity`)

        const uuidKey = config[currentJob.table].uuid
        const uniqueKey = config[currentJob.table].uniqueKey
        const uuidKeyOrUniqueKey = uuidKey || uniqueKey || undefined
        switch (currentJob.config.transaction) {
          // case 'get':
          //   const {
          //     select = [], groupBy = [], orderBy = [],
          //     $$DATE_RANGE = {}, $$IN_FIELD = [], $$LIKE_FIELD = [],
          //     joinOptions = {}, ...restOptions
          //   } = currentJob.options
          //   // LIKE 表达式
          //   const likeOptions = {}
          //   $$LIKE_FIELD.forEach(item => {
          //     likeOptions[item.key] = Like(item.value)
          //   })
          //   // IN 表达式 todo
          //   const inOptions = {}
          //   $$IN_FIELD.forEach(item => {
          //     inOptions[item.key] = In(item.value)
          //   })
          //   // 去除主键显示
          //   const safeCustomSelect = select.filter(i => {
          //     return i !== currentJob.config.primary || i === currentJob.config.uniqueKey
          //   })
          //   // 除主键外的key
          //   const safeColumn = config[currentJob.table].column.map(i => i.key).filter(i => {
          //     return i !== currentJob.config.primary || i === currentJob.config.uniqueKey
          //   })
          //   const dateRangeOption = {}
          //   if ($$DATE_RANGE.field && $$DATE_RANGE.value) {
          //     dateRangeOption[$$DATE_RANGE.field] = Between(
          //       new Date($$DATE_RANGE.value[0]),
          //       new Date($$DATE_RANGE.value[1])
          //     )
          //   }
          //   const orderByOption = {}
          //   orderBy.forEach(opt => {
          //     orderByOption[opt.key] = opt.orderType
          //   })
          //   const res = currentRepository && await currentRepository.createQueryBuilder()
          //     .select(safeCustomSelect.length ? safeCustomSelect : safeColumn)
          //     .where({
          //       ...restOptions,
          //       ...dateRangeOption,
          //       ...inOptions,
          //       ...likeOptions,
          //     })
          //     .groupBy(groupBy.length && groupBy)
          //     .orderBy(orderByOption)
          //     // .skip((listOptions.page - 1) * listOptions.count)
          //     // .take(listOptions.count)
          //     .getRawMany()
          //   result = {
          //     ...result,
          //     [`job__${ currentJob.config.transaction }__${ currentJob.id }`]: {
          //       data: res
          //     }
          //   }
          //   data[`res${ __index++ }`] = {}
          //   break
          // add handler
          case 'add':
            if (uuidKey) {
              const timestamp = Date.now()
              const uuid = crypto.createHmac('sha1', PRIMARY_KEY_SALT)
                .update(`${ timestamp }${ PRIMARY_KEY_SALT }${ Math.random() * 1000 | 0 }`).digest('hex').substring(0, 20)
              await currentRepository.insert({
                ...currentJob.options,
                [uuidKey]: uuid
              })
            } else {
              const res = await currentRepository.insert({
                ...currentJob.options
              })
              result = {
                ...result,
                [`job__${ currentJob.config.transaction }__${ currentJob.id }`]: {
                  insertId: res.raw.insertId,
                }
              }
              data[`res${ __index++ }`] = {
                id: res.raw.insertId
              }
            }
            break
          // update handler
          case 'update':
            if (currentJob.options['$$WHERE_FIELD']) {
              if (currentJob.options['$$WHERE_FIELD'].length > 1) {
                throwError(`WHERE options is more than 1, please check your query again`, HttpStatus.BAD_REQUEST)
              }
              const validWhereField = currentJob.options['$$WHERE_FIELD'][0]
              delete currentJob.options['$$WHERE_FIELD']
              try {
                const res = await currentRepository.update(
                  {
                    [validWhereField.key]: validWhereField.value
                  },
                  currentJob.options
                )
                result = {
                  ...result,
                  [`job__${ currentJob.config.transaction }__${ currentJob.id }`]: {
                    affectedRows: res.raw.affectedRows,
                    changedRows: res.raw.changedRows
                  }
                }
              } catch (e) {
                return {
                  err: e.message
                }
              }
            } else {
              if (uuidKeyOrUniqueKey) {
                if (!currentJob.options[uuidKeyOrUniqueKey]) {
                  throwError(`[ERROR] "${ uuidKeyOrUniqueKey }" is required in update method`, HttpStatus.BAD_REQUEST)
                }
                try {
                  const res = await currentRepository.update(
                    {
                      [uuidKeyOrUniqueKey]: currentJob.options[uuidKeyOrUniqueKey]
                    },
                    currentJob.options
                  )
                  result = {
                    ...result,
                    [`job__${ currentJob.config.transaction }__${ currentJob.id }`]: {
                      affectedRows: res.raw.affectedRows,
                      changedRows: res.raw.changedRows
                    }
                  }
                } catch (e) {
                  return {
                    err: e.message
                  }
                }
              } else {
                return {
                  err: `[ERROR] there is something wrong with your query`
                }
              }
            }
            break
          // delete handler
          case 'delete':
            if (uuidKeyOrUniqueKey) {
              if (!currentJob.options[uuidKeyOrUniqueKey]) {
                return {
                  err: `[ERROR] "${ uuidKeyOrUniqueKey }" is required in delete method`
                }
              }
              try {
                const res = await currentRepository.delete({
                  [uuidKeyOrUniqueKey]: currentJob.options[uuidKeyOrUniqueKey]
                })
                result = {
                  ...result,
                  [`job__${ currentJob.config.transaction }__${ currentJob.id }`]: {
                    affectedRows: res.raw.affectedRows,
                  }
                }
              } catch (e) {
                return {
                  err: e.message
                }
              }
            } else {
              return {
                err: `[ERROR] there is something wrong with your query`
              }
            }
            break
        }
      }

      await queryRunner.commitTransaction()
    } catch (err) {
      await queryRunner.rollbackTransaction()
      return {
        err: '[ERROR] Transaction exec failed and has been rollback.',
        message: err.message
      }
    } finally {
      await queryRunner.release()
    }
    return result
  }

  async insert (entityName: string, payload: any = {}): Promise<any> {
    const entityNameKey = `${ entityName }Entity`
    const db = config[entityName].db || 'default'
    const currentRepository = getRepository(this.entityList[entityNameKey], db) as Repository<any>

    const uuidKey = config[entityName].uuid
    if (uuidKey) {
      const timestamp = Date.now()
      const uuid = crypto.createHmac('sha1', PRIMARY_KEY_SALT)
        .update(`${ timestamp }${ PRIMARY_KEY_SALT }${ Math.random() * 1000 | 0 }`).digest('hex').substring(0, 20)
      return currentRepository && currentRepository.insert({
        ...payload,
        [uuidKey]: uuid
      })
    } else {
      return currentRepository && currentRepository.insert({
        ...payload
      })
    }
  }

  async update (query: any, entityName: string, payload: any = {}): Promise<any> {
    const entityNameKey = `${ entityName }Entity`
    const db = config[entityName].db || 'default'
    const currentRepository = getRepository(this.entityList[entityNameKey], db) as Repository<any>

    const { $$WHERE_FIELD = [], ...restQuery } = query
    return currentRepository && currentRepository.update(query, payload)
  }

  async delete (query: any, entityName: string): Promise<any> {
    const entityNameKey = `${ entityName }Entity`
    const db = config[entityName].db || 'default'
    const currentRepository = getRepository(this.entityList[entityNameKey], db) as Repository<any>

    return currentRepository && currentRepository.delete(query)
  }

  async findOne (entityName: string, options: any = {}): Promise<any> {
    const entityNameKey = `${ entityName }Entity`
    const db = config[entityName].db || 'default'
    const currentRepository = getRepository(this.entityList[entityNameKey], db) as Repository<any>

    const {
      select = [], groupBy = [], orderBy = [],
      $$DATE_RANGE = {}, $$LIKE_FIELD = [],
      ...restOptions
    } = options

    // LIKE 表达式
    const likeOptions = {}
    $$LIKE_FIELD.forEach(item => {
      likeOptions[item.key] = Like(item.value)
    })
    const currentColumns = config[entityName].column.map(i => i.key)
    // 去除主键显示
    const safeCustomSelect = select.filter(i => {
      return (i !== config[entityName].primary || i === config[entityName].uniqueKey)
        && (currentColumns.indexOf(i) > -1)
    })
    // 除主键外的key
    const safeColumn = config[entityName].column.map(i => i.key).filter(i => {
      return i !== config[entityName].primary || i === config[entityName].uniqueKey
    })
    const dateRangeOption = {}
    if ($$DATE_RANGE.field && $$DATE_RANGE.value) {
      dateRangeOption[$$DATE_RANGE.field] = Between(
        new Date($$DATE_RANGE.value[0]),
        new Date($$DATE_RANGE.value[1])
      )
    }
    const orderByOption = {}
    orderBy.forEach(opt => {
      orderByOption[opt.key] = opt.orderType
    })
    console.log(safeCustomSelect, safeColumn, select)
    return currentRepository && currentRepository.createQueryBuilder()
      .select(safeCustomSelect.length ? safeCustomSelect : safeColumn)
      .where({
        ...restOptions,
        ...dateRangeOption,
        ...likeOptions,
      })
      .groupBy(groupBy.length && groupBy)
      .orderBy(orderByOption)
      .getRawOne()
  }

  async count (entityName: string, options: any = {}): Promise<number> {
    const entityNameKey = `${ entityName }Entity`
    const db = config[entityName].db || 'default'
    const currentRepository = getRepository(this.entityList[entityNameKey], db) as Repository<any>

    const {
      select = [], groupBy = [], orderBy = [],
      $$DATE_RANGE = {}, $$LIKE_FIELD = [],
      ...restOptions
    } = options
    const dateRangeOption = {}
    if ($$DATE_RANGE.field && $$DATE_RANGE.value) {
      dateRangeOption[$$DATE_RANGE.field] = Between(
        new Date($$DATE_RANGE.value[0]),
        new Date($$DATE_RANGE.value[1])
      )
    }
    // LIKE 表达式
    const likeOptions = {}
    $$LIKE_FIELD.forEach(item => {
      likeOptions[item.key] = Like(item.value)
    })
    if (groupBy.length) {
      const [ sql, parameters ] = currentRepository.createQueryBuilder().select('id').where({
        ...restOptions,
        ...dateRangeOption,
        ...likeOptions,
      }).groupBy(groupBy.length && groupBy).getQueryAndParameters();
      const [ count ] = await currentRepository.query(`SELECT COUNT(*) AS total FROM (${ sql }) p`, parameters);
      return count ? Number(count.total) : 0;
    }

    return currentRepository && currentRepository.count({
      ...restOptions,
      ...dateRangeOption,
      ...likeOptions,
    })
  }

  async find (entityName: string, options: any = {}, listOptions: any = {
    page: 1, count: 10
  }): Promise<any[]> {
    const entityNameKey = `${ entityName }Entity`
    const db = config[entityName].db || 'default'
    const currentRepository = getRepository(this.entityList[entityNameKey], db) as Repository<any>

    const {
      select = [], groupBy = [], orderBy = [],
      $$DATE_RANGE = {}, $$IN_FIELD = [], $$LIKE_FIELD = [],
      joinOptions = {}, ...restOptions
    } = options
    // LIKE 表达式
    const likeOptions = {}
    $$LIKE_FIELD.forEach(item => {
      likeOptions[item.key] = Like(item.value)
    })
    // IN 表达式 todo
    const inOptions = {}
    $$IN_FIELD.forEach(item => {
      inOptions[item.key] = In(item.value)
    })

    const currentColumns = config[entityName].column.map(i => i.key)
    // 去除主键显示
    const safeCustomSelect = select.filter(i => {
      return (i !== config[entityName].primary || i === config[entityName].uniqueKey)
        // && (currentColumns.indexOf(i) > -1)
    })
    // 除主键外的key
    const safeColumn = config[entityName].column.map(i => i.key).filter(i => {
      return i !== config[entityName].primary || i === config[entityName].uniqueKey
    })
    const dateRangeOption = {}
    if ($$DATE_RANGE.field && $$DATE_RANGE.value) {
      dateRangeOption[$$DATE_RANGE.field] = Between(
        new Date($$DATE_RANGE.value[0]),
        new Date($$DATE_RANGE.value[1])
      )
    }
    const orderByOption = {}
    orderBy.forEach(opt => {
      orderByOption[opt.key] = opt.orderType
    })
    return currentRepository && currentRepository.createQueryBuilder()
      .select(safeCustomSelect.length ? safeCustomSelect : safeColumn)
      .where({
        ...restOptions,
        ...dateRangeOption,
        ...inOptions,
        ...likeOptions,
      })
      .groupBy(groupBy.length && groupBy)
      .orderBy(orderByOption)
      .skip((listOptions.page - 1) * listOptions.count)
      .take(listOptions.count)
      .getRawMany()
  }
}
