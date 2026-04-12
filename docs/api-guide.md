# MedSeg Cloud — 前端对接指南

本文档帮助前端开发团队快速了解后端 API 结构，顺利对接。详细的请求/响应 Schema 请参考 OpenAPI 文档（`/docs` 或 `/redoc`）。

---

## 1 · 基本约定

| 项目 | 约定 |
| --- | --- |
| 基础路径 | `/api` |
| 数据格式 | JSON（`Content-Type: application/json`） |
| 认证方式 | `Authorization: Bearer <jwt>`（除公开端点外） |
| 国际化 | `Accept-Language: zh` / `en`，影响错误消息语言 |
| 分页 | 暂未实现全局分页，列表接口返回全部 |

### 1.1 认证流程

```
1. POST /api/auth/register       → 注册（无需 token）
2. POST /api/auth/login          → 登录获取 JWT
3. 后续请求携带 Authorization: Bearer <jwt>
```

JWT 默认 24 小时过期。过期后需重新登录。

### 1.2 错误响应格式

所有业务错误返回统一格式：

```json
{
  "detail": {
    "code": 400001,
    "message": "凭证无效",
    "context": {}
  }
}
```

**错误码区段**：

| 区段 | 功能域 |
| --- | --- |
| 400xxx | 认证与授权 |
| 401xxx | 用户管理 |
| 402xxx | 样本管理 |
| 403xxx | 图像管理 |
| 404xxx | 管线与任务 |
| 500xxx | 系统级 |

---

## 2 · 认证 API (`/api/auth`)

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 注册新用户 | 无 |
| POST | `/api/auth/login` | 登录，返回 `access_token` | 无 |

**登录响应示例**：

```json
{
  "access_token": "eyJhbGciOiJI...",
  "token_type": "bearer"
}
```

---

## 3 · 用户 API (`/api/users`)

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/users/me` | 获取当前用户信息 | 用户 |
| PUT | `/api/users/me` | 更新当前用户信息 | 用户 |
| GET | `/api/users` | 用户列表 | 管理员 |
| PUT | `/api/users/{user_id}` | 更新用户信息/角色 | 管理员 |
| DELETE | `/api/users/{user_id}` | 删除用户 | 管理员 |

---

## 4 · 样本库 API (`/api/library`)

样本库采用类文件系统的虚拟目录结构，文件夹和样本集作为两种类型的"项目"统一管理。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/library/contents` | 获取指定目录下的内容（扁平列表） | 用户 |
| GET | `/api/library/tree` | 获取完整目录树（用于移动对话框等） | 用户 |
| GET | `/api/library/path/{folder_id}` | 获取文件夹面包屑路径（祖先链） | 用户 |
| POST | `/api/library/folders` | 创建文件夹（同目录名称唯一） | 用户 |
| PUT | `/api/library/folders/{id}` | 重命名/移动文件夹 | 所有者 |
| DELETE | `/api/library/folders/{id}` | 删除文件夹（`?recursive=true` 级联） | 所有者 |
| POST | `/api/library/batch-move` | 批量移动文件夹/样本集到目标目录 | 所有者 |
| GET | `/api/library/shared` | 浏览共享样本库 | 用户 |
| POST | `/api/library/shared/{sample_set_id}` | 发布样本集到共享库 | 所有者 |
| DELETE | `/api/library/shared/{sample_set_id}` | 撤回共享 | 所有者 |
| POST | `/api/library/shared/{sample_set_id}/copy` | 复制共享样本集到个人库 | 用户 |

### 目录内容响应（`GET /api/library/contents`）

**查询参数**：`folder_id`（UUID，可选，null 为根目录）、`sort_by`（`name`|`created_at`|`updated_at`）、`sort_order`（`asc`|`desc`）

```json
{
  "folder_id": null,
  "breadcrumb": [
    { "id": null, "name": "Library" }
  ],
  "items": [
    {
      "id": "uuid",
      "name": "CT Scans",
      "type": "folder",
      "created_at": "2026-04-12T...",
      "updated_at": "2026-04-12T...",
      "child_count": 5
    },
    {
      "id": "uuid",
      "name": "Patient-001",
      "type": "sample_set",
      "description": "Lung CT study",
      "created_at": "2026-04-12T...",
      "updated_at": "2026-04-12T..."
    }
  ]
}
```

**排序规则**：文件夹始终排在样本集前面，同类型内按指定字段排序。

### 面包屑路径（`GET /api/library/path/{folder_id}`）

