interface TableStructure {
  name: string
  desc: string
  fields: FieldStructure[]
}

interface FieldStructure {
  fieldName: string
  type: number | Date | string | boolean
  desc: string
  length?: number
  required?: boolean
  autoIncrement?: boolean
}

interface SQLParserOptions {
  primary?: string
  uniqueKey?: string
  // if `uuid` equals `uniqueKey`
  // primary is a never-return field
  // instead, `uuid` is return for column updating or getting
  uuid?: string
}

// let inputString = `CREATE TABLE \`screen_map_data\` (
//   \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键id',
//   \`city_name\` varchar(20) DEFAULT NULL COMMENT '城市名称',
//   \`hospital_name\` varchar(32) DEFAULT NULL COMMENT '落地医院名称',
//   \`gmt_created\` datetime NOT NULL COMMENT '创建时间',
//   \`gmt_modified\` datetime NOT NULL COMMENT '修改时间',
//   PRIMARY KEY (\`id\`)
// ) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8 COMMENT='AI大屏-地图信息表';`

export function createSQLParser (
  sqlString: string,
  options: SQLParserOptions = {},
  type: 'mysql' | 'sqlite' = 'mysql'
): TableStructure | undefined {

  return undefined
}