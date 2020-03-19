import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('user')
export class ApiJsonUserEntity {
  @PrimaryGeneratedColumn()
  id: number = 0

  @Column({length: 20})
  username: string = ''

  @Column()
  role: string = 'user'

  @Column()
  realName: string

  @Column()
  password: string

  @Column()
  createdAt: Date

  @Column()
  updatedAt: Date

  @Column()
  isDeleted: number = 0
}