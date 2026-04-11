# MedSeg Cloud — 后端架构设计文档

| 项目 | 值 |
| --- | --- |
| 文档版本 | v1.0 |
| 对应 PRD 版本 | v1.0 |
| 日期 | 2026-04-11 |
| 状态 | Draft |

---

## 1 · 总体架构

### 1.1 分层架构

系统采用 **分层架构**，自上而下分为五层：

```
┌─────────────────────────────────────────────┐
│             Transport Layer                 │
│      (HTTP Routes / WebSocket / CORS)       │
├─────────────────────────────────────────────┤
│             Service Layer                   │
│   (Business Logic / Orchestration)          │
├─────────────────────────────────────────────┤
│             Domain Layer                    │
│   (Models / Schemas / Pipeline Interface)   │
├─────────────────────────────────────────────┤
│           Infrastructure Layer              │
│ (DB / Storage / Scheduler / Module Loader)  │
├─────────────────────────────────────────────┤
│              Core Layer                     │
│  (Config / Logging / i18n / Exceptions)     │
└─────────────────────────────────────────────┘
```

- **Transport Layer**：HTTP 路由、WebSocket 端点、中间件（认证、CORS）
- **Service Layer**：业务逻辑编排，协调多个基础设施组件
- **Domain Layer**：数据模型定义、API Schema、管线模块接口协议
- **Infrastructure Layer**：数据库访问、对象存储、任务调度器、模块加载器
- **Core Layer**：配置管理、日志、国际化、异常体系（已实现）

### 1.2 目录结构

```
app/
├── main.py                          # FastAPI 应用入口 & lifespan
├── core/                            # 核心基础设施（已有）
│   ├── config.py                    # pydantic-settings 配置
│   ├── exceptions.py                # AppError 异常体系
│   ├── error_handler.py             # 统一错误响应
│   ├── security.py                  # JWT 令牌生成/验证
│   └── static.py                    # SPA 静态文件托管
├── api/                             # Transport Layer
│   ├── main.py                      # API Router 聚合
│   ├── dependencies.py              # 共享依赖注入（认证、分页等）
│   └── routes/
│       ├── auth.py                  # 认证路由
│       ├── users.py                 # 用户管理路由
│       ├── sample_sets.py           # 样本集 CRUD 路由
│       ├── subsets.py               # 子集路由
│       ├── images.py                # 图像上传/下载路由
│       ├── library.py               # 样本库（目录树 + 共享）路由
│       ├── pipelines.py             # 管线模块查询/运行路由
│       ├── tasks.py                 # 任务状态查询路由
│       ├── ws.py                    # WebSocket 端点
│       └── admin.py                 # 管理后台路由
├── models/                          # Domain Layer — 数据库模型
│   ├── user.py
│   ├── sample_set.py
│   ├── subset.py
│   ├── image.py
│   ├── folder.py
│   ├── share.py
│   └── task.py
├── schemas/                         # Domain Layer — API 请求/响应 Schema
│   ├── auth.py
│   ├── user.py
│   ├── sample_set.py
│   ├── subset.py
│   ├── image.py
│   ├── library.py
│   ├── pipeline.py
│   ├── task.py
│   └── common.py                    # 通用分页、排序等
├── services/                        # Service Layer
│   ├── i18n.py                      # 国际化服务（已有）
│   ├── auth.py                      # 认证 & 授权逻辑
│   ├── user.py                      # 用户管理
│   ├── sample_set.py                # 样本集业务逻辑
│   ├── subset.py                    # 子集业务逻辑
│   ├── image.py                     # 图像管理
│   ├── library.py                   # 样本库（目录树 + 共享）
│   ├── pipeline.py                  # 管线模块编排
│   └── task.py                      # 任务管理
├── pipeline/                        # Infrastructure — 管线子系统
│   ├── interface.py                 # Pipeline Module Interface（抽象基类）
│   ├── registry.py                  # 模块注册表 & 动态发现
│   ├── scheduler.py                 # 任务调度器（动态优先级）
│   ├── resource_manager.py          # 资源感知 & 淘汰策略
│   └── modules/                     # 内置/第三方模块目录
│       └── __init__.py
├── db/                              # Infrastructure — 数据库
│   ├── session.py                   # AsyncSession 工厂 & 依赖注入
│   └── init_db.py                   # 数据库初始化 & 迁移
├── storage/                         # Infrastructure — 对象存储
│   ├── base.py                      # 存储后端抽象接口
│   └── local.py                     # 本地文件系统实现
├── utils/                           # 通用工具
│   └── logger.py                    # loguru 配置（已有）
└── locales/                         # i18n 翻译文件（已有）
    ├── en.json
    └── zh.json
```

