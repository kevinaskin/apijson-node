import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v2 table-right 单表权限表
 */
@Entity('apijson_table_right')
export class ApiJsonTableRightEntity {
  @PrimaryGeneratedColumn()
  id: number

  /**
   * name 某个权限集合的名字
   */
  @Column()
  name: string

  @Column()
  desc: string

  /**
   * table 关联table的名字
   */
  @Column()
  table: string

  /**
   * get fields  string[]
   */
  @Column()
  get_fields: string

  /**
   * update fields  string[]
   */
  @Column()
  update_fields: string

  /**
   * add_right 0-不允许 1-允许
   */
  @Column()
  add_right: number

  /**
   * del_right 0-不允许 1-允许
   */
  @Column()
  del_right: number

  @Column()
  created_at: Date

  @Column()
  updated_at: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}