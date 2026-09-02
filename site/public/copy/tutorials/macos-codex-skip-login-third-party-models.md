# macOS Codex 跳过登录页面教程（使用第三方模型）

日期：2026-07-08

## 一、适用场景

适用苹果电脑 macOS 系统，已在 Codex 的 `config.toml` 中配置了（如通过 cc-switch 配置）第三方模型（通过 `experimental_bearer_token` 或 `env_key` 调用自建/中转 API），但每次启动 Codex 仍弹出 OpenAI 登录页面，希望直接跳过登录进入对话界面。

## 二、问题原因

Codex 默认要求 OpenAI 账号认证，由以下两个因素共同控制：

1. **`config.toml` 中 `requires_openai_auth = true`** —— 告诉 Codex 该 provider 必须先完成 OpenAI 登录才能使用。
2. **`auth.json` 中 `auth_mode = "chatgpt"`** —— 记录的认证方式为 ChatGPT 登录，Codex 检测到未登录或令牌过期时就会弹出登录页。

只要这两个值不改，即使你配好了第三方模型，登录页仍会拦截。

## 三、操作步骤

### 步骤 1：完全退出 Codex

- Mac：`Cmd + Q` 彻底退出（仅关窗口不算退出）。
- 修改期间 Codex 不能处于运行状态，否则它退出时会用内存中的旧配置覆盖你的修改。

### 步骤 2：备份现有配置（强烈建议）

打开“终端”，执行：

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak-$(date +%Y%m%d-%H%M%S)
cp ~/.codex/auth.json    ~/.codex/auth.json.bak-$(date +%Y%m%d-%H%M%S)
```

如后续出问题，可用备份文件还原。

### 步骤 3：修改 `config.toml`

用文本编辑器打开 `~/.codex/config.toml`，找到 `[model_providers.custom]`（或你自定义的 provider 名）下方的这一行：

```toml
requires_openai_auth = true
```

改为：

```toml
requires_openai_auth = false
```

**仅改这一行，其余内容不动。**

改完后该段大致如下（示例）：

```toml
[model_providers.custom]
name = "Sub2API"
base_url = "http://你的中转地址:端口"
wire_api = "responses"
requires_openai_auth = false
experimental_bearer_token = "sk-你的token"
```

> 说明：`experimental_bearer_token`（或 `env_key`）就是 Codex 调用第三方模型时携带的密钥，登录页跳过后靠它鉴权，无需再走 OpenAI 登录。

### 步骤 4：重置 `auth.json`

将 `~/.codex/auth.json` 的内容替换为：

```json
{
  "OPENAI_API_KEY": null,
  "auth_mode": "apikey",
  "last_refresh": "2026-07-08T00:00:00.000000Z",
  "tokens": null
}
```

要点：

- `auth_mode` 改为 `"apikey"`（不再走 chatgpt 登录流程）。
- `tokens` 设为 `null`（清除旧的 OAuth 令牌）。
- `last_refresh` 的日期可填当天，仅作时间戳。

### 步骤 5：重新启动 Codex

打开 Codex 应用，正常情况下会**直接进入对话界面**，不再弹出登录页。

## 四、验证是否生效

启动后，在 Codex 中随意发一条消息：

- 能正常返回回复 → 配置成功。
- 仍提示登录或报错 → 见下方排错。

## 五、常见问题排查

| 现象 | 可能原因 | 处理方法 |
| --- | --- | --- |
| 仍弹登录页 | Codex 未完全退出就改了配置，被覆盖 | 彻底退出后重新执行步骤 3、4 |
| 报 `401 / Unauthorized` | `experimental_bearer_token` 失效或填错 | 核对 token 是否正确、是否过期 |
| 报 `connection refused / 超时` | `base_url` 不通或端口错误 | 浏览器或 `curl` 直接访问该地址测试连通性 |
| 报 `wire_api` 相关错误 | 第三方接口协议与设置不符 | 尝试把 `wire_api` 在 `"responses"` 与 `"chat"` 之间切换 |
| 想恢复登录 | 已跳过登录，现需用回官方账号 | 用备份文件还原 `config.toml` 和 `auth.json`，或删除 `auth.json` 后重启让 Codex 重新触发登录 |

## 六、一键脚本（可选）

如想一次完成备份+修改，可保存以下脚本为 `codex-skip-login.sh` 后执行：

```bash
#!/bin/bash
set -e
CODEX_HOME="$HOME/.codex"

# 1. 备份
ts=$(date +%Y%m%d-%H%M%S)
cp "$CODEX_HOME/config.toml" "$CODEX_HOME/config.toml.bak-skiplogin-$ts"
cp "$CODEX_HOME/auth.json"   "$CODEX_HOME/auth.json.bak-skiplogin-$ts"
echo "已备份: config.toml.bak-skiplogin-$ts / auth.json.bak-skiplogin-$ts"

# 2. 修改 config.toml: requires_openai_auth = true -> false
sed -i '' 's/requires_openai_auth = true/requires_openai_auth = false/' "$CODEX_HOME/config.toml"
echo "config.toml: requires_openai_auth 已置为 false"

# 3. 重置 auth.json
cat > "$CODEX_HOME/auth.json" <<'EOF'
{
  "OPENAI_API_KEY": null,
  "auth_mode": "apikey",
  "last_refresh": "2026-07-08T00:00:00.000000Z",
  "tokens": null
}
EOF
echo "auth.json: 已重置为 apikey 模式"
echo "完成。请彻底退出 Codex 后重新启动。"
```

> 注：`sed -i ''` 为 macOS 语法；如在 Linux 上运行，改为 `sed -i 's/.../.../'`。

## 七、注意事项

1. 本方法仅适用于“已正确配置第三方模型 provider”的场景；若第三方接口本身不通，跳过登录后会直接报调用错误。
2. Codex 升级版本后可能重置 `config.toml` 或 `auth.json`，届时需重新执行上述修改。
3. `experimental_bearer_token` 属敏感信息，教程中请勿连同真实 token 一起外发。
