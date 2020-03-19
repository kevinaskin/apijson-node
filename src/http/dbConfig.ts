
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
      ApiJsonUserEntity, ApiJsonConfigEntity, // v1

      ApiJsonAppConfigEntity, ApiJsonCustomMidEntity, ApiJsonRoleAliasEntity, 
      ApiJsonRoleConfigEntity, ApiJsonTableRightEntity, 
      ApiJsonTableConfigEntity,ApiJsonDBConfigEntity // v2
    ],
    synchronize: false
  }),
  
  TypeOrmModule.forRoot({
    name: 'default',
    type: 'mysql',
    host: "localhost",
    port: 3306,
    username: "root",
    password: "Onekevin30",
    database: "apijson",
    entities: [ `${ [ 'development' ].indexOf(process.env.NODE_ENV) > -1 ? 'src' : 'dist' }/**/**.entity{.ts,.js}` ],
    synchronize: false
  })
]
