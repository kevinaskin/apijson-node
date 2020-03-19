import { readdirSync } from "fs"
import { resolve } from "path"

const CREATE_SQL_REG = /^CREATE TABLE([^\(]+)\(([^\;]+)\)([\s\S]+)\;$/
const NORMAL_TABLE_REG = /^[^\`]*\`(\w+)\`[^\`]+$/
const NORMAL_COLUMN_REG = /^\`(\w+)\`\W+(([\w\(\)])+)(.*)$/
const COMMENT_REG = /COMMENT[^\']*\'([^\']*)\'/

interface genEntityReturn {
  structure: any,
  tpl: string,
  entityName: string,
  primary: string,
  isEntityNameDuplicated: boolean
}

export function genEntityFromColumns(
  columns,
  options = {uuid: '', uniqueKey: '', db: '', dbNick: '', dbTable: '', dbReal: ''}
): genEntityReturn {
  const primaryCol = columns.find(col => col.isPrimary === true)
  const resObj = {
    column: columns,
    primary: primaryCol.key,
    uuid: options.uuid,
    uniqueKey: options.uniqueKey,
    db: options.db,
    desc: options.dbNick
  }
  // 废弃
  // let objName = normalTableName.replace(/\_(\w)/g, function(_, letter){
  //   return letter.toUpperCase()
  // }).replace(/^(\w)/, function(_, letter) {
  //   return letter.toUpperCase()
  // })
  const isEntityNameDuplicated = checkIsDuplicatedEntity(options.dbTable)
  if (isEntityNameDuplicated) {
    console.log(`[Duplicated] Entity name is supposed to be rename.`)
  }

  const tpl = `import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('${options.dbReal}')
export class ${options.dbTable}Entity {
  @PrimaryGeneratedColumn()
  ${resObj.primary}: ${primaryCol.type}`
  + '\n' + columns.filter(item => {
    return item.key !== resObj.primary
  }).map(item => {
    return `
  @Column()
  ${item.key}: ${item.type}`
  }).join('\n')
  + `
}

export const ${options.dbTable} = ${JSON.stringify(resObj, null, 2)}
`

  return {
    structure: resObj,
    tpl,
    entityName: options.dbTable,
    isEntityNameDuplicated,
    primary: primaryCol.key,
  }
}

export function genEntity(
  SQLString,
  options = {uuid: '', uniqueKey: '', db: '', dbNick: '', dbTable: ''}
): genEntityReturn {
  SQLString = SQLString.replace(/\;/g, '') + ';'
  if (!CREATE_SQL_REG.test(SQLString)) {
    throw new Error(`不合法的SQL输入(目前仅支持Pretty格式化之后的SQL语句)`)
  }
  const [, table, columns, tableComment] = CREATE_SQL_REG.exec(SQLString)
  if (!table || !columns) {
    throw new Error(`INVALID.SQL string input is not valid at CREATE_SQL_REG`)
  }
  let tableDesc = COMMENT_REG.exec(tableComment)[1]
  if (!tableDesc) {
    throw new Error(`Table name desc is not found`)
  }
  const [, normalTableName] = NORMAL_TABLE_REG.exec(table)
  if (!normalTableName) {
    throw new Error(`INVALID.SQL string input is not valid at NORMAL_TABLE_REG`)
  }
  const lineList = columns.split(/\n/)
    .map(line => line.replace(/\,$/, ''))
    .map(line => line.trim())
    .map(normalLine => {
      if (NORMAL_COLUMN_REG.test(normalLine)) {
        const [, columnName, columnType,, comment] = NORMAL_COLUMN_REG.exec(normalLine)
        let columnComment = ''
        if (comment.indexOf('COMMENT') > -1) {
          const execComment = COMMENT_REG.exec(comment)
          columnComment = execComment && execComment[1] || ''
        }
        return {
          columnName,
          columnType,
          columnComment
        }
      } else {
        
        if (normalLine.indexOf('PRIMARY KEY') > -1) {
          const [, primaryKey] = /[^\`]*`(\w+)\`[^\`]*/.exec(normalLine)
          return {
            columnName: primaryKey,
            primary: true
          }
        } else {
          return undefined
        }
      }
    }).filter(item => !!item)
  const column = []
  let primary = ''
  lineList.forEach(item => {
    if (item.columnType && item.columnName) {
      column.push({
        key: item.columnName,
        desc: item.columnComment || ''
      })
    } else if (item.primary && item.columnName) {
      primary = item.columnName
    }
  })
  const resObj = {
    column,
    primary,
    uuid: options.uuid,
    uniqueKey: options.uniqueKey,
    db: options.db,
    desc: options.dbNick
  }
  // 废弃
  // let objName = normalTableName.replace(/\_(\w)/g, function(_, letter){
  //   return letter.toUpperCase()
  // }).replace(/^(\w)/, function(_, letter) {
  //   return letter.toUpperCase()
  // })
  const isEntityNameDuplicated = checkIsDuplicatedEntity(options.dbTable)
  if (isEntityNameDuplicated) {
    console.log(`[Duplicated] Entity name is supposed to be rename.`)
  }

  const findTypeByColumnName = name => {
    const target = lineList.find(item => item.columnName === name)
    const type = target && target.columnType.toUpperCase()
    const numberReg = /(TINYINT)|(SMALLINT)|(MEDIUMINT)|(INT)|(INTEGER)|(BIGINT)|(FLOAT)|(DOUBLE)|(DECIMAL)/
    const dateReg = /(DATE)|(TIME)|(YEAR)|(DATETIME)|(TIMESTAMP)/
    const stringReg = /(CHAR)|(VARCHAR)|(TINYBLOB)|(TINYTEXT)|(BLOB)|(TEXT)|(MEDIUMBLOB)|(MEDIUMTEXT)|(LONGBLOB)|(LONGTEXT)/
    if (numberReg.test(type)) {
      return 'number'
    } else if (dateReg.test(type)) {
      return 'Date'
    } else if (stringReg.test(type)) {
      return 'string'
    } else {
      // console.log(type, target, name, resObj)
      // throw new Error(`findTypeByColumnName at "${name}" fail`)
    }
  }
  const tpl = `import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('${normalTableName}')
export class ${options.dbTable}Entity {
  @PrimaryGeneratedColumn()
  ${resObj.primary}: ${findTypeByColumnName(resObj.primary)}`
  + '\n' + lineList.filter(item => {
    return !item.primary && item.columnName !== resObj.primary
  }).map(item => {
    return `
  @Column()
  ${item.columnName}: ${findTypeByColumnName(item.columnName)}`
  }).join('\n')
  + `
}

export const ${options.dbTable} = ${JSON.stringify(resObj, null, 2)}
`

  return {
    structure: resObj,
    tpl,
    entityName: options.dbTable,
    isEntityNameDuplicated,
    primary
  }
}

function checkIsDuplicatedEntity(name) {
  const fileList = readdirSync(resolve(__dirname, '../entities'))
    .map(name => {
      return name.indexOf('.entity.ts') > -1
        ? name.replace(/\.entity\.ts$/, '')
        : ''
    })
    .filter(str => !!str)
    .map(name => {
      return name.replace(/^(\w)/, function(_, letter) {
        return letter.toUpperCase()
      })
    })
  return fileList.indexOf(name) > -1
}