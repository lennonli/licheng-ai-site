# 新建VPS后opencode 安装与远程 Web UI 配置教程

## 一、安装 opencode

适用于 AlmaLinux / CentOS / Rocky / RHEL 系统：

```bash
dnf install -y tar gzip curl ca-certificates
update-ca-trust
curl -fsSL https://opencode.ai/install | bash
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version
```

如果没有 `dnf`，改用：

```bash
yum install -y tar gzip curl ca-certificates
update-ca-trust
curl -fsSL https://opencode.ai/install | bash
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version
```

让以后登录也能直接使用 `opencode`：

```bash
echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## 二、处理 xdg-open 报错

服务器没有图形桌面时，启动 Web UI 可能报错：

```text
Executable not found in $PATH: "xdg-open"
```

执行：

```bash
printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/xdg-open
chmod +x /usr/local/bin/xdg-open
```

## 三、启动 Web UI

请将密码改成强密码：

```bash
nohup env OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD='这里改成强密码' opencode web --hostname 0.0.0.0 --port 4096 > /root/opencode-web.log 2>&1 &
```

检查是否启动成功：

```bash
ss -lntp | grep 4096
curl -I http://127.0.0.1:4096
```

如果看到：

```text
HTTP/1.1 401 Unauthorized
www-authenticate: Basic realm="Secure Area"
```

说明 Web UI 已启动，并且密码保护已生效。

## 四、开放端口

```bash
firewall-cmd --add-port=4096/tcp --permanent
firewall-cmd --reload
```

查看公网 IP：

```bash
curl ifconfig.me
```

异地浏览器访问：

```text
http://你的公网IP:4096
```

登录信息：

```text
用户名：opencode
密码：你设置的 OPENCODE_SERVER_PASSWORD
```

## 五、常用管理命令

查看日志：

```bash
tail -f /root/opencode-web.log
```

停止 Web UI：

```bash
pkill -f "opencode web"
```

修改密码并重启：

```bash
pkill -f "opencode web"
nohup env OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD='新强密码' opencode web --hostname 0.0.0.0 --port 4096 > /root/opencode-web.log 2>&1 &
```

## 六、安全建议

公网直接暴露 opencode 存在较高风险，因为它可以读写服务器文件并执行命令。

建议：

- 不要使用弱密码；
- 不要长期裸露在公网；
- 更推荐使用 Tailscale 或 Cloudflare Tunnel；
- 如必须公网访问，建议配合反向代理、HTTPS、访问控制和强密码。
