export type TokenType = 
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'keyword'
  | 'word'
  | 'invalid'
  | 'eof'

export interface Token {
  ttype: TokenType
  tvalue: string
}

const Reserved = Object.freeze({
  operators: ['+', '-', '*', '/', '^'],
  punctuation: ['=', '(', ')', ','],
  keywords: ['let', 'const']
})

const EOF: Token = {
  ttype: 'eof',
  tvalue: ''
}

class Buffer {
  private pointer = 0

  constructor(
    private readonly source: string
  ) {}

  get current() {
    return this.source[this.pointer]
  }

  next() {
    return this.source[this.pointer++]
  }

  get finished() {
    return !this.current
  }
}

const Predicates = Object.freeze({
  isWhitespace: (char: string) => /\s/.test(char),
  isDigit:      (char: string) => /\d/.test(char),
  isLetter:     (char: string) => /[_a-zA-Z]/.test(char),
  isAlphanum:   (char: string) => /[_a-zA-Z0-9]/.test(char)
})

class Lexer {
  private buf: Buffer

  constructor(source: string) {
    this.buf = new Buffer(source)
  }

  private readWhile(predicate: (char: string) => boolean) {
    let output = ''
    while(!this.buf.finished && predicate(this.buf.current)) {
      output += this.buf.next()
    }
    return output
  }

  private makeSingle(ttype: TokenType): Token {
    return {
      ttype, tvalue: this.buf.next()
    }
  }

  private makeInvalid(): Token {
    return {
      ttype: 'invalid',
      tvalue: this.buf.next()
    }
  }

  private readNumber(): Token {
    let num = this.readWhile(Predicates.isDigit)
    if(this.buf.current == '.') {
      num += this.buf.next()
      num += this.readWhile(Predicates.isDigit)
    }
    return {
      ttype: 'number',
      tvalue: num
    }
  }

  private readWord(): Token {
    const word = this.readWhile(Predicates.isAlphanum)
    const ttype: TokenType = Reserved.keywords.includes(word)
      ? 'keyword'
      : 'word'
    return {
      ttype, tvalue: word
    }
  }

  readToken(): Token {
    this.readWhile(Predicates.isWhitespace)
    if(this.buf.finished) return EOF

    const cur = this.buf.current
    switch(true) {
      case Reserved.operators.includes(cur):
        return this.makeSingle('operator')
      case Reserved.punctuation.includes(cur):
        return this.makeSingle('punctuation')
      case Predicates.isDigit(cur):
        return this.readNumber()
      case Predicates.isLetter(cur):
        return this.readWord()
      default:
        return this.makeInvalid()
    }
  }
}

export function readAllTokens(source: string) {
  const lexer = new Lexer(source)
  let token: Token, tokens: Token[] = []
  while((token = lexer.readToken()).ttype !== 'eof') {
    tokens.push(token)
  }
  return tokens
}

export class TokenBuffer {
  private lex: Lexer
  private _current: Token | null = null

  constructor(source: string) {
    this.lex = new Lexer(source)
  }

  get current() {
    return this._current ?? 
      (this._current = this.lex.readToken())
  }

  next() {
    const cur = this.current
    this._current = this.lex.readToken()
    return cur
  }
}