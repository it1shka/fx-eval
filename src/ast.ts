export type Statement = 
  | LetStatement
  | ConstStatement
  | Expression

export interface LetStatement {
  ntype: 'let-statement',
  funcname: string
  params: Expression[]
  body: Expression
}

export interface ConstStatement {
  ntype: 'const-statement'
  constname: string
  value: Expression
}

// EXPRESSION

export type Expression = 
  | BinaryOperation
  | UnaryOperation
  | FunctionCall
  | Variable
  | JustNumber

export interface BinaryOperation {
  ntype: 'binary-operation'
  operator: string
  left: Expression
  right: Expression
}

export interface UnaryOperation {
  ntype: 'unary-operation'
  operator: string
  expr: Expression
}

export interface FunctionCall {
  ntype: 'functional-call'
  funcname: string
  args: Expression[]
}

export interface Variable {
  ntype: 'variable'
  varname: string
}

export interface JustNumber {
  ntype: 'just-number'
  value: number
}
