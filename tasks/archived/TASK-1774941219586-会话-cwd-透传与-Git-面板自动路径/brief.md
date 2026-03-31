# 会话 cwd 透传与 Git 面板自动路径

## 目标

- 让 codex_remote 使用 app server 已返回的线程 cwd，Git 状态面板无需依赖手动填路径或本地猜测。

## 范围

### In

- 修复 thread/list、thread/resume、thread/start 的 cwd 消费链路；让线程页 GitStatusPanel 优先使用真实会话 cwd。

### Out

- 不修改 wrangler 配置；不碰 Orbit 稳定性任务。

## 验收标准

- 线程页打开已有会话时 Git 面板可直接使用真实 cwd；跨 app server / 跨浏览器恢复会话时路径仍正确；有回归测试覆盖。