---

## 2 · 数据库设计

### 2.1 技术选型

| 组件 | 选型 | 说明 |
| --- | --- | --- |
| ORM | SQLModel | 兼具 SQLAlchemy 查询能力和 Pydantic 校验 |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） | SQLModel 屏蔽差异，开发阶段用 SQLite 简化环境 |
| 迁移 | Alembic | SQLAlchemy 生态标准迁移工具 |
| 异步驱动 | aiosqlite / asyncpg | 配合 FastAPI 异步架构 |

### 2.2 核心数据模型

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────┐
│   User   │────<│  SampleSet  │────<│  Subset  │────<│  Image  │
└──────────┘     └─────────────┘     └──────────┘     └─────────┘
     │                  │
     │           ┌──────┴──────┐
     │           │   Folder    │──── 自引用（parent_id）
     │           └─────────────┘
     │                  │
     │           ┌──────┴──────┐
     └──────────>│   Share     │
                 └─────────────┘
                        │
                 ┌──────┴──────┐
                 │    Task     │
                 └─────────────┘
```

#### User

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| username | str | 唯一用户名 |
| email | str | 唯一邮箱 |
| hashed_password | str | bcrypt 哈希密码 |
| role | enum(user, admin) | 角色 |
| is_active | bool | 是否启用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

#### Folder

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| name | str | 文件夹名称 |
| owner_id | UUID FK → User | 所有者 |
| parent_id | UUID FK → Folder (nullable) | 父文件夹（null = 根级） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

#### SampleSet

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| name | str | 样本集名称 |
| description | str (nullable) | 描述 |
| owner_id | UUID FK → User | 所有者 |
| folder_id | UUID FK → Folder (nullable) | 所属文件夹（null = 根级） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

#### Subset

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| sample_set_id | UUID FK → SampleSet | 所属样本集 |
| name | str | 子集名称 |
| type | str | 子集类型（任意字符串，非枚举） |
| metadata | JSON | 子集元数据 |
| source_module | str (nullable) | 生成此子集的管线模块名 |
| source_subset_id | UUID FK → Subset (nullable) | 源子集 |
| source_params | JSON (nullable) | 运行参数快照 |
| created_at | datetime | 创建时间 |

#### Image

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| subset_id | UUID FK → Subset | 所属子集 |
| filename | str | 原始文件名 |
| format | str | 格式标签（DICOM / NIfTI） |
| metadata | JSON | 格式特定元数据 |
| storage_path | str | 对象存储路径 |
| source_image_id | UUID FK → Image (nullable) | 源图像 ID（用于叠加映射） |
| created_at | datetime | 创建时间 |

#### Share

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| sample_set_id | UUID FK → SampleSet | 共享的样本集 |
| shared_by | UUID FK → User | 分享者 |
| created_at | datetime | 分享时间 |

#### Task

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 主键 |
| user_id | UUID FK → User | 提交者 |
| module_name | str | 目标处理模块名 |
| sample_set_id | UUID FK → SampleSet | 相关样本集 |
| input_subset_id | UUID FK → Subset | 输入子集 |
| output_subset_name | str | 输出子集名称 |
| params | JSON (nullable) | 运行参数 |
| status | enum(queued, loading, running, completed, failed) | 任务状态 |
| queue_position | int (nullable) | 排队位置 |
| error_message | str (nullable) | 失败原因 |
| retry_count | int | 已重试次数 |
| created_at | datetime | 创建时间（入队时间） |
| started_at | datetime (nullable) | 开始执行时间 |
| completed_at | datetime (nullable) | 完成时间 |

### 2.3 数据库会话管理

```python
# app/db/session.py — 简化示意
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.database_url)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
```

通过 FastAPI 的 `Depends(get_session)` 注入到路由和服务中。

---

## 3 · 认证与授权

### 3.1 认证流程

```
Client                          Server
  │                               │
  │  POST /api/auth/login         │
  │  {username, password}         │
  │──────────────────────────────>│
  │                               │── 校验密码（bcrypt）
  │  {access_token, token_type}   │── 生成 JWT
  │<──────────────────────────────│
  │                               │
  │  GET /api/...                 │
  │  Authorization: Bearer <jwt>  │
  │──────────────────────────────>│
  │                               │── 验证 JWT → 提取 user_id
  │  200 Response                 │
  │<──────────────────────────────│
