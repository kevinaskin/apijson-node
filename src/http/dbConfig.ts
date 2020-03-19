
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
    type: 'sqlite',
    database: resolve(__dirname, '../../Test.db'),
    entities: [ `${ [ 'development' ].indexOf(process.env.NODE_ENV) > -1 ? 'src' : 'dist' }/**/**.entity{.ts,.js}` ],
    synchronize: false
  })
]
