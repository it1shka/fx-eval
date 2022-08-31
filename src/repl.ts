import { stdin, stdout } from 'process'
import * as chalk from 'chalk'
import * as readline from 'readline'
import { DefaultEvaluator } from './evaluator'

const rl = readline.createInterface({
  input: stdin, output: stdout
})

function askInput(message: string) {
  return new Promise<string>(resolve => {
    rl.question(message, resolve)
  })
}

export async function launchRepl() {
  const evaluator = DefaultEvaluator()

  while(true) {
    try {
      const userInput = await askInput('> ')
      const result = evaluator.feedSingleStatement(userInput)
      const color = typeof result === 'number'
        ? chalk.yellow
        : chalk.blueBright
      console.log(color(result))
    } catch(error) {
      console.log(chalk.red(error))
    }
  }
}