```

### 3.2 JWT 令牌

| 项目 | 值 |
| --- | --- |
| 算法 | HS256 |
| Payload | `sub` (user_id), `role`, `exp`, `iat` |
| 过期时间 | 可配置（默认 24h） |
| 依赖库 | PyJWT (python-jose) |

### 3.3 RBAC 权限控制

通过 FastAPI 依赖注入实现：

```python
# app/api/dependencies.py — 简化示意
async def get_current_user(token: str = Depends(oauth2_scheme), ...) -> User:
    """验证 JWT，返回当前用户"""

async def require_admin(user: User = Depends(get_current_user)) -> User:
    """要求管理员角色"""

async def require_owner(resource_owner_id: UUID, user: User = Depends(get_current_user)) -> User:
    """要求资源所有者或管理员"""
```

权限规则：

| 操作 | 普通用户 | 管理员 |
| --- | --- | --- |
| 管理自己的样本库 | ✅ | ✅ |
| 查看共享样本库 | ✅（只读） | ✅ |
| 运行处理管线 | ✅（自己的样本） | ✅（所有样本） |
| 用户管理 | ❌ | ✅ |
| 模块管理（启用/禁用） | ❌ | ✅ |
| 全局样本库管理 | ❌ | ✅ |

---

## 4 · API 设计

### 4.1 总体约定

| 项目 | 约定 |
| --- | --- |
| 基础路径 | `/api` |
| 版本策略 | URL 不含版本号，通过 Header 或文档版本区分 |
| 响应格式 | JSON |
| 分页 | `?page=1&page_size=20`，响应中包含 `total` |
| 排序 | `?sort_by=created_at&order=desc` |
| 错误响应 | 统一 `{"detail": {"code": int, "message": str, "context": dict}}` |
| 认证 | `Authorization: Bearer <jwt>`（除公开端点外） |
| 国际化 | `Accept-Language` 头控制错误消息语言 |

### 4.2 路由总览

#### 认证 (`/api/auth`)

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录，返回 JWT |

#### 用户 (`/api/users`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/users/me` | 获取当前用户信息 | 已认证 |
| PUT | `/api/users/me` | 更新当前用户信息 | 已认证 |
| GET | `/api/users` | 用户列表 | 管理员 |
| PUT | `/api/users/{user_id}` | 更新用户（角色等） | 管理员 |
| DELETE | `/api/users/{user_id}` | 删除用户 | 管理员 |

#### 样本库 (`/api/library`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/library/tree` | 获取当前用户目录树 | 已认证 |
| POST | `/api/library/folders` | 创建文件夹 | 已认证 |
| PUT | `/api/library/folders/{folder_id}` | 重命名/移动文件夹 | 所有者 |
| DELETE | `/api/library/folders/{folder_id}` | 删除文件夹 | 所有者 |
| GET | `/api/library/shared` | 浏览共享样本库 | 已认证 |
| POST | `/api/library/shared/{sample_set_id}` | 发布到共享库 | 所有者 |
| DELETE | `/api/library/shared/{sample_set_id}` | 撤回共享 | 所有者 |
| POST | `/api/library/shared/{sample_set_id}/copy` | 复制到个人库 | 已认证 |

