# 别只装一个 AI Agent：我为什么把 OpenCode 当作“救援工具”

**善用 OpenCode：给自己准备一个备用 AI Agent**

现在越来越多的工作开始交给 AI Agent 处理：改代码、查配置、修环境、操作服务器、整理文件，甚至直接在电脑终端执行命令。

但用得越多，也越容易遇到一个现实问题：如果你最常用的那个 Agent 本身出问题了怎么办？

比如 Claude Code、Codex、ZCode 或其他 Agent 突然无法启动，API 配置异常，插件报错，环境变量混乱，甚至某次修改把自己的配置文件改坏了。这时候，如果手头只有一个 Agent，往往会陷入一个很尴尬的状态——本来想让 AI 帮你修电脑，结果坏掉的恰恰就是这个 AI。

我的做法很简单：额外装一个 OpenCode，作为备用 Agent。

## OpenCode 很适合充当“救援 Agent”

OpenCode 本身比较轻量，可以连接多种模型，也有一些免费模型可以使用。

这意味着，即使你平时主要使用的是 Codex、Claude Code 或 ZCode，也完全可以把 OpenCode 放在电脑里备用。

平时不用管它，但遇到问题时，可以直接打开 OpenCode，让它检查：

- 为什么某个 Agent 无法启动；
- API Key 或环境变量是不是配置错了；
- 某个 MCP 为什么连接失败；
- 配置文件哪里写错了；
- Node、Python、Docker 等环境是否异常；
- 某个程序为什么端口冲突；
- 网络、代理、DNS 是否存在问题；
- 让它直接查看日志并尝试修复。

这时候，OpenCode 的作用更像一个“第二维修工”。

尤其是很多 AI 工具的问题，本质上并不是复杂的软件开发问题，而只是配置文件、依赖、权限、路径、网络或者环境变量出了问题。换一个能够读取终端和文件的 Agent，往往很快就能找到原因。

## 两个 Agent，比一个 Agent 靠谱很多

我现在越来越倾向于一种思路：

**不要把所有 AI 工作都押在一个 Agent 上。**

就像电脑最好有备份，服务器最好有备用节点一样，Agent 也应该有备份。

例如平时主要使用：

- 主 Agent：Codex / Claude Code / ZCode
- 备用 Agent：OpenCode

当主 Agent 出问题时，让 OpenCode 检查主 Agent。

反过来，如果 OpenCode 出问题，也可以让其他 Agent 检查 OpenCode。

甚至在处理比较重要的任务时，还可以让两个 Agent 相互检查。例如一个 Agent 修改配置，另一个 Agent 帮忙检查修改是否合理。

这比单纯依赖一个模型可靠得多。

## VPS 上也可以放一个 OpenCode

OpenCode 不一定只装在自己的 Mac 或 Windows 电脑上。

如果你平时有 VPS，也可以在 VPS 里面安装一个 OpenCode。

这样 VPS 本身就多了一个可以直接操作服务器环境的 AI Agent。

以后遇到一些服务器问题，例如：

- Docker 服务异常；
- Nginx 配置错误；
- Cloudflare Tunnel 出问题；
- Tailscale 无法连接；
- 磁盘空间不足；
- 某个服务无法启动；
- 查看日志；
- 修改配置文件；
- 部署 GitHub 项目；

都可以直接让 OpenCode 在 VPS 环境里检查和处理。

对于经常折腾服务器的人来说，这实际上相当于给 VPS 配了一个随时可以调用的 AI 运维助手。

## 不一定每天用，但最好有一个

OpenCode 对我来说，最大的意义并不是取代 Codex、Claude Code 或其他 Agent。

它更适合作为一个备用工具。

平时主力 Agent 好用，就继续用主力 Agent；一旦主力工具出问题，就立即换另一个 Agent 来排查。

很多时候，我们真正需要的并不是“最强的一个 AI”，而是一个相对稳定的 AI 工具体系。

所以，如果电脑和 VPS 已经开始大量依赖 Agent，我会建议至少准备两个。

一个负责干活，一个负责在另一个坏掉的时候救场。

有备无患，这可能是 AI Agent 越来越深入电脑工作流之后，一个很实用的小习惯。
