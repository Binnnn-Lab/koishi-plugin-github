import { Bot, Context, Logger } from 'koishi'
import { Config } from './config'
import { getMergedBindings } from './database'
import { buildPushMessage, buildStarMessage } from './message'
import { GitHubBaseEvent, GitHubPushEvent, GitHubStarEvent, NormalizedBinding, RelayEventName } from './types'
import { formatError } from './utils'

const logger = new Logger('github-qq-relay')

export function registerRelay(ctx: Context, config: Config) {
  ;(ctx.on as any)('github/star', async (event: GitHubStarEvent) => {
    await relayEvent(ctx, config, 'star', event, buildStarMessage(event))
  })

  ;(ctx.on as any)('github/push', async (event: GitHubPushEvent) => {
    await relayEvent(ctx, config, 'push', event, buildPushMessage(event, config))
  })
}

async function relayEvent(
  ctx: Context,
  config: Config,
  eventName: RelayEventName,
  event: GitHubBaseEvent,
  message: string,
) {
  const bindings = await getMergedBindings(ctx, config, event.repoKey)
  const matched = bindings.filter(binding => binding.enabled && binding.events.includes(eventName))

  if (!matched.length) {
    logger.debug('no bindings matched for %s (%s)', event.repoKey, eventName)
    return
  }

  const results = await Promise.allSettled(matched.map(async (binding) => {
    const bot = resolveTargetBot(ctx, binding, config)
    if (!bot) {
      throw new Error(`未找到 ${binding.platform} 平台的目标 Bot`)
    }

    if (binding.guildId) {
      await bot.sendMessage(binding.channelId, message, binding.guildId)
    } else {
      await bot.sendMessage(binding.channelId, message)
    }

    return binding
  }))

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const binding = matched[index]
      logger.warn(
        'failed to relay %s (%s) to %s:%s: %s',
        event.repoKey,
        eventName,
        binding.platform,
        binding.channelId,
        formatError(result.reason),
      )
    }
  })
}

function resolveTargetBot(ctx: Context, binding: NormalizedBinding, config: Config): Bot | null {
  const candidates = ctx.bots.filter(bot => bot.platform === binding.platform)
  if (!candidates.length) return null

  const targetBotId = binding.botId || config.defaultBotId
  if (!targetBotId) return candidates[0]

  return candidates.find(bot => bot.selfId === targetBotId) || null
}