#### 样本集 (`/api/sample-sets`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/sample-sets` | 创建样本集 | 已认证 |
| GET | `/api/sample-sets/{id}` | 获取样本集详情（含子集列表） | 所有者/管理员 |
| PUT | `/api/sample-sets/{id}` | 更新样本集（名称/描述/位置） | 所有者 |
| DELETE | `/api/sample-sets/{id}` | 删除样本集（级联删除子集和图像） | 所有者 |
| GET | `/api/sample-sets/{id}/awareness` | 获取管线感知建议 | 所有者/管理员 |

#### 子集 (`/api/sample-sets/{set_id}/subsets`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/sample-sets/{set_id}/subsets/{id}` | 获取子集详情（含图像列表） | 所有者/管理员 |
| PUT | `/api/sample-sets/{set_id}/subsets/{id}` | 更新子集（名称） | 所有者 |
| DELETE | `/api/sample-sets/{set_id}/subsets/{id}` | 删除子集 | 所有者 |

#### 图像 (`/api/sample-sets/{set_id}/subsets/{subset_id}/images`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/sample-sets/{set_id}/subsets/{subset_id}/images` | 上传图像（multipart） | 所有者 |
| GET | `/api/.../images/{id}` | 获取图像元数据 | 所有者/管理员 |
| GET | `/api/.../images/{id}/download` | 下载图像文件 | 所有者/管理员 |
| DELETE | `/api/.../images/{id}` | 删除图像 | 所有者 |

#### 管线 (`/api/pipelines`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/pipelines/modules` | 列出所有已启用模块（含参数声明） | 已认证 |
| GET | `/api/pipelines/modules/{name}` | 获取单个模块详情 | 已认证 |
| POST | `/api/pipelines/run` | 提交处理任务 | 已认证 |
| PUT | `/api/pipelines/modules/{name}/enable` | 启用模块 | 管理员 |
| PUT | `/api/pipelines/modules/{name}/disable` | 禁用模块 | 管理员 |
| POST | `/api/pipelines/modules/{name}/load` | 手动加载模块 | 管理员 |
| POST | `/api/pipelines/modules/{name}/unload` | 手动卸载模块 | 管理员 |
| GET | `/api/pipelines/resources` | 查看资源使用情况 | 管理员 |

#### 任务 (`/api/tasks`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/tasks` | 当前用户任务列表 | 已认证 |
| GET | `/api/tasks/{id}` | 任务详情（状态、位置、时间） | 所有者/管理员 |
| DELETE | `/api/tasks/{id}` | 取消排队中的任务 | 所有者 |
| GET | `/api/tasks/all` | 所有用户任务列表 | 管理员 |

#### WebSocket (`/api/ws`)

| 路径 | 说明 |
| --- | --- |
| `/api/ws/tasks` | 实时推送任务状态变更 |

#### 管理 (`/api/admin`)

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/admin/sample-sets` | 查看所有用户的样本集 | 管理员 |
| DELETE | `/api/admin/shared/{sample_set_id}` | 移除共享样本集 | 管理员 |
| GET | `/api/admin/stats` | 存储使用量统计 | 管理员 |

---

## 5 · 可插拔处理管线

### 5.1 模块接口协议

所有处理模块必须实现 `PipelineModule` 抽象基类：

```python
# app/pipeline/interface.py — 简化示意

class ModuleInfo(BaseModel):
    name: str                         # 全局唯一标识
    version: str
    description: str
    suggestion_priority: int          # 建议优先级（越小越高）
    max_ram_mb: int                   # 声明所需最大内存
    max_vram_mb: int                  # 声明所需最大显存
    params_schema: type[BaseModel] | None  # 运行参数 Pydantic Schema

class AvailabilityResult(BaseModel):
    status: Literal["unavailable", "available", "recommended"]
    target_subset_ids: list[UUID]
    reason: str | None = None

class PipelineModule(ABC):
    @abstractmethod
    def module_info(self) -> ModuleInfo: ...

    @abstractmethod
    async def check_availability(self, sample_set_meta: dict) -> AvailabilityResult: ...

    @abstractmethod
    async def load(self) -> None: ...

    @abstractmethod
    async def unload(self) -> None: ...

    @abstractmethod
    async def run(self, input_subset: SubsetRunContext) -> SubsetRunResult: ...
