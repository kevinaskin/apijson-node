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
  column: ['id', 'comment', 'userId']
}