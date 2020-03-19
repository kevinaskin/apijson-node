import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v2 app-config 表配置管理
 */
@Entity('apijson_table_config')
export class ApiJsonTableConfigEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  filename: string

  @Column()
  name: string

  @Column()
  table_name: string

  @Column()
  db: string

  @Column()
  sql: string

  @Column()
  columns: string

  @Column()
  primary_key: string
  
  @Column()
  uuid: string

  @Column()
  unique_key: string

  @Column()
  status: number

  @Column()
  created_at: Date

  @Column()
  updated_at: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}