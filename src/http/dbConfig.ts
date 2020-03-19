
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  ApiJsonConfigEntity,
  ApiJsonUserEntity,
  ApiJsonAppConfigEntity,
  ApiJsonCustomMidEntity,
  ApiJsonRoleAliasEntity,
  ApiJsonRoleConfigEntity,
  ApiJsonTableRightEntity,
  ApiJsonTableConfigEntity,
  ApiJsonDBConfigEntity,
} from './configEntities'
import { resolve } from 'path'

export const dbConfig = [
  TypeOrmModule.forRoot({
    name: 'apijsonDB',
    type: 'sqlite',
    database: resolve(__dirname, '../../ConfigDatabase.db'),
    entities: [
      ApiJsonUserEntity, ApiJsonConfigEntity,

      ApiJsonAppConfigEntity, ApiJsonCustomMidEntity, ApiJsonRoleAliasEntity, 
      ApiJsonRoleConfigEntity, ApiJsonTableRightEntity, 
      ApiJsonTableConfigEntity,ApiJsonDBConfigEntity
    ],
    synchronize: false
  }),
  
  TypeOrmModule.forRoot({
    name: 'default',
    type: 'mysql',
    host: "localhost", // 配置 host
    port: 3306, // 配置 port
    username: "", // 配置 username
    password: "", // 配置 password
    database: "", // 配置数据库名
    entities: [ `${ [ 'development' ].indexOf(process.env.NODE_ENV) > -1 ? 'src' : 'dist' }/**/**.entity{.ts,.js}` ],
    synchronize: false
  })
]
