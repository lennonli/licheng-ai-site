本次成功经验可以总结为：

1. DMIT VPS 访问路径  
   先登录 DMIT 客户中心，进入对应 VPS 产品详情页，通过 **访问 / VNC 控制台 / 串列控制台** 可以直接进入服务器本地控制台；即使 SSH 不通，也能继续操作 VPS。

2. SSH Key 处理  
   DMIT 自动生成下载的 key 中，Mac 应使用 `.pem` 文件；`.ppk` 主要给 PuTTY，`.pub` 是公钥。私钥需放到 `~/.ssh/` 并设置：

```bash
chmod 600 ~/.ssh/xxx.pem
```

3. SSH 排障结论  
   本机连接显示 `kex_exchange_identification: Connection closed by remote host`，该错误发生在密钥认证前，不等同于“公钥不匹配”。如果是公钥不匹配，通常会看到 `Permission denied (publickey)`。

4. VPS 内部修复方式  
   通过 VNC 成功进入 Debian 系统后，可以安装和启动 SSH：

```bash
apt update
apt install -y openssh-server curl git ca-certificates unzip
systemctl enable --now ssh
systemctl status ssh --no-pager
```

5. opencode 安装成功  
   在 VPS 上通过官方脚本成功安装：

```bash
curl -fsSL https://opencode.ai/install | bash
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version
```

确认版本为 `1.17.16`。

6. WebUI 配置经验  
   VNC 黑屏里粘贴长命令容易被断行，导致 `>` 重定向错误、`/: Is a directory`、`syntax error near unexpected token newline`。更稳妥做法是先前台启动：

```bash
cd /root/opencode-work
export PATH="/root/.opencode/bin:$PATH"
export OPENCODE_SERVER_USERNAME=opencode
export OPENCODE_SERVER_PASSWORD='强密码'
opencode web --hostname 0.0.0.0 --port 4096
```

7. 后续推荐方案  
   如果以后主要通过 opencode WebUI 管理 VPS，可以不再纠结 SSH；待 WebUI 前台启动验证成功后，再配置 `systemd` 常驻服务。公网暴露 WebUI 时必须使用强密码。