```json
[
  { "id": null, "name": "Library" },
  { "id": "uuid", "name": "Research" },
  { "id": "uuid", "name": "CT Scans" }
]
```

### 批量移动（`POST /api/library/batch-move`）

```json
{
  "items": [
    { "type": "folder", "id": "uuid" },
    { "type": "sample_set", "id": "uuid" }
  ],
  "target_folder_id": "uuid 或 null（根目录）"
}
```

### 目录树响应（`GET /api/library/tree`）

完整目录树（保留兼容，主要用于移动对话框的目录浏览）：

```json
{
  "folders": [
    {
      "id": "uuid",
      "name": "CT Scans",
      "parent_id": null,
      "children": [...],
      "sample_sets": [
        { "id": "uuid", "name": "Patient-001" }
      ]
    }
  ],
  "root_sample_sets": [
    { "id": "uuid", "name": "Unsorted" }
  ]
}
```

### 名称唯一性约束

同一目录下（包括根目录），文件夹名称和样本集名称合并去重，不允许同名。创建、重命名、移动操作在目标目录有同名项时返回 `409 Conflict`（错误码 `403006`）。

---

## 5 · 样本集 API (`/api/sample-sets`)

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/sample-sets` | 创建样本集 | 用户 |
| GET | `/api/sample-sets` | 我的样本集列表 | 用户 |
| GET | `/api/sample-sets/{id}` | 样本集详情（含子集列表） | 所有者/管理员 |
| PUT | `/api/sample-sets/{id}` | 更新样本集 | 所有者 |
| DELETE | `/api/sample-sets/{id}` | 删除样本集（级联删除子集与图像） | 所有者 |

---

## 6 · 子集 API (`/api/sample-sets/{set_id}/subsets`)

子集是处理管线的输入输出单位。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `.../subsets` | 子集列表 | 所有者/管理员 |
| GET | `.../subsets/{id}` | 子集详情（含图像列表） | 所有者/管理员 |
| PUT | `.../subsets/{id}` | 重命名子集 | 所有者 |
| DELETE | `.../subsets/{id}` | 删除子集 | 所有者 |

### 关键元数据字段

- `type`：子集类型（由模块定义，如 `raw`, `segmentation`），不做枚举限制
- `metadata`：JSON 元数据
  - 分割结果子集包含 `is_segmentation: true`
  - 包含 `source_module`、`source_subset_id` 等来源信息
- 前端通过 `metadata.is_segmentation` 判断是否为分割结果，触发叠加显示

---

## 7 · 图像 API (`/api/sample-sets/{set_id}/subsets/{subset_id}/images`)

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `.../images` | 上传图像（`multipart/form-data`，字段名 `file`） | 所有者 |
| GET | `.../images` | 图像列表 | 所有者/管理员 |
| GET | `.../images/{id}` | 图像元数据 | 所有者/管理员 |
| GET | `.../images/{id}/download` | 下载图像文件 | 所有者/管理员 |
| DELETE | `.../images/{id}` | 删除图像 | 所有者 |

- 上传时自动检测格式（`.nii`/`.nii.gz` → NIfTI，`.dcm` → DICOM）
- 下载返回 `application/octet-stream`，使用 `Content-Disposition` 附件头

---

## 8 · 管线 API (`/api/pipelines`)

### 8.1 模块查询

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/pipelines/modules` | 所有已注册模块列表 | 用户 |
| GET | `/api/pipelines/modules/{name}` | 单个模块详情 | 用户 |

模块信息包含 `params_schema`（JSON Schema），前端可据此动态渲染参数表单。

### 8.2 管线感知

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/pipelines/awareness/{sample_set_id}` | 获取处理建议 | 所有者/管理员 |

**响应为三级分层结构**：

```json
{
  "primary": {
    "module_name": "normalize",
    "available_subset_ids": [],
    "recommended_subset_ids": ["uuid-1"],
    "reason": "存在原始子集但无标准化子集"
  },
  "suggested": [
    {
      "module_name": "segment",
      "available_subset_ids": ["uuid-2"],
      "recommended_subset_ids": ["uuid-3"],
      "reason": null
    }
  ],
  "available": [
    {
      "module_name": "echo",
      "available_subset_ids": ["uuid-1", "uuid-2"],
      "recommended_subset_ids": [],
      "reason": null
    }
  ]
}
```

| 层级 | 说明 | 前端展示建议 |
| --- | --- | --- |
| `primary` | 最高优先级推荐模块（0 或 1） | 顶部显示为建议操作卡片，附一键运行按钮 |
| `suggested` | 其余推荐模块 | 次级推荐列表 |
| `available` | 可用但无特别推荐 | 折叠在"更多操作"菜单中 |

- `primary` 为 `null` 时表示无推荐操作
- 不可用的模块不会出现在响应中

### 8.3 提交任务

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/pipelines/run` | 提交处理任务 | 所有者/管理员 |

