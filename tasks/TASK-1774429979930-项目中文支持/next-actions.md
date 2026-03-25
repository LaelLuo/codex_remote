# Next Actions

## Open

- NA-1774461604000 继续盘点 `socket` RPC 请求层（如 `#requestRpc` / `#requestOrbitControl`）在 send 失败分支的 Error 文本回退，评估是否要统一 descriptor 透传到 Settings/其他页面。
  - status: open
  - created_at: 2026-03-26T02:00:04+08:00
  - source: agent

## Closed

- NA-1774452873000 下一轮聚焦 `socket.send` / `messages.interrupt` 等链路残余自由文本，评估是否需要统一 descriptor fallback 并补最小测试。
  - status: done
  - created_at: 2026-03-25T20:54:33+08:00
  - closed_at: 2026-03-26T02:00:04+08:00
  - closed_by: agent
  - source: agent

- NA-1774450837000 下一轮聚焦 threads 启动失败与剩余 submitError 路径的 descriptor/key 改造，收敛跨页面错误文案一致性。
  - status: done
  - created_at: 2026-03-25T12:20:37.000Z
  - closed_at: 2026-03-25T20:54:33+08:00
  - closed_by: agent
  - source: agent

- NA-1774451186000 返修 socket RPC fallback 提前翻译问题，确保 Settings config 错误提示可随语言切换刷新。
  - status: done
  - created_at: 2026-03-25T12:26:26.000Z
  - closed_at: 2026-03-25T12:26:26.000Z
  - closed_by: agent
  - source: agent

- NA-1774449208165 盘点剩余英文收尾项，区分品牌词、无障碍标签、示例占位符与仍需本地化的辅助界面文案。
  - status: done
  - created_at: 2026-03-25T19:53:28.1654606+08:00
  - closed_at: 2026-03-25T12:20:37.000Z
  - closed_by: agent
  - source: agent

- NA-1774448884000 等待人工 review 第三阶段组件本地化结果，并确认下一批辅助组件范围。
  - status: done
  - created_at: 2026-03-25T11:48:04.000Z
  - closed_at: 2026-03-25T19:53:28.1654606+08:00
  - closed_by: agent
  - source: agent

- NA-1774448460438 规划第三阶段范围，优先处理 ProjectPicker / WorktreeModal 与其余共享辅助组件的剩余英文文案。
  - status: done
  - created_at: 2026-03-25T19:41:00.4388268+08:00
  - closed_at: 2026-03-25T11:48:04.000Z
  - closed_by: agent
  - source: agent

- NA-1774447837000 等待人工复查本轮返修，确认第二阶段可收口并进入下一批页面翻译。
  - status: done
  - created_at: 2026-03-25T11:30:37.000Z
  - closed_at: 2026-03-25T19:41:00.4388268+08:00
  - closed_by: agent
  - source: agent

- NA-1774447572000 跟进人工 review 结果，按反馈继续收敛第二阶段遗漏文案与边界。
  - status: done
  - created_at: 2026-03-25T11:26:12.000Z
  - closed_at: 2026-03-25T11:30:37.000Z
  - closed_by: agent
  - source: agent

- NA-1774435556683 规划第二阶段范围，优先处理 Thread/Device 页面与剩余主流程英文文案。
  - status: done
  - created_at: 2026-03-25T10:45:56.683Z
  - closed_at: 2026-03-25T11:26:12.000Z
  - closed_by: agent
  - source: agent

- NA-1774430026424 确定第一阶段的优先范围与验收标准。
  - status: done
  - created_at: 2026-03-25T09:13:46.424Z
  - closed_at: 2026-03-25T10:45:56.472Z
  - closed_by: agent
  - source: agent

- NA-1774429979940 补充相关上下文引用与 affected repos
  - status: obsolete
  - created_at: 2026-03-25T09:12:59.939Z
  - closed_at: 2026-03-25T10:45:16.341Z
  - source: agent
  - reason: 当前阶段聚焦单仓库 Web UI 主流程，无额外 affected repos。

- NA-1774429979941 开始执行后记录首条实质性进展
  - status: done
  - created_at: 2026-03-25T09:12:59.939Z
  - closed_at: 2026-03-25T10:45:16.306Z
  - closed_by: agent
  - source: agent

- NA-1774429979939 回读 brief.md，确认本轮目标与边界
  - status: done
  - created_at: 2026-03-25T09:12:59.939Z
  - closed_at: 2026-03-25T10:45:16.247Z
  - closed_by: agent
  - source: agent
