# Orbit WebSocket 稳定性排查

## 目标

- 定位 anchor 连接 Cloudflare Orbit 时出现握手失败与 heartbeat timeout 的原因，并给出最小修复或诊断增强

## 范围

### In

- services/anchor 与 services/orbit 的 websocket 握手、心跳、重连与鉴权链路

### Out

- 未在创建时指定

## 验收标准

- 明确区分网络/边缘抖动与本地重连策略问题
- 若修改代码，则补充回归测试或最小验证
