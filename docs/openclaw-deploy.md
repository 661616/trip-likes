# OpenClaw 本地 Docker 部署指南

> 适用于本地开发机部署，后续可无缝迁移到云服务器。

---

## 前置要求

- Docker & Docker Compose 已安装
- 内存 ≥ 4GB（推荐）
- 一个 AI 模型 API Key（OpenAI / DeepSeek / 中转站均可）
- （可选）Discord Bot Token

---

## 一、快速部署

### 1.1 创建工作目录

```bash
mkdir -p ~/openclaw-docker/config
cd ~/openclaw-docker
```

### 1.2 编写配置文件

```bash
cat > config/openclaw.json << 'ENDCONFIG'
{
  "gateway": {
    "mode": "local"
  },
  "models": {
    "mode": "merge",
    "providers": {
      "relay": {
        "baseUrl": "https://ai.td.ee/v1",
        "apiKey": "<YOUR_API_KEY>",
        "api": "openai-responses",
        "models": [
          {
            "id": "gpt-5.2",
            "name": "GPT 5.2",
            "reasoning": true,
            "input": ["text"],
            "contextWindow": 1000000,
            "maxTokens": 32000
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "relay/gpt-5.2"
      }
    }
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "<YOUR_DISCORD_BOT_TOKEN>"
    }
  },
  "browser": {
    "enabled": false
  }
}
ENDCONFIG
```

> **替换说明**：
> - `<YOUR_API_KEY>` → 你的 AI 模型 API Key
> - `<YOUR_DISCORD_BOT_TOKEN>` → Discord Bot Token（获取方式见附录 A）
> - `baseUrl` → 如果直连 OpenAI 则改为 `https://api.openai.com/v1`；用 DeepSeek 则改为 `https://api.deepseek.com/v1`

### 1.3 编写 docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
services:
  openclaw:
    image: node:22-bookworm
    container_name: openclaw-gateway
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./config:/root/.openclaw
      - openclaw-workspace:/root/.openclaw/workspace
    ports:
      - "18789:18789"
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
      - NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
      - OPENCLAW_NO_RESPAWN=1
    command: >
      bash -c "
        npm install -g openclaw@latest &&
        mkdir -p /var/tmp/openclaw-compile-cache &&
        mkdir -p /root/.openclaw/agents/main/sessions &&
        openclaw gateway
      "

volumes:
  openclaw-workspace:
EOF
```

### 1.4 启动

```bash
docker compose up -d
```

### 1.5 查看日志确认启动成功

```bash
docker compose logs -f
```

看到以下关键行说明成功：

```
[gateway] listening on ws://127.0.0.1:18789
[discord] logged in to discord as xxxx (openclaw_bot)
```

按 `Ctrl+C` 退出日志查看（容器继续运行）。

---

## 二、Discord Bot 配对

首次使用需要配对：

1. 打开 Discord，私聊你的 Bot，发送任意消息
2. Bot 会回复一个配对码
3. 在终端执行：

```bash
docker exec openclaw-gateway openclaw pairing approve discord
```

配对完成，之后就能正常对话了。

---

## 三、常用运维命令

```bash
# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新到最新版
docker compose down
docker compose pull
docker compose up -d

# 进入容器调试
docker exec -it openclaw-gateway bash
```

---

## 四、迁移到云服务器

### 4.1 导出

```bash
tar -czf openclaw-backup.tar.gz ~/openclaw-docker/
```

### 4.2 传到新服务器

```bash
scp openclaw-backup.tar.gz root@<NEW_SERVER_IP>:/root/
```

### 4.3 新服务器上恢复

```bash
cd /root
tar -xzf openclaw-backup.tar.gz
cd openclaw-docker
docker compose up -d
```

> 配置、对话记忆、Skills 全部保留，无缝切换。

---

## 五、云服务器选购建议（需要 24/7 运行时）

| 方案 | 配置 | 价格 | 说明 |
|------|------|------|------|
| 腾讯云轻量（硅谷） | 2C4G | ~¥150-200/年 | 推荐，支付宝付款，有 OpenClaw 活动 |
| Hetzner CAX11 | 2C4G ARM | ~$4/月 | 官方推荐，需 PayPal |
| 阿里云轻量 | 2C4G | ~¥200/年 | 国内厂商，硅谷节点可直连 AI API |

> **最低配置**：2C4G 起步。2C2G 不够用（亲测），会频繁 OOM 崩溃。

---

## 六、内存资源参考

| 组件 | 内存占用 |
|------|---------|
| OpenClaw Gateway | 300-500 MB |
| 每个聊天渠道 | ~100 MB |
| 浏览器自动化（Chromium） | 500 MB - 2.5 GB |
| Docker 沙箱（每个） | 256 MB - 1 GB |

> 不开浏览器和沙箱时，总占用约 500-800 MB，4GB 服务器非常从容。

---

## 附录 A：获取 Discord Bot Token

1. 打开 https://discord.com/developers/applications
2. 点 **New Application** → 命名 → 创建
3. 左侧 **Bot** → **Reset Token** → 复制保存
4. 开启 **MESSAGE CONTENT INTENT**（必须）
5. 关闭 **Public Bot**（私人使用）
6. 左侧 **OAuth2** → **URL Generator**
   - Scopes: `bot` + `applications.commands`
   - Permissions: Send Messages, Read Message History, Attach Files, Embed Links
7. 复制生成的 URL → 浏览器打开 → 选服务器 → 授权

## 附录 B：配置多个模型提供商

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com/v1",
        "apiKey": "<DEEPSEEK_KEY>",
        "api": "openai-completions",
        "models": [
          { "id": "deepseek-chat", "name": "DeepSeek V3", "reasoning": false, "input": ["text"], "contextWindow": 128000, "maxTokens": 8192 },
          { "id": "deepseek-reasoner", "name": "DeepSeek R1", "reasoning": true, "input": ["text"], "contextWindow": 128000, "maxTokens": 8192 }
        ]
      },
      "relay": {
        "baseUrl": "https://ai.td.ee/v1",
        "apiKey": "<RELAY_KEY>",
        "api": "openai-responses",
        "models": [
          { "id": "gpt-5.2", "name": "GPT 5.2", "reasoning": true, "input": ["text"], "contextWindow": 1000000, "maxTokens": 32000 },
          { "id": "claude-4-opus", "name": "Claude 4 Opus", "reasoning": true, "input": ["text"], "contextWindow": 200000, "maxTokens": 16000 }
        ]
      }
    }
  }
}
```

> 切换默认模型：修改 `agents.defaults.model.primary` 的值，如 `deepseek/deepseek-chat`。

## 附录 C：安全提醒

- **永远不要**把 API Key 和 Bot Token 提交到 Git 仓库
- 建议将敏感信息用环境变量管理，在 docker-compose.yml 中引用：
  ```yaml
  environment:
    - OPENAI_API_KEY=${OPENAI_API_KEY}
  ```
- 部署到公网时，务必配置防火墙，不要暴露 18789 端口
- 定期轮换 API Key 和 Bot Token
