import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v2 app-config table 应用管理
 */
@Entity('apijson_application_config')
export class ApiJsonAppConfigEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  app_code: string

  /**
   * req middleware<string>[]
   */
  @Column()
  req_middleware_list: string

  /**
   * res middleware<string>[]
   */
  @Column()
  res_middleware_list: string

  /**
   * app_roles role[]
   */
  @Column()
  app_roles: string

  @Column()
  created_at: Date

  @Column()
  updated_at: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}