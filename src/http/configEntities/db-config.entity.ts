import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v2 db配置管理
 */
@Entity('apijson_db_config')
export class ApiJsonDBConfigEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  config: string

  @Column()
  key: string

  @Column()
  valid: number

  @Column()
  created_at: Date

  @Column()
  updated_at: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}