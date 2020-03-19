import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v2 role-config 角色配置表
 */
@Entity('apijson_role_config')
export class ApiJsonRoleConfigEntity {
  @PrimaryGeneratedColumn()
  id: number

  /**
   * name 某个权限集合的名字
   */
  @Column()
  name: string

  @Column()
  desc: string

  @Column()
  table: string

  /**
   * table_right_list table_right集合  id<table_right>[]
   */
  @Column()
  table_right_list: string

  @Column()
  created_at: Date

  @Column()
  updated_at: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}