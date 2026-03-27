# 多设备项目选择修复

## 目标

- 修复多设备连接时主页项目/worktree 选择流程未带 anchorId 导致提示先选择设备的问题

## 范围

### In

- 前端 socket/worktrees/project-picker/worktree-modal 链路

### Out

- 未在创建时指定

## 验收标准

- 在远程多设备模式下浏览目录、检查 git repo、列出/创建/删除/prune worktree 都会命中已选设备
- 为 anchorId 透传补充回归测试
