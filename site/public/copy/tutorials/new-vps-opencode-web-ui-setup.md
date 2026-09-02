# 新建 VPS 后 OpenCode 安装与远程 Web UI 配置教程

日期：2026-07-09  
适用对象：需要在新建 Debian VPS 上安装 OpenCode、排查 SSH，并通过远程 Web UI 使用 OpenCode 的用户。

## 一、通过服务商控制台进入 VPS

先登录 DMIT 客户中心，进入对应 VPS 产品详情页。通过“访问 / VNC 控制台 / 串列控制台”可直接进入服务器本地控制台；即使 SSH 暂时不通，也能继续操作 VPS。

## 二、准备 SSH Key

DMIT 自动生成的 key 中，macOS 应使用 `.pem` 文件；`.ppk` 主要供 PuTTY 使用，`.pub` 是公钥。私钥应放入 `~/.ssh/` 并设置权限：

```bash
chmod 600 ~/.ssh/xxx.pem
```

## 三、判断 SSH 报错阶段

如本机显示 `kex_exchange_identification: Connection closed by remote host`，说明连接在密钥认证前已关闭，不等同于“公钥不匹配”。公钥不匹配通常显示 `Permission denied (publickey)`。

## 四、在 VPS 内修复 SSH 服务

通过 VNC 进入 Debian 后，可安装并启动 SSH：

```bash
apt update
apt install -y openssh-server curl git ca-certificates unzip
systemctl enable --now ssh
systemctl status ssh --no-pager
```

## 五、安装 OpenCode

通过 OpenCode 官方脚本安装并检查版本：

```bash
curl -fsSL https://opencode.ai/install | bash
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version
```

本次验证时的版本为 `1.17.16`。后续版本可能变化，应以安装后实际输出为准。

## 六、前台启动 OpenCode Web UI

VNC 控制台中粘贴长命令容易断行，进而产生重定向或语法错误。建议先以前台方式验证：

```bash
cd /root/opencode-work
export PATH="/root/.opencode/bin:$PATH"
export OPENCODE_SERVER_USERNAME=opencode
export OPENCODE_SERVER_PASSWORD='请替换为强密码'
opencode web --hostname 0.0.0.0 --port 4096
```

## 七、安全与常驻运行建议

- 公网开放 Web UI 前必须设置高强度、独立密码。
- 建议仅向可信 IP 开放端口，或通过反向代理、TLS 和访问控制提供服务。
- 前台启动验证成功后，再配置 `systemd` 常驻服务。
- 不应在公开仓库、截图或聊天记录中保存真实密码、私钥或 API Key。
