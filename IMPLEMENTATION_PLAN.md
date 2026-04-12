# MedSeg Cloud 前端 — 实施计划

## Stage 1: 项目基础设施
**Goal**: 配置 SPA 模式、安装依赖、暗色模式、API 客户端生成、Vite 代理、认证 Store
**Success Criteria**:
- SPA 模式启用，`pnpm run dev` 正常启动
- 暗色模式切换正常工作
- API 客户端配置就绪（生成配置文件）
- Zustand auth store 创建
- Vite 代理配置完成
**Tests**: 手动验证开发服务器启动、暗色切换
**Status**: Complete

## Stage 2: 认证与布局
**Goal**: 登录/注册页面、认证路由守卫、应用布局（Sidebar + Header）
**Success Criteria**:
- 登录/注册表单可提交，JWT 存入 store
- 未认证用户重定向到登录页
- 已登录用户看到 Sidebar 布局
- 管理员可见管理菜单
**Tests**: 登录/注册流程、路由守卫、Sidebar 导航
**Status**: Complete

## Stage 3: 样本库与样本管理
**Goal**: 目录树浏览、样本集 CRUD、子集列表、图像上传/下载
**Success Criteria**:
- 文件夹/样本集增删改查
- 子集列表展示及元数据
- 图像上传（multipart）和下载
- 共享样本库浏览与复制
**Tests**: 文件夹CRUD、样本集CRUD、图像上传下载
**Status**: Complete

## Stage 4: 管线与任务
**Goal**: 管线感知建议、运行管线对话框（含动态参数表单）、任务中心、WebSocket 实时推送
**Success Criteria**:
- 样本集详情页显示管线感知建议卡片
- 运行管线对话框根据 params_schema 动态渲染表单
- 任务列表显示状态和排队位置
- WebSocket 实时更新任务状态
**Tests**: 管线感知展示、任务提交与状态更新
**Status**: Complete

## Stage 5: 医学影像查看器
**Goal**: Cornerstone3D MPR 三视图、NIfTI/DICOM 加载、分割叠加、标注工具
**Success Criteria**:
- MPR 三视图正确渲染
- NIfTI 和 DICOM 文件加载
- 分割 mask 半透明叠加显示
- 画笔、窗宽窗位、缩放等工具可用
**Tests**: 图像渲染、工具交互、分割叠加
**Status**: Not Started

## Stage 6: 管理后台
**Goal**: 用户管理、模块管理、全局样本库管理、统计信息
**Success Criteria**:
- 用户列表增删改、角色分配
- 模块列表启用/禁用/加载/卸载
- 全局浏览所有用户样本集
- 统计卡片展示
**Tests**: 管理员操作流程
**Status**: Not Started
