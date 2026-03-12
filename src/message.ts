import { Config } from './config'
import { GitHubPushEvent, GitHubStarEvent } from './types'
import { buildCompareUrl, firstLine, simplifyRef } from './utils'

export function buildStarMessage(event: GitHubStarEvent) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const action = event.action === 'deleted' ? '取消了 Star' : '点亮了 Star'

  return [
    `[GitHub Star] ${actor} ${action}`,
    `仓库：${event.repoKey}`,
    `链接：https://github.com/${event.repoKey}`,
  ].join('\n')
}

export function buildPushMessage(event: GitHubPushEvent, config: Config) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const branch = simplifyRef(event.ref)
  const commits = (event.commits || []).slice(0, config.maxPushCommits)
  const total = event.commits?.length || 0

  const lines = [
    `[GitHub Push] ${actor} 推送了 ${total} 个提交`,
    `仓库：${event.repoKey}`,
    `分支：${branch}`,
  ]

  if (commits.length) {
    lines.push('提交：')
    for (const commit of commits) {
      const sha = (commit.id || commit.sha || '').slice(0, 7) || 'unknown'
      const title = firstLine(commit.message) || '(no message)'
      lines.push(`- ${sha} ${title}`)
    }
  }

  if (total > commits.length) {
    lines.push(`- 其余 ${total - commits.length} 个提交已省略`)
  }

  const compareUrl = buildCompareUrl(event.repoKey, event.before, event.after)
  if (compareUrl) lines.push(`对比：${compareUrl}`)

  return lines.join('\n')
}
