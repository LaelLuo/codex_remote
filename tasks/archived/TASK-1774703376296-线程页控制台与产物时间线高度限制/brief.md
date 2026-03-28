# 线程页控制台与产物时间线高度限制

## 目标

- 为线程页的对话控制台与产物时间线增加最大高度和内部滚动，避免长内容导致页面过长影响阅读

## 范围

### In

- src/routes/Thread.svelte,src/lib/components/ArtifactsTimeline.svelte,必要的测试或任务记录

### Out

- Git 面板交互重做、折叠/拖拽尺寸、数据逻辑改动

## 验收标准

- thread console 与 artifacts timeline 在长内容下都有最大高度且内部滚动；桌面和移动端都不出现明显布局回退
