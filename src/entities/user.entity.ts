import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  user: string

  @Column()
  nickname: string

  @Column()
  role: string
}

export const User = {
  column: ['id', 'user', 'nickname', 'role']
}
