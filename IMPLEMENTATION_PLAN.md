# Implementation Plan — 样本集页面增强

## 概述

基于设计文档更新，实施以下功能：
1. 样本集详情页顶部信息区（名称/描述/首选操作/分享）
2. RunPipelineDialog（运行对话框：子集名称输入 + 参数表单 + 覆盖检测）
3. 后端子集名称唯一约束 + overwrite 机制
4. 预览入口（双击图像、右键预览、子集预览、图像导航）
5. 右键菜单更新（添加预览选项、移除分享）

---

## Stage 1: 后端 — 子集名称唯一约束 & overwrite 机制
**Goal**: 后端支持子集名称唯一性校验和覆盖参数传递
**Success Criteria**:
- Subset 模型有 (sample_set_id, name) UniqueConstraint
- Task 模型和 Schema 支持 overwrite 字段
- SampleSetDetail 响应包含 is_shared 字段
- 创建/重命名子集时校验名称唯一性
- 数据库迁移脚本通过
- 后端测试通过
**Tests**:
- 创建同名子集返回 409
- 重命名为已存在名称返回 409
- TaskCreate schema 接受 overwrite 字段
- SampleSetDetail 包含 is_shared
**Status**: Complete

## Stage 2: 前端 — RunPipelineDialog
**Goal**: 实现运行管线对话框，替代当前的直接提交
**Success Criteria**:
- 对话框包含：模块名称显示、输出子集名称输入（含默认值）、参数动态表单、覆盖确认
- 单/批量模式：单子集显示名称输入，多子集显示模板输入+预览
- 前端冲突检测：提交前对比子集列表
- 成功接入右键菜单和首选操作按钮
**Tests**:
- 对话框能正确显示模块参数表单
- 默认名称生成正确（{input_name}_{module_name}）
- 冲突检测能识别已有子集名称
**Status**: Complete

## Stage 3: 前端 — SampleSetHeader 顶部信息区
**Goal**: 样本集详情页顶部显示名称/描述/首选操作/分享
**Success Criteria**:
- 顶部信息区显示样本集名称（可编辑）和描述（可编辑）
- 首选操作按钮（awareness primary 模块）→ 弹出 RunPipelineDialog
- 分享/取消分享按钮（根据 is_shared 状态切换）
- 工具栏中移除首选操作和分享按钮
**Tests**:
- 名称编辑后调用 API 更新
- 分享按钮根据 is_shared 正确显示状态
- 首选操作按钮弹出 RunPipelineDialog
**Status**: Not Started

## Stage 4: 前端 — 预览入口 & 查看器图像导航
**Goal**: 添加所有预览入口，查看器支持子集内图像切换
**Success Criteria**:
- 双击图像跳转查看器（带 imageId 参数）
- 右键图像有「预览」选项
- 右键子集有「预览」选项
- 查看器加载子集全部图像，支持前后切换
- 分割子集预览时自动加载源子集叠加
**Tests**:
- 双击图像导航到正确 URL
- 右键预览行为正确
- 查看器图像切换正常
**Status**: Not Started

## Stage 5: 右键菜单更新 & 清理
**Goal**: 右键菜单添加预览、管线操作弹出对话框、移除分享
**Success Criteria**:
- 子集右键菜单顶部添加「预览」
- 图像右键菜单顶部添加「预览」
- 管线操作改为弹出 RunPipelineDialog
- 工具栏和右键菜单中移除分享操作
**Tests**:
- 右键菜单结构符合设计文档
- 管线操作弹出对话框而非直接提交
**Status**: Not Started