```

### 5.2 模块注册与发现

```python
# app/pipeline/registry.py — 职责

class ModuleRegistry:
    """
    - 启动时：扫描 app/pipeline/modules/ 目录，发现并注册实现了 PipelineModule 的类
    - 运行时：维护已注册模块字典 {name: PipelineModule}
    - 提供：列出所有模块、按名查找、启用/禁用状态管理
    """
```

发现机制：基于 Python 的 `importlib` 动态导入，扫描 `modules/` 目录下的 `.py` 文件，查找 `PipelineModule` 子类。

### 5.3 资源管理器

```python
# app/pipeline/resource_manager.py — 职责

class ResourceManager:
    """
    - 跟踪已加载模块及其资源占用
    - 加载前检查：已占用 + 待加载 ≤ 阈值（可配置，默认 80%）
    - 触发淘汰策略（按 FR-2.3）：
      1. 优先卸载队列为空的已加载模块
      2. 其次卸载队头等待时间最短的模块
    - 若淘汰后仍不足，拒绝加载并返回资源不足错误
    """
```

---

## 6 · 任务调度器

### 6.1 架构

```
提交任务
   │
   ▼
┌──────────────────────────────────┐
│        Module Queue Group        │
│  ┌────────┐ ┌────────┐          │
│  │Queue A │ │Queue B │  ...     │  ← 每个模块一个 FIFO 队列
│  └───┬────┘ └───┬────┘          │
└──────┼──────────┼───────────────┘
       │          │
       ▼          ▼
┌──────────────────────────────────┐
│      Dynamic Priority Scorer     │
│                                  │
│  P_i(t) = W_i(t) + B·I(M_i∈L)  │  ← 选择得分最高的队头任务
│                                  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│       Resource Manager           │
│  已加载？→ 直接执行              │
│  未加载？→ 淘汰 → 加载 → 执行    │
└──────────────┬───────────────────┘
               │
               ▼
          执行任务
               │
               ▼
         WebSocket 推送状态
```

### 6.2 调度循环

调度器以 **事件驱动** 方式运行：

1. **触发时机**：新任务入队、当前任务完成/失败
2. **选择逻辑**：遍历所有非空队列，计算各队头任务的 $P_i(t) = W_i(t) + B \cdot I(M_i \in L)$，选取得分最大者
3. **执行流程**：
   - 模块已加载 → 直接执行
   - 模块未加载 → 调用 ResourceManager 执行淘汰+加载 → 执行
4. **状态推送**：任务状态变更时通过 WebSocket 推送
5. **失败重试**：任务失败后自动重试 1 次，重试仍失败则标记最终失败

### 6.3 配置参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `affinity_bonus_ms` (B) | 60000 | 亲和性奖励（毫秒），已加载模块的额外优先级 |
| `resource_threshold_ratio` | 0.8 | 资源使用阈值比例 |
| `max_retry_count` | 1 | 任务最大重试次数 |

---

## 7 · 对象存储

### 7.1 抽象接口

```python
# app/storage/base.py — 简化示意

class StorageBackend(ABC):
    @abstractmethod
    async def save(self, path: str, data: bytes | BinaryIO) -> str: ...

    @abstractmethod
    async def load(self, path: str) -> bytes: ...

    @abstractmethod
    async def delete(self, path: str) -> None: ...

    @abstractmethod
    async def exists(self, path: str) -> bool: ...
```

### 7.2 存储路径规范

```
{storage_root}/
└── {user_id}/
    └── {sample_set_id}/
        └── {subset_id}/
            └── {image_id}.{ext}
