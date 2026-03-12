# koishi-plugin-github-qq-relay

把 `koishi-plugin-adapter-github` 接收到的 GitHub 事件，转发到指定 QQ 群。

当前版本严格基于 `adapter-github` 已公开文档和源码里实际派发的事件来实现，重点支持：

- `github/star`
- `github/push`

数据库路由模型是：

1. GitHub Adapter 收到 Webhook。
2. Adapter 派发 `ctx.on('github/star')` 或 `ctx.on('github/push')`。
3. 本插件查询 Koishi 数据库表 `github_relay_bindings`。
4. 找到 `owner/repo -> QQ 群` 的绑定。
5. 通过目标 QQ Bot 调用 `bot.sendMessage()` 转发到群里。

## 1. 本地开发与打包

在当前插件目录执行：

```bash
pnpm install
pnpm build
```

如果你要把它作为本地插件装进 Koishi 主项目，推荐直接在 Koishi 项目里执行：

```bash
pnpm add /Volumes/Important/E_backup/Creation/koishi-plugin
```

也可以先打包：

```bash
pnpm pack
```

然后在 Koishi 项目中安装生成的 `.tgz`。

## 2. Koishi 侧依赖关系

你至少需要这些插件同时工作：

- GitHub 侧：`koishi-plugin-adapter-github`
- QQ 侧：NapCat 对应的 Koishi 适配器，常见是 OneBot
- 数据库：任意 Koishi database 插件
- 本插件：`koishi-plugin-github-qq-relay`

本插件会强依赖 database 服务，因为仓库到群号的绑定保存在数据库里。

## 3. GitHub Adapter 推荐配置

Webhook 模式推荐配置如下：

```yaml
plugins:
  adapter-github:
    token: "ghp_xxx"
    mode: webhook
    webhookPath: /github/webhook
    webhookSecret: "your-webhook-secret"
    silentMode: false
```

关键点：

- 文档和源码都确认默认 webhook 路径是 `/github/webhook`
- Webhook 模式才能完整稳定支持 `star`
- `push` 事件在源码里明确派发为 `github/push`

## 4. 本插件配置

示例：

```yaml
plugins:
  github-qq-relay:
    defaultPlatform: onebot
    defaultBotId: "1234567890"
    commandAuthority: 3
    maxPushCommits: 3
    bindings:
      - repo: yourname/yourrepo
        channelId: "12345678"
        platform: onebot
        botId: "1234567890"
        events:
          - star
          - push
```

说明：

- `defaultPlatform`
  NapCat 常见场景填 `onebot`
- `defaultBotId`
  如果你只挂了一个 QQ Bot，也建议填上，避免多实例时转错
- `bindings`
  这是静态绑定；同时你也可以用命令写入数据库绑定

## 5. 数据库绑定命令

建议直接在目标 QQ 群里执行，省得再手填群号。

绑定当前群：

```text
github-relay.bind yourname/yourrepo
```

绑定指定群并限制事件：

```text
github-relay.bind yourname/yourrepo 12345678 -e star,push -p onebot -b 1234567890
```

查看绑定：

```text
github-relay.list
github-relay.list yourname/yourrepo
```

解绑：

```text
github-relay.unbind yourname/yourrepo
github-relay.unbind yourname/yourrepo 12345678
```

## 6. 本地上传与部署流程

### 第一步：启动 QQ 端

1. 启动 NapCat。
2. 确认 NapCat 的 OneBot WebSocket 服务正常。
3. 确认 Koishi 已经可以通过该适配器向群发消息。

这一步要先单独验证，否则 GitHub 事件到了 Koishi 也发不出去。

### 第二步：启动 Koishi

确保 Koishi HTTP 服务对外监听，例如你现在的思路里是 `3000`。

你的 QQ 端 websocket 可以继续跑在 `3001`，这和 GitHub Webhook 的 `3000` 不冲突。

### 第三步：暴露公网入口

把下面地址暴露给 GitHub：

```text
http://你的公网IP:3000/github/webhook
```

如果本机没有公网 IP，可以用 FRP、cloudflared、ngrok 之类把 `3000` 暴露出去。

### 第四步：GitHub Webhook 配置

在目标仓库的：

`Settings -> Webhooks -> Add webhook`

填写：

- Payload URL: `http://你的公网IP:3000/github/webhook`
- Content type: `application/json`
- Secret: 与 `webhookSecret` 一致

勾选事件：

- `Watch`，用于 Star
- `Pushes`，用于 Push

如果你选 `Send me everything` 也可以，但最小化配置更稳。

### 第五步：创建绑定

在目标 QQ 群里执行：

```text
github-relay.bind yourname/yourrepo
```

或者直接在插件配置里写死 `bindings`。

### 第六步：联调验证

按你的工作流，应该这样验证：

1. 在 GitHub 仓库点一次 Star。
2. 看 Koishi 是否收到 webhook。
3. 看本插件是否命中数据库绑定。
4. 看 QQ 群是否收到 Star 通知。
5. 再 push 一次提交，确认 `github/push` 路由也通。

## 7. 当前消息格式

Star：

```text
[GitHub Star] octocat 点亮了 Star
仓库：owner/repo
链接：https://github.com/owner/repo
```

Push：

```text
[GitHub Push] octocat 推送了 2 个提交
仓库：owner/repo
分支：main
提交：
- abc1234 feat: add relay
- def5678 fix: handle push
对比：https://github.com/owner/repo/compare/...
```

## 8. 与 adapter-github 对齐的接口依据

这个插件直接依据以下接口实现：

- 事件：`github/star`
- 事件：`github/push`
- GitHub Webhook 默认路径：`/github/webhook`
- 发送消息：Koishi 标准 `bot.sendMessage(channelId, content, guildId?)`

其中 `github/push` 虽然你给的事件文档页没有单列，但适配器源码里已经明确派发。
