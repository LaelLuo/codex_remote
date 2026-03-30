# Decisions

- 暂无。
- 2026-03-30T06:13:44.212Z [agent] 设计边界确认：直接切断 legacy anchorJwtSecret 兼容，不再接受 provider 返回 anchorJwtSecret，也不再消费本地旧 secret 凭据；三套 provider 统一到 anchorAccessToken + anchorRefreshToken，并让 Orbit worker 的 /ws/anchor 改为校验 Anchor access token。
