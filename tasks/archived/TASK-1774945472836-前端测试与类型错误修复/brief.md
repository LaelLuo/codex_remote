# 前端测试与类型错误修复

## 目标

- 修复前端 bun test 与 typecheck 当前失败的问题

## 范围

### In

- 定位并修复前端依赖缺失导致的测试失败
- 定位并修复 Svelte/TypeScript 配置与 rune 宏相关错误

### Out

- 不处理 orbit wrangler 配置改动

## 验收标准

- bun run test 不再因前端模块缺失或 rune 配置问题失败
- bun run typecheck 至少消除当前前端相关错误
