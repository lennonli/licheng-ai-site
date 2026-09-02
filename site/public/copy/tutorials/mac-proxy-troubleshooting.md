# 任务：排查并修复这台 Mac 的代理分流配置

> 复用说明：本文为跨机器复用的排查提示词模板。原始工作稿中的服务器公网 IP、tailnet IP、节点密码等真实凭证已脱敏为占位符，使用时自行替换；节点添加步骤由本人在客户端界面手动完成。

目标状态：**国内网站直连、国外网站走 hysteria2 代理、DNS 不被污染**。

我的另一台 MacBook 刚排查完同样的问题，下面是已确诊的结论。**请直接按这个思路核实，不要从头摸索**——但每一项都要在本机实测确认，因为接口号、IP、网关都可能不同。

---

## 环境背景

这台机器可能同时装了：

- **Shadowrocket**（macOS 版，Network Extension 形态，进程名 `MacPacketTunnel`）
- **Tailscale**（`/Applications/Tailscale.app/Contents/MacOS/Tailscale` 是它的 CLI）
- 可能还有一个闲置的商业 VPN 系统扩展，会占用一个 utun 接口（`10.222.222.1`）并抢占 `100.66.x` 网段和 DNS

代理服务器（代号 serv）：

- 公网 `<服务器公网IP>`
- tailnet IP `<serv的tailnetIP>`
- 上面跑 sing-box，提供 hysteria2(UDP 443) / tuic(UDP 8443) / shadowsocks(TCP 8388)

---

## 已确诊的三个冲突

### 冲突 1：DNS 污染 —— 最关键，请优先查

**症状**：国外网站每次都要卡满 5 秒才失败；国内网站正常。

**根因**：Tailscale 的 MagicDNS 抢占系统 DNS（`100.100.100.100`），把查询转发到国内上游，拿回 GFW 投毒的假 IP（`www.google.com` 会被解析成 Facebook 的 IP）。Shadowrocket 因此只能按 IP 转发给代理服务器，服务器去连这些假 IP 自然超时。

**诊断**：

```sh
scutil --dns | grep "nameserver\[0\]" | sort -u
dig +short www.google.com
```

判读 `dig` 的结果：

| 返回 | 含义 |
|---|---|
| `198.18.x.x` | ✅ Shadowrocket 的 fake-ip 正常工作，没问题 |
| `157.240.x` / `31.13.x` / `69.171.x` | ❌ 被投毒（这些是 Facebook 的 IP 段） |
| `142.250.x` / `74.125.x` / `172.217.x` | ⚠️ 真实 Google IP —— 没走 fake-ip，但这次侥幸没中毒 |

**修复**：

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale set --accept-dns=false
```

修复后系统 DNS 应回到 `198.18.0.2`（Shadowrocket 的 fake-ip DNS），`dig +short www.google.com` 应返回 `198.18.x.x`。

**两个重要事实**：

1. **国内 DoH 一样被投毒**——实测阿里 DoH、腾讯 DoH 返回的都是 Facebook 的 IP。因为它们的递归解析器在国内，向境外权威 DNS 查询时走的还是被投毒的链路，HTTPS 只保护了「你→DoH 服务器」这一段。所以**换 DNS 服务器、上 DoH/DoT 都治不了**，必须靠 fake-ip 把域名原样交给墙外解析。
2. **副作用**：关掉 accept-dns 后 MagicDNS 失效，访问 tailnet 机器要用 `100.x` IP，不能再用主机名。恢复是 `--accept-dns=true`，但污染会立刻回来，两者不可兼得。

除了 Tailscale，也要检查有没有别的东西在抢 DNS（比如上面提到的闲置 VPN 的 `100.66.66.66`）。

### 冲突 2：Shadowrocket 劫持 tailnet 路由

**症状**：Tailscale 完全不通，ping `100.x` 地址 100% 丢包，连不上内网机器。

**根因**：Shadowrocket 把 `100.64.0.0/10`（CGNAT 段，正是 tailnet 网段）当成私有地址放进 bypass-tun，装出一条指向 LAN 网关的路由，压过了 Tailscale 自己的 utun 接口路由。

**诊断**：

```sh
netstat -rn -f inet | grep "^100.64/10"
route -n get <serv的tailnetIP> | grep -E "interface|gateway"
```

如果 `interface` 显示 `en0`（而不是 Tailscale 的 utun 接口），就是被劫持了。

**修复**（先取 LAN 网关）：

```sh
netstat -rn -f inet | awk '$1=="default" && $NF ~ /^en/ {print $2}'   # 假设得到 192.168.x.1
sudo route -n delete -net 100.64.0.0/10 192.168.x.1
```

⚠️ **`sudo` 必须在真正的终端窗口里跑**（Terminal.app / iTerm）。在 AI 助手的命令执行框里跑会失败，报 `sudo: a terminal is required to read the password`——因为那里没有 TTY。请把命令给我，我自己在终端执行后把输出贴回来。

### 冲突 3：Tailscale 的 UDP 被 Shadowrocket 的 TUN 抓走

**症状**：Tailscale 能连但极慢；`netcheck` 显示的本机公网 IP 等于代理的出口 IP，DERP 延迟高达 1 秒以上（正常应是几十 ms）。

**诊断**：

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale netcheck
```

