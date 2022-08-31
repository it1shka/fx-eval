export class ShortError extends Error {
  constructor(message: string) {
    const beautifulMessage = 
      message.split('\n')
        .map(line => line.trim())
        .filter(line => !!line)
        .join(' ')
    super(beautifulMessage)
    Object.setPrototypeOf(this, ShortError.prototype)
  }
}

export function extractMessage(error: unknown) {
  if(typeof error === 'string') return error
  if(error instanceof Error) {
    // return `${error.name}: ${error.message}`
    return error.message
  }
  return 'Unknown error'
}

export function zipped<A, B>(first: A[], second: B[]) {
  const output: Array<[A, B]> = []
  for(let i = 0; i < first.length; i++) {
    output.push([first[i], second[i]])
  }
  return output
}