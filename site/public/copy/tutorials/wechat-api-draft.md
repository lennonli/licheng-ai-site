# 用微信API自动写公众号草稿：从凭证到入库，附完整代码

上一篇讲了怎么用AI做排版模板，文章排好之后，还有最后一步：粘贴进公众号后台。

一篇还好，如果你也像我一样，一次写一个系列（我最近一口气写了25篇），一篇篇粘贴、传封面、填摘要，就是纯粹的体力活。

这篇文章讲怎么用微信官方API，把写好的文章**直接写进公众号草稿箱**。先说清楚边界：这套方法只进草稿箱，**不碰群发**——发不发、什么时候发，永远是人点的那一下。

## 一、先拿凭证：AppID、AppSecret 和 IP 白名单

登录 mp.weixin.qq.com，左侧「设置与开发 → 基本配置」：

- **AppID** 直接可见；
- **AppSecret** 点「生成」或「重置」，管理员微信扫码确认，**只显示这一次，立刻保存**；
- 同页下方「**IP 白名单**」：把你调用API的电脑公网IP填进去（搜「我的IP」即可查到）。不加白名单，第一步就会报错 40164。

提醒两点：AppSecret 等同密码，存到本机安全位置，别发任何群和仓库；家宽IP偶尔会变，变了就回白名单补一条。

## 二、换 access_token：所有接口的门票

微信API用 access_token 做凭证，有效期2小时。推荐用不占调用次数配额的稳定版接口：

```python
import requests, json

cred = json.load(open("/Users/你/.config/gzh/credentials.json"))

r = requests.post("https://api.weixin.qq.com/cgi-bin/stable_token", json={
    "grant_type": "client_credential",
    "appid": cred["appid"],
    "secret": cred["secret"],
}).json()
token = r["access_token"]
```

如果你的电脑开了代理，记得让脚本直连，否则白名单里的IP对不上。

## 三、传素材：封面和正文图片是两条路

封面要用「永久素材」接口，拿到 media_id 塞给草稿：

```python
files = {"media": ("cover.jpg", open("cover.jpg", "rb"), "image/jpeg")}
r = requests.post(
    f"https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={token}&type=image",
    files=files).json()
thumb_id = r["media_id"]
```

**第一个坑**：这里的文件字段名必须是 media，写 file 会报 41005 media data missing。我就栽在这。

正文里的图片走另一个接口 uploadimg，返回微信CDN链接，正文里引用这个链接即可——不要用本地路径或base64，公众号会过滤。

## 四、写草稿：draft/add 一锤定音

```python
article = {
    "title": "AI优先｜做任何工作前，先问一句：这个事能用AI完成吗？",
    "author": "李成律师",
    "digest": "摘要不超过120字，显示在会话分享卡片上",
    "content": "<p style='...'>正文HTML，样式内联</p>",
    "thumb_media_id": thumb_id,
}
r = requests.post(
    f"https://api.weixin.qq.com/cgi-bin/draft/add?access_token={token}",
    json={"articles": [article]}).json()
print(r)   # 返回 media_id 即成功
```

content 就是上一篇做的排版模板产出的那段内联样式HTML。标题、摘要、封面、正文，一次齐活。循环这个调用，25篇文章几分钟全部入库。

**第二个坑**：查草稿列表时，draft/batchget 是POST接口，分页参数要放JSON body里，拼在网址上会报 43002 require POST method。同理，修改草稿用 draft/update，而且要**整篇 articles 提交**，只传title改标题会报 40007。

## 五、几个只有踩过才知道的细节

1. **首次调用可能触发风控**：报 89503 时不用慌，管理员微信上点一下「确认是本人操作」即可；
2. **content 要干净**：别把网页上复制的整页HTML直接塞进去，工具条、按钮文字会一起变成文章内容——第一次跑通后，去后台草稿箱抽查一篇正文再批量；
3. **每篇之间 sleep 0.5秒**：不留间隔的密集调用容易被限频；
4. **写完做独立校验**：用 draft/batchget 拉列表，核对标题数、封面、摘要是否齐全，别只看接口返回成功。

## 写在最后

有人会问：AI加API都能自动写草稿了，为什么不让它自动发布？

因为**发布的那个按钮，必须是人的判断**：内容对不对、时机对不对、要不要发——这是责任，不该外包给自动化。

AI负责把执行做到极致，人负责最后那一下。这不是保守，是人机分工里最舒服的位置。
