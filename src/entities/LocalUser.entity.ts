import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('user')
export class LocalUserEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  user: string

  @Column()
  nickname: string

  @Column()
  role: string
}

export const LocalUser = {
  "column": [
    {
      "desc": "",
      "key": "id",
      "type": "number",
      "isPrimary": true
    },
    {
      "desc": "",
      "key": "user",
      "type": "string",
      "isPrimary": false
    },
    {
      "desc": "",
      "key": "nickname",
      "type": "string",
      "isPrimary": false
    },
    {
      "desc": "",
      "key": "role",
      "type": "string",
      "isPrimary": false
    }
  ],
  "primary": "id",
  "uuid": "",
  "uniqueKey": "id",
  "db": "default",
  "desc": "用户表"
}
