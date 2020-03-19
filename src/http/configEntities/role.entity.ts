import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('roles')
export class ApiJsonRoleAliasEntity {
  @PrimaryGeneratedColumn()
  id: number

  /**
   * "single" | "multiple"
   */
  @Column()
  role_type: string

  @Column()
  get_fields: string

  @Column()
  update_fields: string

  @Column()
  status: number

  @Column()
  createdAt: Date

  @Column()
  updatedAt: Date

  @Column()
  operator: string

  @Column()
  is_deleted: number
}