import * as entity from '../entities'
import { get as safeGet } from 'lodash'

export interface JobInterface {
  id: number,
  $$type: string,
  table: string,
  options: any,
  ListOptions?: any,
  replacePath: string[],
  config?: any
}

interface listUnionOptionsInterface {
  key: string,
  body: any,
  parentPath: string[]
}

export enum StatusEnum {
  Working = 1,
  Free,
}

let AUTO_INCREASE_JOB_ID = 0
export const JOB_TYPE = {
  SINGLE: 'SINGLE_JOB',
  UNION: 'UNION_JOB',
  LIST: 'LIST_JOB',
  LIST_UNION: 'LIST_UNION'
}
const { config: TABLE_CONFIG, ...allEntity } = entity
const ENTITY_LIST: string[] = Object.keys(allEntity).map(name => {
  return name.replace('Entity', '')
})
const NORMALIZE_KEY_REGEXP: RegExp = /^([A-Za-z0-9]+)(\[\])?(\@)?(\#?)$|(\@column)/

export class RequestParser {

  status: StatusEnum = StatusEnum.Free
  errors: string[] = []
  queue: JobInterface[] = []
  jobIds: number[] = []
  _originalJson: object

  constructor(json) {
    this.startJob(json)
  }

  startJob(json) {
    this.status = StatusEnum.Working
    this._originalJson = json
    this.traverse(json)
  }

  /**
   * find sql job[]
   * @param json 
   */
  traverse (
    json: object, 
    parentPath: string[] = [], 
    parentTableName: string = ''
  ): void {
    const errors = this.errors
    const keys = Object.keys(json)
    keys.forEach(key => {
      const keyExecResult = NORMALIZE_KEY_REGEXP.exec(key)
      if (!keyExecResult) {
        errors.push(`[ERROR] the key "${key}" is supposed to include at least one letter besides the operation symbol ([], @, etc.)`)
        return
      } else if (keyExecResult[2] && keyExecResult[3]) {
        // no matched body or exists `[]` and `@` both
        errors.push(`[ERROR] invalid request json at key "${key}"`)
        return
      }
      // 校验column合法性，entity合法性，或为别名（#结尾）的情况
      const COLUMN_LIST = safeGet(TABLE_CONFIG, `${parentTableName}.column`, []).map(i => i.key)
      if ([
        ...ENTITY_LIST, 
        ...COLUMN_LIST, 
      ].indexOf(keyExecResult[1]) === -1 && !keyExecResult[4] && !keyExecResult[2]) {
        errors.push(`[ERROR] no such a "${keyExecResult[1]}" entity or column exist`)
        return
      }
  
      if (key.indexOf('[]') > -1) {
        this.handleListJob(key, json[key], parentPath)
        return
      }
      if (key.indexOf('@') > -1) {
        this.handleUnionJob(key, json[key], parentPath)
        return
      }
      this.handleSingleJob(key, json[key], parentPath)
    })
  }

  handleListUnionJob(
    key: string, 
    body: any, 
    parentPath: string[],
    options: any,
    ListOptions: any
  ): void {
    console.log('start UNION_JOB', key, body, parentPath)
    if (typeof body !== 'string') {
      this.errors.push(`[ERROR] invalid union job syntax at key "${key}"`)
      return
    }
    const referArgs: string[] = body.split('/')
    const queryTable = parentPath[parentPath.length - 1]
    if (ENTITY_LIST.indexOf(queryTable) < 0) {
      this.errors.push(`[ERROR] invalid union refer syntax at key "${key}", can not find entity "${queryTable}"`)
      return
    }

    this.createJob({
      id: AUTO_INCREASE_JOB_ID++,
      $$type: JOB_TYPE.LIST_UNION,
      table: queryTable,
      options: { ...options, referArgs, referVar: key.replace(/@/g, '') },
      ListOptions,
      replacePath: [...parentPath]
    }, false)
  }

  handleUnionJob(key: string, body: any, parentPath: string[]): void {
    console.log('start UNION_JOB', key, body, parentPath)
    if (typeof body !== 'string') {
      this.errors.push(`[ERROR] invalid union job syntax at key "${key}"`)
      return
    }
    const referArgs: string[] = body.split('/')
    const queryTable = parentPath[parentPath.length - 1]
    if (ENTITY_LIST.indexOf(queryTable) < 0) {
      this.errors.push(`[ERROR] invalid union refer syntax at key "${key}", can not find entity "${queryTable}"`)
      return
    }
    this.createJob({
      id: AUTO_INCREASE_JOB_ID++,
      $$type: JOB_TYPE.UNION,
      table: queryTable,
      options: { referArgs, referVar: key.replace(/@/g, '') },
      ListOptions: {},
      replacePath: [...parentPath]
    }, false)
  }
  
  handleListJob(key: string, body: any, parentPath: string[]): void {
    console.log('start LIST_JOB', key, body, parentPath)

    let LIST_JOB_FLAG = true

    const fields = Object.keys(body)
    const targetTables = fields.filter(field => ENTITY_LIST.indexOf(field) > -1)
    if (targetTables.length === 0) {
      this.errors.push(`[ERROR] can not find a TABLE name in entities at column "${key}", please ensure spelling correctly or contact the developer for adding a new entity first.`)
      return
    } else if (targetTables.length > 1) {
      this.errors.push(`[ERROR] there are more than one table entity in the column "${key}", please check your request body.`)
      return
    } else {
      let queryTable = targetTables[0]
      const column = TABLE_CONFIG[queryTable] && TABLE_CONFIG[queryTable].column.map(i => i.key) || []
      const options = {}
      const ListOptions = {
        page: 1,
        count: 10
      }
      let listUnionOptions: listUnionOptionsInterface
      fields.forEach(field => {
        if (field === 'count' || field === 'page') {
          ListOptions[field] = body[field]
        } else if (field === queryTable) {
          const queryTableKeys = Object.keys(body[field])
          queryTableKeys.forEach(subKey => {
            const normalizedKey = subKey.replace(/\[\]/g, '').replace(/\@/g, '')
            if (column.indexOf(subKey) > -1) {
              options[subKey] = body[field][subKey]
            } else if (column.indexOf(normalizedKey) > -1) {
              // 数组中的联表查询
              LIST_JOB_FLAG = false
              listUnionOptions = {
                key: subKey, 
                body: body[field][subKey], 
                parentPath: [...parentPath, key, field]
              }
            } else if (subKey === '@column') {
              options['select'] = body[field][subKey]
                .split(',')
                .map(name => name.trim())
            } else {
              this.errors.push(`[ERROR] no such a "${subKey}" column exist at table "${field}"`)
              return
            }
          })
        } else {
          this.errors.push(`[ERROR] invalid key "${field}" at "${key}"`)
          return
        }
      })
      if (LIST_JOB_FLAG) {
        this.createJob({
          id: AUTO_INCREASE_JOB_ID++,
          $$type: JOB_TYPE.LIST,
          table: queryTable,
          options,
          ListOptions,
          replacePath: [...parentPath, key]
        })
      } else {
        this.handleListUnionJob(
          listUnionOptions.key,
          listUnionOptions.body,
          listUnionOptions.parentPath,
          options,
          ListOptions
        )
      }
    }
  }

  handleSingleJob(key: string, body: any, parentPath: string[]): void {
    console.log('start SINGLE_JOB', key, body, parentPath)
    const column = TABLE_CONFIG[key] && TABLE_CONFIG[key].column.map(i => i.key) || []
    
    let SINGLE_JOB_FLAG = true

    const fields = Object.keys(body)
    const options = {}
    fields.forEach(field => {
      // 存在匹配的字段
      if (column.indexOf(field) > -1) {
        options[field] = body[field]
      } else if (field === '@column') {
        options['select'] = body[field].split(',').map(name => name.trim())
      } else if (field.endsWith('@')) {
        // start a union job
        SINGLE_JOB_FLAG = false
        this.traverse(
          { [field]: body[field] },
          [...parentPath, key],
          key
        )
      } else {
        this.traverse(
          { [field]: body[field] },
          [...parentPath, key],
          key
        )
      }
    })
    if (ENTITY_LIST.indexOf(key) > -1 && SINGLE_JOB_FLAG) {
      this.createJob({
        id: AUTO_INCREASE_JOB_ID++,
        $$type: JOB_TYPE.SINGLE,
        table: key,
        options,
        replacePath: [...parentPath, key]
      })
    }
  }

  createJob (job: JobInterface, tail: boolean = true) {
    job = {
      config: {
        primary: safeGet(TABLE_CONFIG, `${job.table}.primary`, '')
      },
      ...job
    }
    if (tail) {
      this.queue.push(job)
    } else {
      this.queue.splice(0, 0, job)
    }
    this.jobIds.push(job.id)
    console.log('ADD_JOB: ', JSON.stringify(job, null, 2))
  }

  flushJob () {
    this.queue.length = 0
    this.jobIds.length = 0
    this._originalJson = {}
    this.errors = []
    this.status = StatusEnum.Free
    console.log('FLUSH_JOB Completed')
  }
}
