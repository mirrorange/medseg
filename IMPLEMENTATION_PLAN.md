## Stage 1: 项目基础设施
**Goal**: 建立数据库连接、迁移工具、测试框架和代码质量工具
**Success Criteria**:
- 数据库异步引擎和会话管理可用
- Alembic 迁移初始化完成
- pytest 测试框架可运行
- Ruff linter/formatter 配置就绪并通过检查
**Tests**:
- 数据库会话可以正常创建和关闭
- pytest 可以发现和运行测试
- `ruff check` 和 `ruff format --check` 通过
**Status**: Complete

## Stage 2: 认证体系
**Goal**: 实现 User 模型、注册/登录 API、JWT 令牌、RBAC 依赖注入
**Success Criteria**:
- User 模型和数据库迁移完成
- 注册/登录 API 正常工作
- JWT 令牌生成和验证正常
- RBAC 依赖注入（get_current_user, require_admin）正常工作
**Tests**:
- 注册新用户成功
- 重复注册返回错误
- 登录成功返回 JWT
- 错误密码登录失败
- JWT 认证保护的端点可访问
- 非管理员访问管理员端点返回 403
**Status**: Complete

## Stage 3: 样本管理
**Goal**: 实现 SampleSet/Subset/Image 模型和 CRUD API、文件上传/下载
**Success Criteria**:
- SampleSet、Subset、Image 模型和迁移完成
- 样本集 CRUD API 正常工作
- 子集 CRUD API 正常工作
- 图像上传/下载/删除 API 正常工作
- 对象存储本地后端可用
**Tests**:
- SampleSet CRUD 操作
- Subset CRUD 操作（含名称冲突检测）
- Image 上传/下载/删除
- 权限检查（所有者/管理员）
- 级联删除正确
**Status**: Not Started

## Stage 4: 样本库
**Goal**: 实现 Folder 模型、目录树 API、共享机制
**Success Criteria**:
- Folder 模型和迁移完成
- 目录树 CRUD API 正常工作
- 共享发布/撤回/复制 API 正常工作
**Tests**:
- Folder 创建/重命名/移动/删除
- 目录树嵌套展示
- 样本集共享和撤回
- 非所有者复制共享样本集
**Status**: Not Started

## Stage 5: 管线子系统
**Goal**: 实现 Pipeline Module Interface、Registry、ResourceManager
**Success Criteria**:
- PipelineModule 抽象基类定义完成
- 模块注册表支持动态发现和注册
- ResourceManager 资源感知和淘汰策略可用
- 至少一个示例模块可注册和运行
**Tests**:
- 模块注册和发现
- 模块启用/禁用
- 资源阈值检查
- 淘汰策略正确性
**Status**: Not Started

## Stage 6: 任务调度
**Goal**: 实现 Scheduler、Task 模型、任务 API
**Success Criteria**:
- Task 模型和迁移完成
- 调度器动态优先级算法正确
- 任务提交/查询/取消 API 正常工作
- 任务失败自动重试
**Tests**:
- 任务提交入队
- 动态优先级计算
- 亲和性奖励验证
- 任务取消
- 失败重试
**Status**: Not Started

## Stage 7: WebSocket 实时通信
**Goal**: 实现 ConnectionManager、任务状态实时推送
**Success Criteria**:
- WebSocket 连接建立和认证正常
- 任务状态变更实时推送到客户端
- 多设备连接支持
- 断开连接自动清理
**Tests**:
- WebSocket 连接和认证
- 任务状态推送
- 连接断开清理
**Status**: Not Started

## Stage 8: 管理后台 API
**Goal**: 实现用户管理、模块管理、全局样本库管理 API
**Success Criteria**:
- 管理员用户管理 API 正常工作
- 管理员模块管理 API 正常工作
- 管理员全局样本库管理 API 正常工作
**Tests**:
- 管理员 CRUD 用户
- 管理员启用/禁用模块
- 管理员查看/管理所有样本
- 非管理员无法访问
**Status**: Not Started
