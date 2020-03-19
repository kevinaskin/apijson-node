// [
//   {
//     id: 1,
//     name: '3.26medicine',
//     key: 'medicine',
//     dev: '192.168.3.26>>>3305>>>medicine>>>root>>>realdoctor',
//     prod: '192.168.3.26>>>3305>>>medicine>>>root>>>realdoctor',
//   }
// ]

const genSqlConfigSlice = ({key, config}) => {
  const _config = config.split('>>>')

  return `
  TypeOrmModule.forRoot({
    name: '${key}',
    type: 'mysql',
    host: "${_config[0]}",
    port: ${_config[1]},
    username: "${_config[3]}",
    password: "${_config[4]}",
    database: "${_config[2]}",
    entities: [ \`\${ [ 'development' ].indexOf(process.env.NODE_ENV) > -1 ? 'src' : 'dist' }/**/**.entity{.ts,.js}\` ],
    synchronize: false
  })`
}

export const genDbConfigTpl = (dbList) => {
  return `
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
    entities: [ \`\${ [ 'development' ].indexOf(process.env.NODE_ENV) > -1 ? 'src' : 'dist' }/**/**.entity{.ts,.js}\` ],
    synchronize: false
  }),
  ${dbList.map(db => genSqlConfigSlice(db))}
]
`
}