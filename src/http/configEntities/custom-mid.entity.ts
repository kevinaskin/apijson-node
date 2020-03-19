import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v2 custom-mid 自定义逻辑表
 */
@Entity('apijson_custom_mid')
export class ApiJsonCustomMidEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  desc: string

  /**
   * type req, res, ...
   */
  @Column()
  type: string

  @Column()
  function: string

  /**
   * checked 0-未审核 1-审核通过
   */
  @Column()
  checked: number

  @Column()
  created_at: Date

  @Column()
  updated_at: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}