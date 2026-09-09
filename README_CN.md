# T-RX Runner 多人对战

**Chrome 小恐龙游戏，多人版：2-4 人同房间，实时进度条比拼。**

[English](./README.md) | [中文](./README_CN.md)

---

每个玩家在本地跑自己的完整游戏，只同步分数和存活状态。HUD 实时显示每个人的进度条与分数——死掉的玩家变灰加删除线。局域网、公网都能玩。

游戏素材提取自 Chrome 断网页彩蛋（经 [wayou/t-rex-runner](https://github.com/wayou/t-rex-runner)，Chromium 源码 BSD 许可）。多人层零修改游戏代码，旁路接入。

## 怎么玩

1. 打开游戏页（GitHub Pages 链接见下）
2. 输入房间码（任意词，分享给朋友）
3. 服务器一栏填中继地址（见下）
4. 按空格开跑。房间里所有人都能看到所有人的进度。

## 架构

```
浏览器（本地完整游戏）──每 500ms 上报分数/存活──►  WebSocket 中继  ──广播──►  所有浏览器
```

- **不需要帧同步。** 每个客户端渲染自己的游戏，只传状态摘要，延迟无所谓。
- **零游戏代码修改。** net.js 是旁路观察者，读 Runner 实例；2752 行原版游戏文件一字未动。
- **房间上限 4 人**，第 5 人自动拒绝；掉线 10 秒自动清理；后台标签页节流恢复后自动重入。

## 文件

```
├── index.html     # 游戏页 + 多人 HUD
├── game.js        # 原版 t-rex-runner（未修改的 Chromium 源码）
├── game.css       # 原版样式
├── net.js         # 多人客户端：观察者 + HUD 渲染
├── server.js      # WebSocket 中继（Node.js, ws）
└── assets/        # Chrome 提取素材
```

## 免费部署中继

Render.com / Railway / Fly.io 免费档都行：

```bash
git clone https://github.com/Thomaszhou22/trex-multiplayer.git
cd trex-multiplayer && npm install
npm start   # 监听 $PORT 或 8080
```

Render 上：New Web Service → 连仓库 → 启动命令 `npm start`，拿到 `wss://xxx.onrender.com` 填进游戏服务器栏。纯局域网玩：任意机器 `npm start`，用 `ws://<局域网IP>:8080`。

## 本地运行

```bash
npm install && npm start          # 中继 :8080
python3 -m http.server 8765       # 静态页
# 打开 http://localhost:8765，房间码随意，服务器 ws://localhost:8080
```

## 已验证

- 双模拟客户端：加入广播、分数更新（321）、死亡传播——全部正确
- 空闲玩家超过 10 秒剔除窗口仍在房间（心跳与游戏状态解耦）
- 后台标签页节流后自动重入回归——通过

## 许可

多人代码（net.js、server.js、index.html）MIT。游戏代码与素材为 BSD 许可的 Chromium 源码（经 wayou/t-rex-runner），素材版权归 Google——个人/教育用途没问题，商用部署前请更换素材。
