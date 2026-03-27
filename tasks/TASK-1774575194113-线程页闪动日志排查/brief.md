# 线程页闪动日志排查

## 目标

- 为 thread 页面闪动问题增加开发日志，定位是状态切换还是布局跳动导致

## 范围

### In

- 记录 turnStatus 与 reasoning streaming 的切换时序
- 记录 Thread 页面底部状态区与 console/transcript 高度变化

### Out

- 正式修复行为

## 验收标准

- 浏览器控制台能看到明确的状态切换日志
- 能据日志判断闪动来自哪一层
