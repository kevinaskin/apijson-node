import { Post, Controller, Get, Body, Request, Req, HttpCode, HttpStatus, Logger } from '@nestjs/common'
import { ApiUseTags, ApiBearerAuth } from '@nestjs/swagger'
import { ApiJsonAppConfigService } from './app-config.service'
import { successHandler, baseHandler } from '../../helper'
import { config as tableConfigs } from '../../entities'
import { throwError } from '../json/utils'
import { writeFileSync, existsSync, readFileSync, exists, read, readFile, copyFileSync, readdirSync, mkdirSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'
import { Like, createConnection, createConnections } from 'typeorm'
import { flatten } from 'lodash'
import { exec } from 'child_process'
import { genDbConfigTpl } from '../../core/generatorDbConfig'
import { genEntity, genEntityFromColumns } from '../../helper/dbGen'
import { genEntityIndex } from '../../core/generatorEntities'

@ApiBearerAuth()
@ApiUseTags('v2/common')
@Controller('v2/common')
export class ApiJsonAppConfigController {
  constructor(private readonly configService: ApiJsonAppConfigService) {}

  @Post('/apply/table/config')
  async applyTableConfigLocal(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const list = await this.configService.find('tableConfig', {is_deleted: 0})
    
    if (list && list.length) {
      const realPath = process.env.NODE_ENV === 'development'
        ? '../../entities/'
        : '../../../src/entities/'
      const oldEntityList = await readdirSync(join(__dirname, realPath))
      for (let i = 0; i < oldEntityList.length; i++) {
        const name = oldEntityList[i]
        // unlink file
        await unlinkSync(join(__dirname, realPath + name))
        console.log('unlink ' + name)

        if (i === oldEntityList.length - 1) {
          console.log('finish copy and unlink')
        }
      }

      list.forEach(async item => {
        let res
        if (item.sql) {
          res = genEntity(item.sql, {
            uuid: item.uuid, 
            uniqueKey: item.unique_key,
            db: item.db,
            dbNick: item.name,
            dbTable: item.filename,
          })
        } else if (item.columns) {
          res = genEntityFromColumns(JSON.parse(item.columns), {
            uuid: item.uuid, 
            uniqueKey: item.unique_key,
            db: item.db,
            dbNick: item.name,
            dbTable: item.filename,
            dbReal: item.table_name,
          })
        } else {
          await this.configService.update('tableConfig', item.id, {
            is_deleted: 1
          })
          return baseHandler(HttpStatus.INTERNAL_SERVER_ERROR, {}, '错误的Table信息')
        }
        
        await writeFileSync(join(__dirname, realPath, `${res.entityName}.entity.ts`), res.tpl)
        await this.configService.update('tableConfig', item.id, {
          status: 1
        })
        console.log('write ' + res.entityName)
      })
      // write index.ts
      await writeFileSync(
        join(__dirname, realPath, `index.ts`), 
        genEntityIndex(list)
      )

      return successHandler('写入成功')
    }
    return baseHandler(HttpStatus.BAD_REQUEST, '未写入')
  }

  @Post('/table/update')
  async updateTableFromDB(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const {
      id, dbTable, dbNick, uniqueKey, uuid
    } = data
    try {
      await this.configService.update('tableConfig', id, {
        name: dbNick,
        filename: dbTable,
        uuid, unique_key: uniqueKey,
        operator: req.session.userInfo.realName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: 0,
        status: 0,
      })
      return successHandler({}, '更新表成功')
    } catch (e) {
      return baseHandler(HttpStatus.INTERNAL_SERVER_ERROR, {err: e.message}, '未知错误')
    }
  }

  @Post('/table/save')
  async saveTableFromDB(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const {
      db, name, table_name, uuid, unique_key, primary_key, columns, filename, db_real
    } = data
    try {
      const isDuplicatedDb = await this.configService.findOne('tableConfig', {
        where: { filename, is_deleted: 0 }
      })
      console.log(isDuplicatedDb)
      if (isDuplicatedDb) {
        return baseHandler(HttpStatus.BAD_REQUEST, {}, '全局唯一表名已存在, 请使用其他名字')
      }
      await this.configService.insert('tableConfig', {
        db, name, table_name, uuid, unique_key, filename, primary_key,
        columns: JSON.stringify(columns),
        db_real,
        sql: '',
        operator: req.session.userInfo.realName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: 0,
        status: 0,
      })
      return successHandler({}, '插入表成功，请在表管理中查看')
    } catch (e) {
      return baseHandler(HttpStatus.INTERNAL_SERVER_ERROR, {err: e.message}, '未知错误')
    }
  }

  /**
   * 本地生成entity文件接口
   * @param req 
   * query中包含建表sql, uuid, uniqueKey
   */
  @Post('/gen/exec')
  async execGenDb(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const {
      id = 0, sql, 
      db = '', dbTable = '', dbNick = '',
      uuid = '', uniqueKey = '', 
      exec = ''
    } = data
    if (sql) {
      try {
        const res = genEntity(sql, {
          uuid: uuid.trim(), 
          uniqueKey: uniqueKey.trim(),
          db: db.trim(),
          dbNick: dbNick.trim(),
          dbTable: dbTable.trim(),
        })
        if (!res) throwError(`Invalid sql`, HttpStatus.BAD_GATEWAY)
        if (exec === 'CREATED') {
          if (id) {
            await this.configService.update('tableConfig', id, {
              name: dbNick.trim(),
              filename: dbTable.trim(),
              db: db.trim(),
              uuid: uuid.trim(),
              primary_key: res.primary,
              unique_key: uniqueKey.trim(),
              sql,
              status: 0,
              is_deleted: 0,
              updated_at: new Date().toISOString()
            })
          } else {
            await this.configService.insert('tableConfig', {
              name: dbNick.trim(),
              filename: dbTable.trim(),
              db: db.trim(),
              uuid: uuid.trim(),
              primary_key: res.primary,
              unique_key: uniqueKey.trim(),
              sql,
              status: 0,
              is_deleted: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              operator: req.session.userInfo.realName
            })
          }
          return successHandler(res, `生成 [${res.entityName}.entity.ts] 成功`)
        } else if (res.isEntityNameDuplicated) {
          return baseHandler(-1, res, `[${res.entityName}] 已存在`)
        } else {
          return successHandler(res, `请检查生成的代码结构`)
        }
      } catch (e) {
        return baseHandler(400, {}, e.message)
      }
    } else {
      return baseHandler(400, {}, 'no sql string found')
    }
  }

  @Post('/refreshDb')
  async refreshDb(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const dbConfigList = await this.configService.find('dbConfig', { where: {valid: 1} })
    const dbConfigString = genDbConfigTpl(dbConfigList)
    try {
      await writeFileSync(resolve(__dirname, '../dbConfig.ts'), dbConfigString)
      return successHandler({}, 'refresh success')
    } catch (e) {
      return baseHandler(HttpStatus.INTERNAL_SERVER_ERROR, {err: e.message}, '写入配置失败')
    }
  }

  async makeDbQuery(data) {
    const { id, query } = data
    const db = await this.configService.findOne('dbConfig', {id})
    if (!db) {
      return baseHandler(HttpStatus.BAD_REQUEST, {}, 'Can not get db config')
    }
    const {config} = db
    const [host, port, database, username, password] = config.split('>>>')
    const conn = await createConnection({
      name: '__APIJSON_DB_TEST__', type: 'mysql',
      host, port, username, password, database
    })
    try {
      const res = await conn.query(query)
      await conn.close()
      return successHandler(res, 'success')
    } catch (e) {
      await conn.close()
      return baseHandler(HttpStatus.BAD_REQUEST, {err: e.message}, 'error')
    }
  }

  @Post('/fetch/table/columns')
  async getTableColumns(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id, table, updateId } = data
    const db = await this.configService.findOne('dbConfig', {id})
    if (!db) {
      return baseHandler(HttpStatus.BAD_REQUEST, {}, 'Can not get db config')
    }
    const {config} = db
    const [host, port, database, username, password] = config.split('>>>')
    const conn = await createConnection({
      name: '__APIJSON_DB_TEST__', type: 'mysql',
      host, port, username, password, database
    })
    try {
      const res = await conn.query(`SHOW FULL COLUMNS FROM ${table}`)
      await conn.close()
      const mapColumnType = (type: string) => {
        type = type.toUpperCase()
        const numberReg = /(TINYINT)|(SMALLINT)|(MEDIUMINT)|(INT)|(INTEGER)|(BIGINT)|(FLOAT)|(DOUBLE)|(DECIMAL)/
        const dateReg = /(DATE)|(TIME)|(YEAR)|(DATETIME)|(TIMESTAMP)/
        const stringReg = /(CHAR)|(VARCHAR)|(TINYBLOB)|(TINYTEXT)|(BLOB)|(TEXT)|(MEDIUMBLOB)|(MEDIUMTEXT)|(LONGBLOB)|(LONGTEXT)/
        if (numberReg.test(type)) {
          return 'number'
        } else if (dateReg.test(type)) {
          return 'Date'
        } else if (stringReg.test(type)) {
          return 'string'
        } else {
          console.error(`无法匹配"${type}"`)
          return ''
        }
      }
      if (updateId) {
        // update tableConfig
        await this.configService.update('tableConfig', updateId, {
          sql: '',
          columns: JSON.stringify(
            res.map((item: any) => {
              item.Type = mapColumnType(item.Type)
              return item
            }).map(i => ({
              desc: i.Comment,
              key: i.Field,
              type: i.Type,
              isPrimary: i.Key === 'PRI'
            }))
          ),
          status: 0
        })
        return successHandler({}, 'update success')
      } else {
        return successHandler(res.map((item: any) => {
          item.Type = mapColumnType(item.Type)
          return item
        }), 'success')
      }
    } catch (e) {
      await conn.close()
      return baseHandler(HttpStatus.BAD_REQUEST, {err: e.message}, 'error')
    }
  }

  @Post('/fetch/db/tables')
  async getDbConfig(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id } = data
    const db = await this.configService.findOne('dbConfig', {id})
    if (!db) {
      return baseHandler(HttpStatus.BAD_REQUEST, {}, 'Can not get db config')
    }
    const {config} = db
    const [host, port, database, username, password] = config.split('>>>')
    const conn = await createConnection({
      name: '__APIJSON_DB_TEST__', type: 'mysql',
      host, port, username, password, database
    })
    try {
      const res = await conn.query('SHOW TABLES')
      const importedTables = await this.configService.find('tableConfig', {
        where: {db: db.key, is_deleted: 0},
        select: ['id', 'name', 'table_name', 'status']
      })
      await conn.close()
      return successHandler({
        db: database,
        tableList: res.map(i => i[`Tables_in_${database}`]),
        importedTables
      }, 'success')
    } catch (e) {
      await conn.close()
      return baseHandler(HttpStatus.BAD_REQUEST, {err: e.message}, 'error')
    }
  }

  /**
   * 
   * @param req id
   */
  @Get('/tryDb')
  async tryDbConn(@Request() req) {
    const id = req.query.id || undefined
    const dbConfig = await this.configService.find('dbConfig', { where: id ? {id}: {valid: 1}})
    if (!dbConfig.length) {
      return baseHandler(HttpStatus.BAD_REQUEST, {}, '查无此DB配置')
    }
    const config = dbConfig.map(({config, key}) => {
      const _config = config.split('>>>')
      return {
        name: key + '111',
        type: 'mysql',
        host: _config[0],
        port: _config[1],
        username: _config[3],
        password: _config[4],
        database: _config[2],
      }
    })
    
    try {
      const conns = await createConnections(config)
      for (let i = 0; i < conns.length; i++) {
        await conns[i].close()
      }
      if (id) {
        await this.configService.update('dbConfig', id, { valid: 1 })
        Logger.log(`[DB test] DB id = ${id} TEST PASS set valid to 1`)
      }
      return successHandler({}, 'db conn success')
    } catch (e) {
      Logger.error(e)
      if (id) {
        await this.configService.update('dbConfig', id, { valid: 0 })
        Logger.log(`[DB test] DB id = ${id} TEST PASS set valid to 0`)
      }
      return baseHandler(HttpStatus.INTERNAL_SERVER_ERROR, {
        err: e
      }, 'db conn fail')
    }
  }

  @Post('/rebuild')
  async rebuildDist(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    exec('tsc', (err, stdout, stderr) => {
      if (err) {
        Logger.error(err)
        Logger.error(stderr)
      }
      Logger.log(stdout)
      exec('pm2 restart ai-apijson-node', (pm2Err, pm2Stdout, pm2Stderr) => {
        if (pm2Err) {
          Logger.error(pm2Err)
          Logger.error(pm2Stderr)
        }
        Logger.log(pm2Stdout)
        
      })
    })
    return successHandler('正在重启...') 
  }

  @Get('/graphData')
  async getGraphData(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    let dataSum: any = {}
    const boolSum = await existsSync(resolve(__dirname, `../../../db/sum.json`))
    if (boolSum) {
      dataSum = await readFileSync(resolve(__dirname, `../../../db/sum.json`))
      dataSum = JSON.parse(dataSum.toString())
    }
    const sortByDate = async time => {
      const searchDate = new Date(time).toISOString().slice(0, 10)
      const isToday = new Date().toISOString().slice(0, 10) === searchDate
      if (dataSum.searchDate && !isToday) {
        return
      }
      const bool = await existsSync(resolve(__dirname, `../../../db/${searchDate}.json`))
      if (bool) {
        const data = await readFileSync(resolve(__dirname, `../../../db/${searchDate}.json`))
        try {
          const json = JSON.parse(data.toString())
          const REG = /\[\d+\:\d+\]\s([a-zA-Z-]+)\s(.*)/
          let ret = []
          Object.keys(json).forEach(key => {
            const val = json[key]
            const result = REG.exec(val)
            if (!result[1]) return
  
            ret.push({
              name: result[1],
              body: result[2],
              time: new Date(key).toLocaleTimeString()
            })
          })
          
          let count = {}
          ret.forEach(item => {
            if (count[item.name]) {
              count[item.name]++
            } else {
              count[item.name] = 1
            }
          })
          dataSum[searchDate] = {
            ...count,
            date: searchDate.slice(5)
          }
          return {
            ...count,
            date: searchDate.slice(5)
          }
        } catch (e) {
          console.log(e)
        }
      }
    }

    let startTime = Date.now()
    if (req.query.startTime) {
      startTime = Date.parse(req.query.startTime)
    }
    let ret = []
    for (let i = 0; i < 7; i++) {
      const time = startTime - (i * 24 * 3600 * 1000)
      const count = await sortByDate(time)

      count && Object.keys(count).forEach(key => {
        if (key !== 'date') {
          ret.push({
            name: key,
            count: count[key],
            date: count.date
          })
        }
      })
    }
    await writeFileSync(resolve(__dirname, `../../../db/sum.json`), JSON.stringify(dataSum, null, 2))
    Logger.log('[dataSum] write success')
    // calc sum
    let sum = 0
    let countGroupByApp = {}
    let lastTime = '9999-12-31'
    Object.keys(dataSum).forEach((day) => {
      if (
        Number(day.replace(/-/g, '')) < Number(lastTime.replace(/-/g, ''))
      ) {
        lastTime = day
      }
      Object.keys(dataSum[day]).forEach((key) => {
        if (key !== 'date') {
          sum += dataSum[day][key]
          countGroupByApp[key] = countGroupByApp[key] || 0
          countGroupByApp[key] += dataSum[day][key]
        }
      })
    })
    return successHandler({
      lastTime,
      sum,
      countGroupByApp,
      rangeData: ret
    }, '获取图表信息成功')
  }

  @Get('/app')
  async getApp(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const id = req.query.id
    try {
      const res = await this.configService.findOne('appConfig', { id })
      return successHandler(res, '获取应用信息成功')
    } catch (e) {
      return baseHandler(500, { error: e }, '获取应用信息失败')
    }
  }

  @Get('/app/list')
  async getAppList(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const page = req.query.page || 1
    const pageSize = req.query.pageSize || 10
    const search = req.query.search || ''

    let findOption = {
      select: [
        'id', 'name', 'app_code',
        'req_middleware_list', 'res_middleware_list', 'app_roles',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { is_deleted: 0 }
    }
    if (search) {
      findOption.where['name'] = Like(`%${search}%`)
    }

    try {
      let appList = await this.configService.find('appConfig', findOption)
      const midList = new Set()
      const roleList = new Set()
      appList.forEach(item => {
        item.req_middleware_list.split(',')
          .filter(Boolean).map(Number)
          .forEach(i => midList.add(i))
        item.res_middleware_list.split(',')
          .filter(Boolean).map(Number)
          .forEach(i => midList.add(i))
        item.app_roles.split(',')
          .filter(Boolean).map(Number)
          .forEach(i => roleList.add(i))
      })
      const midItems = await this.configService.find('customMid', {
        where: [...midList].map(id => ({ id })),
        select: ['id', 'name', 'desc', 'checked']
      })
      const roleItems = await this.configService.find('roleConfig', {
        where: [...roleList].map(id => ({ id })),
        select: ['id', 'name', 'desc', 'table_right_list', 'table']
      })
      appList = appList.map(item => {
        item.req_middleware_list = item.req_middleware_list
          .split(',')
          .filter(Boolean)
          .map(Number)
          .map(id => {
            return midItems.find(mid => mid.id === id)
          })
        item.res_middleware_list = item.res_middleware_list
          .split(',')
          .filter(Boolean)
          .map(Number)
          .map(id => {
            return midItems.find(mid => mid.id === id)
          })
        item.app_roles = item.app_roles
          .split(',')
          .filter(Boolean)
          .map(Number)
          .map(id => {
            return roleItems.find(role => role.id === id)
          })
        return item
      })
      const appCount = await this.configService.count('appConfig', findOption)
  
      return successHandler({
        list: appList,
        page: Number(page),
        pageSize: Number(pageSize),
        totalCount: appCount
      }, '获取应用列表成功')
    } catch (e) {
      return baseHandler(500, {error: e.message}, '获取应用列表失败')
    }
  }

  @Post('/app/del')
  async delApp(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const { id = 0 } = data
    try {
      if (id) {
        await this.configService.update('appConfig', id, {
          is_deleted: 1
        })
        return successHandler({}, '删除成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '删除失败')
    }
  }

  @Get('/app/detail')
  async getAppDetail(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0 } = req.query
    try {
      if (id) {
        const detail = await this.configService.findOne('appConfig', id)
        const reqOptList = await this.configService.find('customMid', {
          where: {
            type: 'req'
          }
        })
        const resOptList = await this.configService.find('customMid', {
          where: {
            type: 'res'
          }
        })
        const rolesList = await this.configService.find('roleConfig', {
          where: {
            is_deleted: 0
          },
          select: ['id', 'desc', 'table', 'name']
        })
        return successHandler({
          detail,
          reqOptList,
          resOptList,
          rolesList,
        }, '获取app详情成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Post('/app/save')
  async addOrUpdateApp(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0, ...options } = data
    try {
      if (id) {
        // update
        await this.configService.update('appConfig', id, {
          ...options,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({ data }, '更新成功')
      } else {
        // add
        await this.configService.insert('appConfig', {
          ...options,
          operator: req.session.userInfo.realName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        })
        return successHandler({}, '添加成功')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Get('/customMid/list')
  async getCustomMidList(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const page = req.query.page || 1
    const pageSize = req.query.pageSize || 10
    const search = req.query.search || ''

    let findOption = {
      select: [
        'id', 'name', 'type', 'desc',
        'function', 'checked',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { is_deleted: 0 }
    }
    if (search) {
      findOption.where['name'] = Like(`%${search}%`)
    }


    try {
      const midList = await this.configService.find('customMid', findOption)
      const midCount = await this.configService.count('customMid', findOption)
  
      return successHandler({
        list: midList,
        page: Number(page),
        pageSize: Number(pageSize),
        totalCount: midCount,
      }, '获取自定义逻辑列表成功')
    } catch (e) {
      return baseHandler(500, {error: e}, '获取自定义逻辑列表失败')
    }
  }

  @Get('/customMid/detail')
  async setCustomMidDetail(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0 } = req.query
    try {
      if (id) {
        const data = await this.configService.findOne('customMid', { id })
        return successHandler(data, '获取自定义逻辑详情成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Post('/customMid/checked')
  async setCustomMidCheckStatus(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0, checked } = data
    try {
      if (req.session.userInfo.role !== 'admin' && checked === 1) {
        return baseHandler(401, {}, '您不是管理员，无法进行此操作')
      }
      if (id) {
        if (Number(checked) !== 0 && Number(checked) !== 1) {
          return baseHandler(400, {}, 'checked值错误')
        }
        await this.configService.update('customMid', id, {
          checked,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({ data }, '修改状态成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Post('/saveCustomMid')
  async addOrUpdateCustomMid(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0, ...options } = data
    try {
      if (id) {
        const mid = await this.configService.findOne('customMid', { id })
        if (!mid) {
          return baseHandler(400, {}, '数据错误')
        }
        if (mid.function !== options.function) {
          // 重置checked状态
          options.checked = 0
        }
        // update
        await this.configService.update('customMid', id, {
          ...options,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({ data }, '更新成功')
      } else {
        // add
        await this.configService.insert('customMid', {
          ...options,
          checked: 0,
          operator: req.session.userInfo.realName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        })
        return successHandler({}, '添加成功')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Post('/customMid/del')
  async delCustomMid(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const { id = 0 } = data
    try {
      if (id) {
        await this.configService.update('customMid', id, {
          is_deleted: 1
        })
        return successHandler({}, '删除成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '删除失败')
    }
  }

  @Get('/tableRight/list')
  async getTableRightList(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const page = req.query.page || 1
    const pageSize = req.query.pageSize || 10
    const search = req.query.search || ''
    const tableId = req.query.tableId || ''

    if (!tableId) {
      return baseHandler(400, {}, 'tableId是必传字段')
    }

    let findOption = {
      select: [
        'id', 'name', 'desc',
        'get_fields', 'update_fields', 'add_right', 'del_right',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { is_deleted: 0, table: tableId }
    }
    if (search) {
      findOption.where['name'] = Like(`%${search}%`)
    }

    try {
      const appList = await this.configService.find('tableRight', findOption)
      const appListCount = await this.configService.count('tableRight', findOption)
      return successHandler({
        list: appList,
        page: Number(page),
        pageSize: Number(pageSize),
        totalCount: appListCount
      }, '获取单表权限列表成功')
    } catch (e) {
      return baseHandler(500, {error: e}, '获取单表权限列表失败')
    }
  }

  @Post('/tableRight')
  async addOrUpdateTableRight(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0, ...options } = data
    try {
      if (id) {
        // update
        await this.configService.update('tableRight', id, {
          ...options,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({ data }, '更新成功')
      } else {
        // add
        await this.configService.insert('tableRight', {
          ...options,
          operator: req.session.userInfo.realName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        })
        return successHandler({}, '添加成功')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Post('/tableRight/del')
  async delTableRight(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const { id = 0 } = data
    try {
      if (id) {
        await this.configService.update('tableRight', id, {
          is_deleted: 1
        })
        return successHandler({}, '删除成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '删除失败')
    }
  }

  @Get('/roleConfig/list')
  async getRoleConfigList(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const page = req.query.page || 1
    const pageSize = req.query.pageSize || 10
    const search = req.query.search || ''

    let findOption = {
      select: [
        'id', 'name',
        'desc', 'table_right_list',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { is_deleted: 0 }
    }
    if (search) {
      findOption.where['name'] = Like(`%${search}%`)
    }

    try {
      const appList = await this.configService.find('roleConfig', findOption)
  
      return successHandler(appList, '获取角色配置列表成功')
    } catch (e) {
      return baseHandler(500, {error: e}, '获取角色配置列表失败')
    }
  }

  @Post('/roleConfig')
  async addOrUpdateRoleConfig(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const { id = 0, ...options } = data
    try {
      if (id) {
        // update
        await this.configService.update('roleConfig', id, {
          ...options,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({ data }, '更新成功')
      } else {
        // add
        await this.configService.insert('roleConfig', {
          ...options,
          operator: req.session.userInfo.realName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        })
        return successHandler({}, '添加成功')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '服务出错了')
    }
  }

  @Post('/roleConfig/del')
  async delRoleConfig(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const { id = 0 } = data
    try {
      if (id) {
        await this.configService.update('roleConfig', id, {
          is_deleted: 1
        })
        return successHandler({}, '删除成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '删除失败')
    }
  }

  @Get('/table')
  async getTableByName(@Request() req): Promise<any> {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const name = req.query.name || ''
    if (!name) {
      return baseHandler(400, {}, '缺少name')
    }
    const table = await this.configService.findOne('tableConfig', {
      where: {filename: name}
    })
    console.log(table)
    if (!table.sql) {
      return successHandler({
        name,
        desc: table.name,
        columns: JSON.parse(table.columns)
      }, 'ok')
    } else {
      return successHandler({
        name,
        desc: tableConfigs[name].desc,
        columns: tableConfigs[name].column
      }, 'ok')
    }
  }

  @Get('/getTableByTableName')
  async getTableByTableName(@Request() req): Promise<any> {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const table_name = req.query.table_name || ''
    const db = req.query.db || ''
    if (!table_name) {
      return baseHandler(400, {}, '缺少table_name')
    }
    if (!db) {
      return baseHandler(400, {}, '缺少db')
    }

    try {
      const table = await this.configService.findOne('tableConfig', {
        where: {table_name, db}
      })
      return successHandler(table, 'ok')
    } catch (e) {
      return baseHandler(HttpStatus.BAD_REQUEST, {err: e.message}, '未知错误')
    }
  }

  @Get('/tables')
  async getTables(@Request() req): Promise<any> {
    if (req.session.userInfo) {
      const page = req.query.page || 1
      const pageSize = req.query.pageSize || 10
      const search = req.query.search || ''

      let findOption = {
        select: [
          'id', 'name', 'filename', 'status', 'table_name',
          'db', 'sql', 'uuid', 'unique_key', 'primary_key',
          'created_at', 'updated_at', 'operator',
          'is_deleted'
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        where: { is_deleted: 0 }
      }
      if (search) {
        findOption.where['name'] = Like(`%${search}%`)
      }

      try {
        const tableList = await this.configService.find('tableConfig', findOption)
        const tableListCount = await this.configService.count('tableConfig', findOption)
        return successHandler({
          list: tableList,
          page: Number(page),
          pageSize: Number(pageSize),
          totalCount: tableListCount
        }, '获取Table列表成功')
      } catch (e) {
        return baseHandler(500, {error: e.message}, '获取Table列表失败')
      }
    } else {
      return baseHandler(403, {}, '未登录')
    }
  }

  @Post('/saveTableRight')
  async saveTableRight(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const {id} = data
    try {
      if (Number(id) > 0) {
        // edit
        delete data.id
        await this.configService.update('tableRight', id, {
          ...data,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName
        })
        return successHandler({}, '修改单表角色成功')
      } else {
        // add
        delete data.id
        await this.configService.insert('tableRight', {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({}, '添加单表角色成功')
      }
    } catch (e) {
      return baseHandler(400, {error: e}, '出错了')
    }
  }

  @Get('/tableRoleRight')
  async getTableRoleRight(@Request() req) {
    if (!req.session.userInfo) return baseHandler(403, {}, '未登录')

    const {id} = req.query
    if (!id || Number(id) === 0) return baseHandler(400, {}, '无此id')

    try {
      const res = await this.configService.findOne('tableRight', { id: Number(id) })
      if (res.id) {
        return successHandler(res, '获取单表角色详情成功')
      } else {
        return baseHandler(400, {id}, '没有查到该数据')
      }
    } catch (e) {
      return baseHandler(400, {error: e.message}, '出错了')
    }
  }

  @Get('/db/list')
  async getDbList(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const page = req.query.page || 1
    const pageSize = req.query.pageSize || 10
    const search = req.query.search || ''

    let findOption = {
      select: [
        'id', 'name', 'config', 'key', 'valid',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { is_deleted: 0 },
    }
    if (search) {
      findOption.where['name'] = Like(`%${search}%`)
    }

    try {
      let dbList = await this.configService.find('dbConfig', findOption)
      const dbListCount = await this.configService.count('dbConfig', findOption)

      return successHandler({
        list: dbList,
        page: Number(page),
        pageSize: Number(pageSize),
        totalCount: dbListCount
      }, '获取数据库列表成功')
    } catch (e) {
      return baseHandler(500, {error: e}, '获取数据库列表成功失败')
    }
  }

  @Get('/roles/list')
  async getRolesList(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const page = req.query.page || 1
    const pageSize = req.query.pageSize || 10
    const search = req.query.search || ''

    let findOption = {
      select: [
        'id', 'name', 'desc',
        'table_right_list',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { is_deleted: 0 },
    }
    if (search) {
      findOption.where['name'] = Like(`%${search}%`)
    }

    try {
      let rolesList = await this.configService.find('roleConfig', findOption)
      const tableRightList = rolesList
        .map(i => i.table_right_list)
        .map(i => i.split(','))
        .filter(Boolean)
      const flattenedList = flatten(tableRightList)
      const tableRightConfigList = await this.configService.find('tableRight', {
        where: flattenedList.map((id: string | number) => ({ id: Number(id) }))
      })
      rolesList = rolesList.map(role => {
        const tList = role.table_right_list
          .split(',')
          .filter(Boolean)
          .map(id => {
            const target = tableRightConfigList.find(t => {
              return Number(t.id) === Number(id)
            })
            return target.name
          })
        role.table_right_list = tList.join(', ')
        return role
      })
      const rolesListCount = await this.configService.count('roleConfig', findOption)
      return successHandler({
        list: rolesList,
        page: Number(page),
        pageSize: Number(pageSize),
        totalCount: rolesListCount
      }, '获取角色列表成功')
    } catch (e) {
      return baseHandler(500, {error: e}, '获取角色列表成功失败')
    }
  }

  @Get('/role')
  async getRoleById(@Request() req) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    const id = req.query.id || ''
    if (!id) return baseHandler(400, {}, '缺少id')

    let findOption = {
      select: [
        'id', 'name', 'desc',
        'table', 'table_right_list',
        'created_at', 'updated_at', 'operator',
        'is_deleted'
      ],
      where: { id }
    }
    const tableInDB = await this.configService.find('tableConfig')
    // tableNames.forEach(name => {
    //   tables.push({
    //     value: name,
    //     key: tableConfigs[name].desc,
    //     columns: tableConfigs[name].column
    //   })
    // })
    const tables = tableInDB.map(item => ({
      value: item.filename,
      key: item.name, // 中文名
      columns: item.columns 
        ? JSON.parse(item.columns)
        : tableConfigs[item.filename].column,
      id: item.id,
    }))
    try {
      const role = await this.configService.findOne('roleConfig', findOption)
      return successHandler({
        role: role || {},
        tables
      }, '获取角色详情成功')
    } catch (e) {
      return baseHandler(500, {error: e}, '获取角色列表成功失败')
    }
  }

  @Post('/role/save')
  async saveRole(@Request() req, @Body() data) {
    if (!req.session.userInfo) return baseHandler(403, {}, '未登录')

    const {id} = data
    try {
      if (Number(id) > 0) {
        // edit
        delete data.id
        await this.configService.update('roleConfig', id, {
          ...data,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName
        })
        return successHandler({}, '修改角色成功')
      } else {
        // add
        delete data.id
        await this.configService.insert('roleConfig', {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({}, '添加角色成功')
      }
    } catch (e) {
      return baseHandler(400, {error: e}, '出错了')
    }
  }

  @Post('/db/save')
  async saveDb(@Request() req, @Body() data) {
    if (!req.session.userInfo) return baseHandler(403, {}, '未登录')

    const {id} = data
    try {
      if (Number(id) > 0) {
        // edit
        delete data.id
        await this.configService.update('dbConfig', id, {
          ...data,
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName
        })
        return successHandler({}, '修改DB成功')
      } else {
        // add
        delete data.id
        const isDuplicatedDb = await this.configService.findOne('dbConfig', {key: data.key})
        if (isDuplicatedDb) {
          return baseHandler(HttpStatus.BAD_REQUEST, {}, 'key重复, 无法添加')
        }
        await this.configService.insert('dbConfig', {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          operator: req.session.userInfo.realName,
          is_deleted: 0
        })
        return successHandler({}, '添加DB成功')
      }
    } catch (e) {
      return baseHandler(400, {error: e}, '出错了')
    }
  }

  @Post('/db/del')
  async delDb(@Request() req, @Body() data) {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }
    const { id = 0 } = data
    try {
      if (id) {
        await this.configService.update('dbConfig', id, {
          is_deleted: 1
        })
        return successHandler({}, '删除成功')
      } else {
        return baseHandler(400, {}, '缺少id')
      }
    } catch (e) {
      return baseHandler(500, {error: e}, '删除失败')
    }
  }
}