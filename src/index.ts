import { Context, Logger } from 'koishi'
import { Config } from './config'
import { registerCommands } from './commands'
import { extendDatabase } from './database'
import { registerRelay } from './relay'

export const name = 'github-qq-relay'
export const inject = ['database'] as const

export { Config }

const logger = new Logger(name)

export function apply(ctx: Context, config: Config) {
  extendDatabase(ctx)
  registerCommands(ctx, config)
  registerRelay(ctx, config)

  logger.info('github-qq-relay loaded')
  logger.info('event source: koishi-plugin-adapter-github')
}
