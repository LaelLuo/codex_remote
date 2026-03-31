# uv 测试环境修复

## 目标

- 定位并修复仓库在使用 uv 运行 Python 测试时失败的问题

## 范围

### In

- 复现并分析 uv 运行 services/control-plane 测试的失败原因
- 必要时补齐 uv 所需的 Python 项目元数据或测试命令

### Out

- 不处理与测试失败无关的业务功能修改

## 验收标准

- 能够在仓库中用 uv 成功执行 control-plane 测试
- 不影响现有 bun test 流程
