import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * v1 config table
 */
@Entity('config')
export class ApiJsonConfigEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  appSign: string

  @Column()
  authType: string

  @Column()
  tableRight: string

  @Column()
  createdAt: Date

  @Column()
  updatedAt: Date

  @Column()
  operator: string
}