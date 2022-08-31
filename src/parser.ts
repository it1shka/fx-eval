import { ConstStatement, Expression, LetStatement, Statement } from "./ast";
import { TokenBuffer, TokenType } from "./lexer";
import { ShortError } from './utils'

type ExprParser = () => Expression
type PriorityParser = (operators: string[], next: ExprParser) => Expression
type ParsingRule = [PriorityParser, string[]]

export default class Parser {
  private buf: TokenBuffer

  constructor(source: string) {
    this.buf = new TokenBuffer(source)
  }

  // helper functions
  private expect = (tvalue: string) => {
    const curValue = this.buf.next().tvalue
    if(curValue !== tvalue) {
      throw new ShortError(`expected "${tvalue}", found "${curValue}"`)
    }
  }

  private nextOfType = (ttype: TokenType) => {
    const current = this.buf.next()
    if(current.ttype !== ttype) {
      throw new ShortError(`
        expected token of type <${ttype}>, 
        found "${current.tvalue}" 
        of type <${current.ttype}>
      `)
    }
    return current
  }

  private nextIs = (tvalue: string) => {
    if(this.buf.current.tvalue === tvalue) {
      this.buf.next()
      return true
    }
    return false
  }

  private compileExpessionParser = (rules: ParsingRule[]): ExprParser => {
    return rules.reduceRight( (prevparser, [ parser, operators ]) => {
      return () => parser(operators, prevparser)
    }, this.parsePrimary)
  }

  // sub parsers
  private parseFunctionParameters = (): Expression[] => {
    this.expect('(')
    if(this.nextIs(')')) return []

    const parameters = []
    while(true) {
      const param = this.parseExpression()
      parameters.push(param)
      if(!this.nextIs(',')) break
    }
    this.expect(')')
    return parameters
  }

  private parseBinaryLeft = (ops: string[], next: ExprParser): Expression => {
    let expr = next()
    while(ops.includes(this.buf.current.tvalue)) {
      const operator = this.buf.next().tvalue
      const right = next()
      expr = {
        ntype: 'binary-operation',
        operator, left: expr, right
      }
    }
    return expr
  }

  private parseBinaryRight = (ops: string[], next: ExprParser): Expression => {
    const expr = next()
    if(ops.includes(this.buf.current.tvalue)) {
      return {
        ntype: 'binary-operation',
        operator: this.buf.next().tvalue,
        left: expr,
        right: this.parseBinaryRight(ops, next)
      }
    }
    return expr
  }

  private parseUnary = (ops: string[], next: ExprParser): Expression => {
    if(ops.includes(this.buf.current.tvalue)) {
      return {
        ntype: 'unary-operation',
        operator: this.buf.next().tvalue,
        expr: this.parseUnary(ops, next)
      }
    }
    return next()
  }

  private parsePrimary = (): Expression => {
    if(this.buf.current.ttype === 'number') {
      return {
        ntype: 'just-number',
        value: Number(this.buf.next().tvalue)
      }
    }

    if(this.buf.current.ttype === 'word') {
      const name = this.nextOfType('word').tvalue
      if(this.buf.current.tvalue === '(') {
        const args = this.parseFunctionParameters()
        return {
          ntype: 'functional-call',
          funcname: name,
          args
        }
      }

      return {
        ntype: 'variable',
        varname: name
      }
    }

    if(this.nextIs('(')) {
      const expr = this.parseExpression()
      this.expect(')')
      return expr
    }

    const {tvalue, ttype} = this.buf.next()
    throw new ShortError(`
      expected <just-number>, <word> or "(", 
      found "${tvalue}" of type <${ttype}>
    `)
  }

  // main three parsing functions
  private parseLetStatement = (): LetStatement => {
    this.expect('let')
    const funcname = this.nextOfType('word').tvalue
    const params = this.parseFunctionParameters()
    this.expect('=')
    const body = this.parseExpression()
    return {
      ntype: 'let-statement',
      funcname, params, body
    }
  }

  private parseConstStatement = (): ConstStatement => {
    this.expect('const')
    const constname = this.nextOfType('word').tvalue
    this.expect('=')
    const value = this.parseExpression()
    return {
      ntype: 'const-statement',
      constname, value
    }
  }

  private parseExpression: ExprParser = this.compileExpessionParser([
    [this.parseBinaryLeft,  ['+', '-']],
    [this.parseBinaryLeft,  ['*', '/']],
    [this.parseBinaryRight, ['^']],
    [this.parseUnary,       ['-']]
  ])

  private parseStatement = (): Statement => {
      switch(this.buf.current.tvalue) {
      case 'let': return this.parseLetStatement()
      case 'const': return this.parseConstStatement()
      default: return this.parseExpression()
    }
  }

  // public interface
  parseSingleStatement = (): Statement | null => {
    if(this.buf.current.ttype === 'eof') return null
    const statement = this.parseStatement()

    if(this.buf.current.ttype as TokenType !== 'eof') {
      const {ttype, tvalue} = this.buf.next()
      throw new ShortError(`
        unexpected token "${tvalue}" 
        of type <${ttype}> 
        at the end of the statement
      `)
    }

    return statement
  }
}