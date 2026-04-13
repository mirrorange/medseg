# Implementation Plan: 样本集内部浏览器 V2

将样本集详情页从简单子集列表升级为文件浏览器风格，支持双视图、右键菜单含管线操作、属性对话框、批量运行等功能。

## Stage 1: Backend — 图像重命名 API
**Goal**: 新增图像重命名接口
**Success Criteria**: `PUT /api/.../images/{id}` 可更新文件名；测试通过
**Tests**: test_image_rename, test_image_rename_not_found
**Status**: Complete

## Stage 2: Backend — 批量任务提交 API
**Goal**: 新增批量提交处理任务接口
**Success Criteria**: `POST /api/pipelines/batch-run` 可为多个子集创建独立任务；测试通过
**Tests**: test_batch_run_pipeline, test_batch_run_empty_list
**Status**: Not Started

## Stage 3: Frontend — Store + 浏览器骨架
**Goal**: 创建 SampleSet Store (Zustand) 和浏览器骨架组件
**Success Criteria**: 样本集详情页可加载子集列表并切换层级（subsets ↔ images）
**Tests**: 页面可正确渲染、切换层级不报错
**Status**: Not Started

## Stage 4: Frontend — 列表/网格视图 + 框选
**Goal**: 实现双视图（列表/网格）和鼠标框选
**Success Criteria**: 子集和图像可在列表/网格视图间切换；支持单击、Ctrl/Shift 多选、框选
**Tests**: 视图渲染正确、选择交互正常
**Status**: Not Started

## Stage 5: Frontend — 右键菜单 + 管线集成 + 工具栏
**Goal**: 实现右键上下文菜单（含管线操作建议）和首选操作按钮
**Success Criteria**: 右键子集显示建议/可用操作；多选显示共有建议；首选按钮批量提交
**Tests**: 右键菜单按层级和选中状态正确渲染
**Status**: Not Started

## Stage 6: Frontend — 对话框 + 清理
**Goal**: 实现所有对话框（新建子集、重命名、删除、属性、上传、运行管线）并移除旧组件
**Success Criteria**: 所有对话框可正确打开/提交/关闭；旧组件已移除；页面功能完整
**Tests**: 对话框操作不报错、API 调用正确
**Status**: Not Started
