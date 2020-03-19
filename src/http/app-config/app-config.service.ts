import { Injectable} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, getConnection, Like } from 'typeorm'
import { 
  ApiJsonAppConfigEntity,
  ApiJsonCustomMidEntity,
  ApiJsonTableRightEntity,
  ApiJsonRoleConfigEntity,
  ApiJsonTableConfigEntity,
  ApiJsonDBConfigEntity
} from '../configEntities'

type TableName = 'appConfig' | 'customMid' | 'tableRight' | 'roleConfig' | 'tableConfig' | 'dbConfig'

@Injectable()
export class ApiJsonAppConfigService {
  @InjectRepository(ApiJsonAppConfigEntity, 'apijsonDB')
  private readonly appConfig: Repository<ApiJsonAppConfigEntity>
  @InjectRepository(ApiJsonCustomMidEntity, 'apijsonDB')
  private readonly customMid: Repository<ApiJsonCustomMidEntity>
  @InjectRepository(ApiJsonTableRightEntity, 'apijsonDB')
  private readonly tableRight: Repository<ApiJsonTableRightEntity>
  @InjectRepository(ApiJsonRoleConfigEntity, 'apijsonDB')
  private readonly roleConfig: Repository<ApiJsonRoleConfigEntity>
  @InjectRepository(ApiJsonTableConfigEntity, 'apijsonDB')
  private readonly tableConfig: Repository<ApiJsonTableConfigEntity>
  @InjectRepository(ApiJsonDBConfigEntity, 'apijsonDB')
  private readonly dbConfig: Repository<ApiJsonDBConfigEntity>

  async findOne(table: TableName, options: any = {}): Promise<any> {
    const targetTable = this[table] as Repository<any>
    return targetTable.findOne(options)
  }

  async find(table: TableName, options: any = {}): Promise<any> {
    const targetTable = this[table] as Repository<any>
    return targetTable.find(options)
  }

  async count(table: TableName, options: any = {}): Promise<any> {
    const targetTable = this[table] as Repository<any>
    return targetTable.count(options)
  }

  async update(table: TableName, id, options: any = {}): Promise<any> {
    const targetTable = this[table] as Repository<any>
    return targetTable.update(id, options)
  }

  async delete(table: TableName, options: any = {}): Promise<any> {
    const targetTable = this[table] as Repository<any>
    return targetTable.delete(options)
  }

  async insert(table: TableName, options: any = {}): Promise<any> {
    const targetTable = this[table] as Repository<any>
    return targetTable.insert(options)
  }

  queryBuilder (table: TableName): any {
    const targetTable = this[table] as Repository<any>
    return targetTable.createQueryBuilder()
  }
}
