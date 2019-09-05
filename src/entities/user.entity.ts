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
  column: [{
    key: 'id',
    desc: 'ID'
  }, {
    key: 'user',
    desc: '用户名'
  }, {
    key: 'nickname',
    desc: '昵称'
  }, {
    key: 'role',
    desc: '角色'
  }],
  primary: ['id'],
  desc: '用户表'
}
