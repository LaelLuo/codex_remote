# 会话权限设定链路修复

## 目标

- 让会话/线程的 sandbox 与 approvalPolicy 真正按设定透传到 thread/start 与 turn/start，并避免 UI 显示与真实后端状态脱节。

## 范围

### In

- threads store、Home/Thread 发送链路、必要测试

### Out

- 新增复杂权限 UI、改后端协议

## 验收标准

- 未在创建时指定
