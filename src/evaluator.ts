import { BinaryOperation, ConstStatement, Expression, FunctionCall, JustNumber, LetStatement, Statement, UnaryOperation, Variable } from "./ast"
import Parser from "./parser"
import { ShortError, extractMessage, zipped } from "./utils"

type TypedContainer<T> = {[key: string]: T}

type BinaryOperator = (a: number, b: number) => number
const BinaryOperators: TypedContainer<BinaryOperator> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '^': (a, b) => a ** b
}

type UnaryOperator = (a: number) => number
const UnaryOperators: TypedContainer<UnaryOperator> = {
  '-': a => -a
}

type Scope = TypedContainer<number>
class VariableManager {
  private scopes: Array<Scope> = [{ }]

  enterScope(scope: Scope) {
    this.scopes.push(scope)
  }

  leaveScope() {
    if(this.scopes.length < 2) {
      throw new Error('failed to leave scope')
    }
    this.scopes.pop()
  }

  get(variable: string) {
    for(let i = this.scopes.length - 1; i >= 0; i--) {
      const current = this.scopes[i]
      if(current[variable]) {
        return current[variable]
      }
    }
    throw new Error(`undefined ${variable}!`)
  }

  setConstant(constname: string, value: number) {
    this.scopes[0][constname] = value
  }
}

type BuiltinFunc = (...args: number[]) => number

type UserFunc = Array<UserFuncCase>
interface UserFuncCase {
  fcase: Array<number | string>,
  clause: Expression
}

export default class Evaluator {
  private nth = 1
  private scope = new VariableManager()
  private userfuncs: TypedContainer<UserFunc> = {}
  private funcache: TypedContainer<number> = {}

  constructor( 
    private readonly builtinFuncs: TypedContainer<BuiltinFunc>,
    defaultConstants?: TypedContainer<number>
  ){
    if(defaultConstants !== undefined) {
      for(const [key, val] of Object.entries(defaultConstants)) {
        this.scope.setConstant(key, val)
      }
    }
  }

  private cached(key: string, value: number) {
    this.funcache[key] = value
    return value
  }

  private evaluateLetStatement({funcname, params, body}: LetStatement) {
    if(!this.userfuncs[funcname]) this.userfuncs[funcname] = []

    const fcase = params.map(param => {
      if(param.ntype === 'variable') return param.varname
      return this.evaluateExpression(param)
    })

    this.userfuncs[funcname].push({
      fcase, clause: body
    })

    return `<func ${funcname}(${fcase.map(String).join(', ')}) = ...>`
  }

  private evaluateConstStatement(statement: ConstStatement) {
    const {constname, value: expr} = statement
    const value = this.evaluateExpression(expr)
    this.scope.setConstant(constname, value)
    return `<const ${constname} = ${value}>`
  }

  private evaluateBinaryOperation(expression: BinaryOperation): number {
    const left = this.evaluateExpression(expression.left)
    const right = this.evaluateExpression(expression.right)
    const operator = BinaryOperators[expression.operator]
    return operator(left, right)
  }

  private evaluateUnaryOperation(expression: UnaryOperation): number {
    const { expr, operator } = expression
    const val = this.evaluateExpression(expr)
    const op = UnaryOperators[operator]
    return op(val)
  }

  private callUserfunc(funcname: string, args: number[]): number {
    const fcases = this.userfuncs[funcname]

    for(const {fcase, clause} of fcases) {
      if(fcase.length !== args.length) continue

      const funcscope: Scope = {}
      let matched = true

      for(const [val, matching] of zipped(args, fcase)) {
        if(typeof matching === 'number') {
          if(val !== matching) {
            matched = false
            break
          }
        } else {
          funcscope[matching] = val
        }
      }

      if(!matched) continue

      this.scope.enterScope(funcscope)
      const result = this.evaluateExpression(clause)
      this.scope.leaveScope()
      return result
    }

    const strfunc = `${funcname}(${args.map(String).join(', ')})`

    throw new ShortError(`
      no matching clause was found
      for function call ${strfunc}
    `)
  }

  private callFunction({funcname, args}: FunctionCall): number {
    const valargs = args.map(arg => this.evaluateExpression(arg))

    const cachekey = `${funcname}(${valargs.map(String).join(',')})`
    if(this.funcache[cachekey]) return this.funcache[cachekey]

    if(this.builtinFuncs[funcname]) {
      const func = this.builtinFuncs[funcname]
      if(func.length !== valargs.length) {
        throw new ShortError(`
          builtin function ${funcname}
          expected ${func.length} number of arguments,
          but got ${valargs.length}
        `)
      }
      return this.cached(cachekey, func(...valargs))
    }

    if(this.userfuncs[funcname]) {
      const result = this.callUserfunc(funcname, valargs)
      return this.cached(cachekey, result)
    }

    throw new Error(`undefined function ${funcname}!`)
  }

  private evaluateExpression(expression: Expression): number {
    switch(expression.ntype) {
      case 'just-number': return expression.value
      case 'variable': return this.scope.get(expression.varname)
      case 'binary-operation': return this.evaluateBinaryOperation(expression)
      case 'unary-operation': return this.evaluateUnaryOperation(expression)
      case 'functional-call': return this.callFunction(expression)
    }
  }

  private evaluateStatement(statement: Statement | null) {
    if(statement === null) return '<empty>'
    switch(statement.ntype) {
      case 'let-statement': return this.evaluateLetStatement(statement)
      case 'const-statement': return this.evaluateConstStatement(statement)
      default: return this.evaluateExpression(statement)
    }
  }

  feedSingleStatement(statement: string) {
    try {

      const ast = new Parser(statement).parseSingleStatement()
      const result = this.evaluateStatement(ast)
      return result

    } catch(error: unknown) {
      const msg = extractMessage(error)
      throw new Error(`(Statement ${this.nth}) ${msg}`)
    } finally {
      this.nth++
    }
  }
}

export function DefaultEvaluator() {

  return new Evaluator({
    'rand': () => Math.random(),
    'randint': (min, max) => {
      return min + Math.floor(Math.random() * (max - min))
    },

    'min': (a, b) => Math.min(a, b),
    'max': (a, b) => Math.max(a, b),

    'ln': a => Math.log(a),
    'lg': a => Math.log10(a),
    
    'round': a => Math.round(a),
    'floor': a => Math.floor(a),
    'ceil': a => Math.ceil(a),
    'trunc': a => Math.trunc(a),

    'sin': a => Math.sin(a),
    'cos': a => Math.cos(a),
    'tg': a => Math.tan(a),

    'deg': a => a * Math.PI / 180
  }, {
    'E': Math.E,
    'PI': Math.PI
  })

}