```

### 7.3 实现策略

| 阶段 | 后端 | 说明 |
| --- | --- | --- |
| 开发/MVP | `LocalStorageBackend` | 本地文件系统，零配置 |
| 生产 | `S3StorageBackend` | S3 兼容存储（按需实现） |

通过配置项 `storage_backend` 切换，服务层仅依赖抽象接口。

---

## 8 · WebSocket 实时通信

### 8.1 连接管理

```python
# 连接流程
# 1. 客户端连接 /api/ws/tasks?token=<jwt>
# 2. 服务端验证 JWT，提取 user_id
# 3. 注册到 ConnectionManager（user_id → WebSocket 映射）
# 4. 保持连接，服务端主动推送
```

### 8.2 推送消息格式

```json
{
  "type": "task_status_update",
  "data": {
    "task_id": "uuid",
    "status": "queued | loading | running | completed | failed",
    "queue_position": 3,
    "estimated_wait_ms": 45000
  }
}
```

### 8.3 连接管理器

```python
class ConnectionManager:
    """
    - 维护 user_id → set[WebSocket] 映射（支持多设备）
    - 提供 send_to_user(user_id, message) 方法
    - 自动清理断开的连接
    """
```

---

## 9 · 配置扩展

在现有 `app/core/config.py` 的 `Settings` 类中增加以下配置项：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `database_url` | `sqlite+aiosqlite:///./medseg.db` | 数据库连接字符串 |
| `jwt_secret_key` | (必填) | JWT 签名密钥 |
| `jwt_algorithm` | `HS256` | JWT 算法 |
| `jwt_expire_minutes` | `1440` (24h) | JWT 过期时间 |
| `storage_backend` | `local` | 存储后端类型 |
| `storage_root` | `./storage` | 本地存储根目录 |
| `modules_dir` | `app/pipeline/modules` | 管线模块扫描目录 |
| `affinity_bonus_ms` | `60000` | 调度器亲和性奖励 |
| `resource_threshold_ratio` | `0.8` | 资源使用阈值比例 |
| `max_retry_count` | `1` | 任务最大重试次数 |

---

## 10 · 错误码规范

延续现有 `AppError` 的 6 位错误码体系，按功能域划分区段：

| 区段 | 功能域 | 示例 |
| --- | --- | --- |
| 400xxx | 认证与授权 | 400001 凭证无效、400002 令牌过期、400003 权限不足 |
| 401xxx | 用户管理 | 401001 用户已存在、401002 用户不存在 |
| 402xxx | 样本管理 | 402001 样本集不存在、402002 子集名称冲突 |
| 403xxx | 图像管理 | 403001 图像格式不支持、403002 文件过大 |
| 404xxx | 管线与任务 | 404001 模块不存在、404002 模块不可用、404003 资源不足 |
| 500xxx | 系统级 | 500000 内部错误（已有） |

---

## 11 · 关键依赖清单

在现有依赖基础上，需新增：

| 依赖 | 用途 |
| --- | --- |
| `alembic` | 数据库迁移 |
| `aiosqlite` | SQLite 异步驱动（开发阶段） |
| `python-jose[cryptography]` | JWT 编解码 |
| `passlib[bcrypt]` | 密码哈希 |
| `python-multipart` | 文件上传支持 |
| `websockets` | WebSocket 支持 |

开发/测试依赖：

| 依赖 | 用途 |
| --- | --- |
| `pytest` | 测试框架 |
| `pytest-asyncio` | 异步测试支持 |
| `httpx` | 测试用 HTTP 客户端 |
| `ruff` | Linter & Formatter |

---

## 12 · 实施路径建议

按依赖关系和复杂度，建议分阶段实施：

| 阶段 | 内容 | 前置依赖 |
| --- | --- | --- |
| **Stage 1** | 项目基础设施：数据库连接、Alembic 迁移、测试框架、Ruff 配置 | 无 |
| **Stage 2** | 认证体系：User 模型、注册/登录 API、JWT、RBAC 依赖注入 | Stage 1 |
| **Stage 3** | 样本管理：SampleSet/Subset/Image 模型、CRUD API、文件上传/下载 | Stage 2 |
| **Stage 4** | 样本库：Folder 模型、目录树 API、共享机制 | Stage 3 |
| **Stage 5** | 管线子系统：Module Interface、Registry、ResourceManager | Stage 1 |
| **Stage 6** | 任务调度：Scheduler、Task 模型、任务 API | Stage 5 |
| **Stage 7** | WebSocket：ConnectionManager、任务状态实时推送 | Stage 6 |
| **Stage 8** | 管理后台 API：用户管理、模块管理、全局样本库管理 | Stage 2 + Stage 5 |
