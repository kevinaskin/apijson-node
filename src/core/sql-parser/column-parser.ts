/**
 *  将如 field、SUM(field)、SEC_TO_TIME(TIME_TO_SEC(field))、 field as name 此类的sql查询字段，解析出field
 *
 *  @author wupeng1@guahao.com
 */

enum status {
  init = 'init',
  identifier = 'identifier',
  callExpression = 'callExpression',
  end = 'end',
}

enum keywords {
  as = 'keyword_as',
  order = 'keyword_order',
  by = 'keyword_by',
  desc = 'keyword_desc',
  asc = 'keyword_asc',
}

const context = {
  '(': 'context_left',
  ')': 'context_right',
};

class ColumnSQLParser {
  static parse (source: string): {
    list: any[],
    ast: any,
  } {
    let index = 0;
    const list = [];
    let partNumber = 0;
    while (true) {
      const token = ColumnSQLParser.getToken(source, index);
      if (token.type === status.end) {
        break;
      }
      if (token.type === context['(']) {
        partNumber++;
      } else if (token.type === context[')']) {
        partNumber--;
      }
      const type = keywords[token.value.toLowerCase()];
      if (type) {
        token.type = type;
      }
      list.push(token);
      index = token.index + 1;
    }
    if (partNumber !== 0) {
      if (partNumber > 0) {
        throw 'SyntaxError: Unexpected token )';
      } else {
        throw 'SyntaxError: Unexpected token (';
      }
    }
    const ast = ColumnSQLParser.formatAst(list);
    return {
      list,
      ast,
    };
  }

  static formatAst (list: any[], isArg?: boolean): any {
    let tree: any = {};
    for (let i = 0, size = list.length; i < size; i++) {
      const token = list[i];
      if (token.type === status.identifier) {
        if (tree.type) {
          throw 'error 0x01';
        }
        tree = token;
      } else if (token.type === context['(']) {
        if (i > 0) {
          tree.type = status.callExpression;
        }
        const result = ColumnSQLParser.formatAst(list.slice(i + 1), true);
        tree.argument = result.token;
        i = result.i + i + 1;
      } else if (token.type === context[')']) {
        tree = {
          i,
          token: tree,
        };
        break;
      } else if (token.type === keywords.as) {
        const nextToken = list[i + 1];
        if (nextToken && nextToken.type === status.identifier) {
          const next2Token = list[i + 2];
          if (next2Token) {
            throw 'error 0x02';
          }
          tree.alias = nextToken;
          i++;
        } else {
          throw 'error 0x03';
        }
      } else if (token.type === keywords.order) {
        if (isArg) {
          const nextToken = list[i + 1];
          if (nextToken && nextToken.type === keywords.by) {
            const next2Token = list[i + 2];
            if (next2Token && next2Token.type === status.identifier) {
              tree.orderBy = next2Token;
              i += 2;
            } else {
              throw 'error 0x05';
            }
          } else {
            throw 'error 0x06';
          }
        } else {
          throw 'error 0x07';
        }
      }
    }
    return tree;
  }

  static getToken (source: string, index: number): any {
    let type = status.init;
    let token = '';
    while (true) {
      const value = source[index];
      if (type === status.init) {
        if (value === undefined) {
          return {
            type: status.end,
          };
        } else if (context[value]) {
          return {
            type: context[value],
            value,
            index,
          };
        } else if (/^\w$/.test(value)) {
          type = status.identifier;
          token += value;
          index++;
          continue;
        } else if (value === ' ') {
          index++;
          continue;
        } else {
          throw `SyntaxError: Unexpected identifierat '${ value } at ${ index }'`;
        }
      }
      if (type === status.identifier) {
        if (value === undefined) {
          return {
            type,
            value: token,
            index: index - 1,
          };
        } else if (context[value]) {
          return {
            type,
            value: token,
            index: index - 1,
          };
        } else if (value === ' ') {
          return {
            type,
            value: token,
            index: index - 1,
          };
        } else if (/^\w$/.test(value)) {
          token += value;
          index++;
        } else {
          throw `SyntaxError: Unexpected identifierat '${ value } at ${ index }'`;
        }
      }
    }
  }

  static getField (ast: any): string {
    let field;
    if (ast) {
      switch (ast.type) {
        case status.identifier:
          field = ast.value;
          break;
        case status.callExpression:
          field = ColumnSQLParser.getField(ast.argument);
          break;
        default:
          field = null;
      }
    } else {
      field = null;
    }
    return field;

  }
}

const getField = (source: string): string => {
  let result;
  try {
    const { ast } = ColumnSQLParser.parse(source);
    result = ColumnSQLParser.getField(ast);
  } catch (e) {
    console.error(`${ source } 解析错误！`);
    result = null;
  }
  return result;
};

export {
  ColumnSQLParser,
  getField,
}
