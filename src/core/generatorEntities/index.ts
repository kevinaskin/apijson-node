// [
//   {
//     id: 1,
//     name: '3.26medicine',
//     key: 'medicine',
//     dev: '192.168.3.26>>>3305>>>medicine>>>root>>>realdoctor',
//     prod: '192.168.3.26>>>3305>>>medicine>>>root>>>realdoctor',
//   }
// ]

const makeImportSyntax = list => {
  return list.map(item => `import { ${item.filename}Entity, ${item.filename} } from './${item.filename}.entity'
`).join('')
}


export const genEntityIndex = (list) => {
  return `${makeImportSyntax(list)}

const config = {
${list.map(item => `  ${item.filename}`).join(`,
`)}
}

export {
  config,
${list.map(item => `  ${item.filename}Entity`).join(`,
`)}
}`
}