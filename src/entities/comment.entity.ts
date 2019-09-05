import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('comment')
export class CommentEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  comment: string

  @Column()
  userId: number
}

export const Comment = {
  column: [{
    key: 'id',
    desc: 'ID'
  }, {
    key: 'comment',
    desc: '评论'
  }, {
    key: 'userId',
    desc: '关联的用户Id'
  }],
  primary: 'id',
  desc: '评论表'
}