看 `IPv4: yes, x.x.x.x` 那一行——如果这个 IP 是代理的出口 IP 而不是本地宽带的出口 IP，就是被抓走了。

**修复**（同样需要真终端）：

```sh
sudo route -n add -host <服务器公网IP> 192.168.x.1
```

**注意**：冲突 2、3 的路由修复**重启后会丢失**。如果这台机器不用 Tailscale 上网（推荐），只用它连内网机器，那么不修也不影响上网，只影响能否访问 tailnet。

---

## 目标架构，以及一条走不通的路

**正确架构**：Shadowrocket 当规则引擎（国内由它现有的直连规则库负责），国外流量走 serv 的 **hysteria2** 节点。

**不要试图让 Shadowrocket 使用 tailnet 内的代理服务器**（比如 `<serv的tailnetIP>:1080` 上的 SOCKS5）。我们已经验证过这是**架构级死结**：Shadowrocket 的 Network Extension 强制把自己的出站 socket 绑定到物理网卡 en0（`lsof` 可见源地址是 `192.168.x.x` 而非 tailnet IP），发往 CGNAT 地址的包会被 LAN 网关直接丢弃，永远停在 `SYN_SENT`。改路由无解，别在这上面浪费时间。

**为什么选 hysteria2 而不是 Tailscale exit node**：曾以为「Tailscale 稳、Shadowsocks 老掉线」是 Tailscale 特殊，其实**真正原因是 UDP 抗封而 TCP 不抗封**（原先用的是 SS 的 TCP 8388）。而且实测两者速度差距悬殊——同一条链路上 hysteria2 延迟 0.53s / 带宽 0.65 MB/s，Tailscale 链路延迟 1.17s / 带宽只有 0.04 MB/s。原因是这条国际线路有 7–10% 丢包，WireGuard 遇丢包吞吐就崩，而 hysteria2 的 QUIC+BBR 本就是为高丢包链路设计的。

---

## 如果这台机器还没配 hysteria2 节点

在 Shadowrocket 里添加（它能识别剪贴板里的节点链接）。链接格式模板如下，密码与服务器地址请用你自己的实际值：

```
hysteria2://<密码>@<服务器公网IP>:443/?insecure=1&sni=<服务器公网IP>#<节点名>
```

备用（hysteria2 被干扰时换这个）：

```
tuic://<UUID>:<密码>@<服务器公网IP>:8443?congestion_control=bbr&alpn=h3&allow_insecure=1&udp_relay_mode=native#<节点名>
```

要点：**必须开启「允许不安全 / skip-cert-verify」**，因为服务器用的是自签证书（SAN 只有 IP）；SNI 填服务器 IP。添加节点这一步只能我在 Shadowrocket 界面里手动做——它的规则库是二进制格式（`XDAT` 开头），不要尝试直接编辑。

---

## 验收标准

全部跑通才算修好：

```sh
# 1. 分流是否正确
curl -s -m 15 "http://myip.ipip.net"        # 应显示国内 ISP（直连）
curl -s -m 20 "https://ipinfo.io/ip"        # 应显示代理出口 IP（走代理）

# 2. DNS 是否干净
dig +short www.google.com                    # 应返回 198.18.x.x

# 3. 国外站点（不应有 5 秒超时）
for u in https://www.google.com https://www.youtube.com https://github.com; do
  curl -s -o /dev/null -m 20 -w "$u  HTTP %{http_code}  %{time_total}s\n" "$u"
done

# 4. 国内站点（应在 0.2s 内）
for u in https://www.baidu.com https://www.taobao.com; do
  curl -s -o /dev/null -m 12 -w "$u  HTTP %{http_code}  %{time_total}s\n" "$u"
done
```

参考值（已修好的那台机器实测）：国外 google 0.66s / youtube 1.60s / github 1.20s，连续 10 次 0 失败；国内 baidu 0.149s / taobao 0.175s。

---

## 排查纪律

1. **先跑诊断再动手**，把本机的实际情况（接口号、IP、网关、装了哪些 VPN）摸清楚，不要照抄上面的具体数值。
2. **凡是需要 sudo 的命令，交给我在真终端里执行**，你不要尝试自己跑。
3. 如果诊断结果和上面描述的不一致，**以实测为准**，告诉我差异在哪，不要硬套结论。