**请求体**：

```json
{
  "module_name": "segment",
  "sample_set_id": "uuid",
  "input_subset_id": "uuid",
  "output_subset_name": "Segmentation Result",
  "params": {}
}
```

- `params` 对象需符合模块的 `params_schema`
- 成功返回 201 + 任务对象
- 参数校验失败立即返回错误，不入队

### 8.4 模块管理（管理员）

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| PUT | `/api/pipelines/modules/{name}/enable` | 启用模块 | 管理员 |
| PUT | `/api/pipelines/modules/{name}/disable` | 禁用模块 | 管理员 |
| POST | `/api/pipelines/modules/{name}/load` | 手动加载模块到 GPU | 管理员 |
| POST | `/api/pipelines/modules/{name}/unload` | 卸载模块释放 GPU | 管理员 |
| GET | `/api/pipelines/resources` | 查看资源使用情况 | 管理员 |

---

## 9 · 任务 API (`/api/tasks`)

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/tasks` | 当前用户任务列表 | 用户 |
| GET | `/api/tasks/{id}` | 任务详情 | 所有者/管理员 |
| DELETE | `/api/tasks/{id}` | 取消排队中的任务 | 所有者/管理员 |
| GET | `/api/tasks/all` | 所有用户的任务列表 | 管理员 |

### 任务状态

```
queued → loading → running → completed
                           → failed
queued → cancelled
```

| 状态 | 说明 |
| --- | --- |
| `queued` | 排队中，可取消 |
| `loading` | 模型加载中 |
| `running` | 处理中 |
| `completed` | 成功完成 |
| `failed` | 失败（自动重试 1 次后仍失败） |
| `cancelled` | 已取消 |

---

## 10 · WebSocket 实时推送 (`/api/ws/tasks`)

### 连接方式

```
ws://host/api/ws/tasks?token=<jwt>
```

- JWT 通过 **query parameter** 传递（非 Header）
- token 无效时连接以代码 `4001` 关闭

### 消息格式

服务端推送 JSON 消息，客户端无需发送消息（连接后被动接收即可）：

```json
{
  "type": "task_status_update",
  "data": {
    "task_id": "uuid",
    "status": "running",
    "queue_position": null,
    "estimated_wait_ms": null
  }
}
```

- 支持多设备同时连接，同一用户的所有设备均收到推送

---

## 11 · 管理后台 API (`/api/admin`)

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/admin/sample-sets` | 所有用户的样本集 | 管理员 |
| DELETE | `/api/admin/shared/{sample_set_id}` | 移除共享样本集 | 管理员 |
| GET | `/api/admin/stats` | 统计信息 | 管理员 |

### 统计响应示例

```json
{
  "user_count": 42,
  "sample_set_count": 156,
  "shared_count": 12
}
```

---

## 12 · 典型前端工作流

### 12.1 样本集浏览与处理

```
1. GET /api/library/tree                     → 展示目录树
2. GET /api/sample-sets/{id}                 → 查看样本集详情（含子集）
3. GET /api/pipelines/awareness/{id}         → 获取处理建议
4. 用户点击建议卡片的一键运行
5. POST /api/pipelines/run                   → 提交任务
6. WebSocket /api/ws/tasks                   → 接收任务状态更新
7. 任务完成后刷新样本集详情查看新子集
```

### 12.2 图像预览与标注

```
1. GET .../subsets/{id}                      → 获取子集详情（含图像列表）
2. GET .../images/{id}/download              → 下载图像数据用于 Cornerstone3D 渲染
3. 若子集 metadata.is_segmentation == true：
   - 从 metadata.source_subset_id 获取源子集
   - 从 metadata.source_image_id_mapping 获取对应原始图像
   - 叠加显示分割 mask
```

### 12.3 共享样本

```
1. POST /api/library/shared/{id}             → 发布到共享库
2. GET /api/library/shared                   → 浏览共享库
3. POST /api/library/shared/{id}/copy        → 复制到个人库
```
