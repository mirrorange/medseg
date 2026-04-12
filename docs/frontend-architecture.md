# MedSeg Cloud — 前端架构设计文档

| 项目 | 值 |
| --- | --- |
| 文档版本 | v1.0 |
| 对应 PRD 版本 | v1.0 |
| 日期 | 2026-04-12 |
| 状态 | Draft |

---

## 1 · 总体架构

### 1.1 技术栈

| 层级 | 技术选型 | 说明 |
| --- | --- | --- |
| 框架 | React 19 + React Router v7 | SPA 模式，客户端路由 |
| 样式 | Tailwind CSS v4 + Shadcn UI (radix-nova) | 实用优先 CSS + 无样式组件库，黑白中性色系 |
| 状态管理 | Zustand v5 | 轻量级 Hook-based 状态管理 |
| API 客户端 | @hey-api/openapi-ts + @hey-api/client-fetch | 从 OpenAPI Schema 生成类型安全的 SDK |
| 医学影像 | Cornerstone3D v2 + Cornerstone Tools | NIfTI/DICOM 体积渲染、MPR 视图、分割标注 |
| 实时通信 | 原生 WebSocket | 任务状态实时推送 |
| 图标 | Lucide React | 与 Shadcn UI 配套的图标库 |
| 构建工具 | Vite 8 | 快速 HMR 开发体验 |
| 包管理器 | pnpm | 高效磁盘利用 |

### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    Pages (路由页面)                       │
│        routes/ — 页面组件、loader、action                 │
├─────────────────────────────────────────────────────────┤
│                  Features (功能模块)                      │
│         features/ — 按业务域组织的组件与逻辑               │
├─────────────────────────────────────────────────────────┤
│                Shared Components (共享层)                 │
│        components/ui/ — Shadcn UI 基础组件                │
│        components/ — 跨功能的复合组件                      │
├─────────────────────────────────────────────────────────┤
│                  Services (服务层)                        │
│         api/ — OpenAPI 生成的 SDK 客户端                  │
│         stores/ — Zustand 全局状态                        │
│         lib/ — 工具函数、WebSocket 管理                   │
├─────────────────────────────────────────────────────────┤
│                   Core (核心层)                           │
│        providers/ — ThemeProvider、AuthProvider           │
│        hooks/ — 共用的自定义 Hooks                        │
│        types/ — 全局类型定义                              │
└─────────────────────────────────────────────────────────┘
```

**依赖规则**：上层可依赖下层，同层之间通过 stores 或 hooks 通信，禁止下层反向依赖上层。

### 1.3 目录结构

```
front/
├── app/
│   ├── root.tsx                        # 根布局（HTML shell、ThemeProvider、AuthProvider）
│   ├── routes.ts                       # React Router 路由表定义
│   ├── app.css                         # Tailwind 入口 + CSS 变量（已有）
│   │
│   ├── routes/                         # 📄 路由页面（按 URL 路径组织）
│   │   ├── home.tsx                    # / — 首页（已登录重定向到 library）
│   │   ├── login.tsx                   # /login — 登录页
│   │   ├── register.tsx                # /register — 注册页
│   │   │
│   │   ├── layout.tsx                  # /app 已认证区域布局（Sidebar + Header + Outlet）
│   │   ├── library.tsx                 # /app/library — 样本库（目录树）
│   │   ├── shared-library.tsx          # /app/shared — 共享样本库
│   │   ├── sample-set.$id.tsx          # /app/sample-sets/:id — 样本集详情
│   │   ├── viewer.$setId.$subsetId.tsx # /app/viewer/:setId/:subsetId — 图像预览/标注
│   │   ├── tasks.tsx                   # /app/tasks — 任务中心
│   │   │
│   │   └── admin/                      # /app/admin — 管理后台
│   │       ├── layout.tsx              # 管理后台布局
│   │       ├── users.tsx               # 用户管理
│   │       ├── modules.tsx             # 模块管理
│   │       └── sample-sets.tsx         # 全局样本库管理
│   │
│   ├── features/                       # 🧩 功能模块（按业务域划分）
│   │   ├── auth/                       # 认证模块
│   │   │   ├── login-form.tsx
│   │   │   └── register-form.tsx
│   │   │
│   │   ├── library/                    # 样本库模块
│   │   │   ├── folder-tree.tsx         # 目录树组件
│   │   │   ├── folder-tree-item.tsx    # 树节点
│   │   │   ├── sample-set-card.tsx     # 样本集卡片
│   │   │   ├── create-folder-dialog.tsx
│   │   │   └── create-sample-set-dialog.tsx
│   │   │
│   │   ├── sample-set/                 # 样本集详情模块
│   │   │   ├── subset-list.tsx         # 子集列表
│   │   │   ├── subset-card.tsx         # 子集卡片
│   │   │   ├── image-upload.tsx        # 图像上传组件
│   │   │   ├── pipeline-awareness.tsx  # 管线感知建议卡片
│   │   │   └── run-pipeline-dialog.tsx # 运行管线对话框（含动态参数表单）
│   │   │
│   │   ├── viewer/                     # 医学影像查看器模块
│   │   │   ├── cornerstone-viewport.tsx  # 单个 Cornerstone 视口组件
│   │   │   ├── mpr-viewer.tsx            # MPR 三视图布局
│   │   │   ├── segmentation-overlay.tsx  # 分割 mask 叠加控制
│   │   │   ├── toolbar.tsx               # 工具栏（窗宽窗位、缩放、标注工具）
│   │   │   └── cornerstone-init.ts       # Cornerstone3D 初始化逻辑
│   │   │
│   │   ├── tasks/                      # 任务模块
│   │   │   ├── task-list.tsx           # 任务列表
│   │   │   ├── task-card.tsx           # 任务状态卡片
│   │   │   └── task-progress.tsx       # 进度指示器
│   │   │
│   │   └── admin/                      # 管理后台模块
│   │       ├── user-table.tsx
│   │       ├── module-table.tsx
│   │       └── stats-cards.tsx
│   │
│   ├── components/                     # 🔧 共享组件
│   │   ├── ui/                         # Shadcn UI 组件（由 CLI 生成）
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   ├── app-sidebar.tsx             # 应用侧边栏（导航菜单）
│   │   ├── mode-toggle.tsx             # 暗色模式切换
│   │   ├── user-menu.tsx               # 用户头像下拉菜单
│   │   ├── confirm-dialog.tsx          # 通用确认对话框
│   │   ├── empty-state.tsx             # 空状态占位
│   │   ├── loading-spinner.tsx         # 加载指示器
│   │   └── dynamic-form.tsx            # 基于 JSON Schema 的动态表单渲染器
│   │
│   ├── api/                            # 🔌 API 客户端（自动生成）
│   │   ├── client.gen.ts               # @hey-api 生成的 HTTP 客户端
│   │   ├── sdk.gen.ts                  # @hey-api 生成的 SDK 函数
│   │   ├── types.gen.ts                # @hey-api 生成的 TypeScript 类型
│   │   └── index.ts                    # 客户端配置与初始化
│   │
│   ├── stores/                         # 📦 全局状态（Zustand）
│   │   ├── auth.ts                     # 认证状态（token、用户信息）
│   │   ├── task.ts                     # 任务列表 & WebSocket 推送状态
│   │   └── theme.ts                    # 主题状态（可选，ThemeProvider 已处理）
│   │
│   ├── providers/                      # 🏗 全局 Provider
│   │   ├── theme-provider.tsx          # 暗色模式 Provider
│   │   └── auth-provider.tsx           # 认证上下文 Provider
│   │
│   ├── hooks/                          # 🪝 自定义 Hooks
│   │   ├── use-auth.ts                 # 认证状态访问
│   │   ├── use-websocket.ts            # WebSocket 连接管理
│   │   └── use-cornerstone.ts          # Cornerstone3D 生命周期管理
│   │
│   ├── lib/                            # 🛠 工具函数
│   │   ├── utils.ts                    # cn() 等工具（已有）
│   │   ├── api-client.ts              # API 客户端配置（baseUrl、拦截器）
│   │   └── websocket.ts               # WebSocket 客户端封装
│   │
│   └── types/                          # 📝 全局类型
│       └── index.ts                    # 补充类型定义
│
├── public/                             # 静态资源
├── components.json                     # Shadcn UI 配置（已有）
├── openapi-ts.config.ts                # OpenAPI 代码生成配置
├── package.json
├── tsconfig.json
├── vite.config.ts
└── react-router.config.ts
```

---

## 2 · 路由设计

### 2.1 路由模式

采用 **SPA 模式**（`ssr: false`），所有路由在客户端渲染。React Router v7 Framework mode 提供类型安全的路由参数和数据加载。

```ts
// react-router.config.ts
export default {
  ssr: false,
} satisfies Config;
```

### 2.2 路由表

```ts
// app/routes.ts
import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // 公开路由
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),

  // 已认证区域
  layout("routes/layout.tsx", [
    route("app/library", "routes/library.tsx"),
    route("app/shared", "routes/shared-library.tsx"),
    route("app/sample-sets/:id", "routes/sample-set.$id.tsx"),
    route("app/viewer/:setId/:subsetId", "routes/viewer.$setId.$subsetId.tsx"),
    route("app/tasks", "routes/tasks.tsx"),

    // 管理后台
    layout("routes/admin/layout.tsx", [
      route("app/admin/users", "routes/admin/users.tsx"),
      route("app/admin/modules", "routes/admin/modules.tsx"),
      route("app/admin/sample-sets", "routes/admin/sample-sets.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
```

### 2.3 路由守卫

通过 **layout route** 的 `clientLoader` 实现认证守卫：

```ts
// routes/layout.tsx
import type { Route } from "./+types/layout";
import { redirect } from "react-router";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw redirect("/login");
  }
  // 验证 token 有效性，获取用户信息
  const user = await getMe();
  return { user };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={loaderData.user} />
      <main className="flex-1">
        <Header />
        <Outlet />
      </main>
    </SidebarProvider>
  );
}
```

管理后台通过嵌套 layout 进一步校验 `role === "admin"`。

---

## 3 · API 对接

### 3.1 OpenAPI 代码生成

使用 `@hey-api/openapi-ts` 从后端 OpenAPI Schema 自动生成类型安全的 API 客户端。

**配置文件**：

```ts
// openapi-ts.config.ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/api/openapi.json", // FastAPI 自动生成的 OpenAPI Schema
  output: {
    path: "app/api",
    entryFile: true,
  },
  plugins: [
    "@hey-api/typescript",     // 生成 TypeScript 类型
    "@hey-api/sdk",            // 生成 SDK 函数
    "@hey-api/client-fetch",   // 使用 Fetch API 作为 HTTP 客户端
  ],
});
```

**生成命令**（添加到 `package.json` scripts）：

```json
{
  "scripts": {
    "api:generate": "openapi-ts"
  }
}
```

### 3.2 客户端配置

```ts
// app/lib/api-client.ts
import { client } from "~/api/client.gen";

export function setupApiClient() {
  client.setConfig({
    baseUrl: "/api",
  });

  // 认证拦截器：自动注入 JWT
  client.interceptors.request.use(async (request) => {
    const token = useAuthStore.getState().token;
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    // 国际化
    request.headers.set("Accept-Language", navigator.language.startsWith("zh") ? "zh" : "en");
    return request;
  });

  // 响应拦截器：处理 401 自动跳转登录
  client.interceptors.response.use(async (response) => {
    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return response;
  });
}
```

### 3.3 API 调用示例

生成的 SDK 函数可直接在组件或 loader 中调用：

```ts
// 在路由 loader 中
import { getSampleSet } from "~/api/sdk.gen";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { data, error } = await getSampleSet({ path: { id: params.id } });
  if (error) throw new Response("Not found", { status: 404 });
  return { sampleSet: data };
}
```

### 3.4 Vite 开发代理

开发环境通过 Vite proxy 将 `/api` 请求转发到后端：

```ts
// vite.config.ts 增加配置
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true, // WebSocket 代理
      },
    },
  },
});
```

---

## 4 · 状态管理

### 4.1 策略

| 状态类型 | 管理方式 | 说明 |
| --- | --- | --- |
| 服务端数据 | React Router `clientLoader` | 路由级数据加载，自动与 URL 关联 |
| 认证状态 | Zustand (persist) | JWT token + 用户信息，持久化到 localStorage |
| 任务状态 | Zustand | WebSocket 推送实时更新 |
| UI 状态 | React `useState` / `useReducer` | 组件局部状态 |
| 主题 | ThemeProvider (React Context) | 暗色模式偏好 |

### 4.2 认证 Store

```ts
// app/stores/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  user: { id: string; username: string; role: string } | null;
  setAuth: (token: string, user: AuthState["user"]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "medseg-auth" }
  )
);
```

### 4.3 任务 Store

```ts
// app/stores/task.ts
import { create } from "zustand";

interface Task {
  id: string;
  status: "queued" | "loading" | "running" | "completed" | "failed" | "cancelled";
  moduleName: string;
  sampleSetId: string;
  queuePosition: number | null;
  estimatedWaitMs: number | null;
}

interface TaskState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>()((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),
}));
```

---

## 5 · WebSocket 实时通信

### 5.1 连接管理

```ts
// app/lib/websocket.ts
export class TaskWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws/tasks?token=${token}`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "task_status_update") {
        useTaskStore.getState().updateTask(message.data.task_id, {
          status: message.data.status,
          queuePosition: message.data.queue_position,
          estimatedWaitMs: message.data.estimated_wait_ms,
        });
      }
    };

    this.ws.onclose = (event) => {
      if (event.code !== 4001 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect(token);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(token: string) {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(token);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.reconnectAttempts = 0;
  }
}
```

### 5.2 使用方式

通过 `useWebSocket` Hook 在 AppLayout 中建立连接，用户登录后自动连接，登出后断开：

```ts
// app/hooks/use-websocket.ts
export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<TaskWebSocket | null>(null);

  useEffect(() => {
    if (token) {
      wsRef.current = new TaskWebSocket();
      wsRef.current.connect(token);
    }
    return () => {
      wsRef.current?.disconnect();
    };
  }, [token]);
}
```

---

## 6 · 暗色模式

### 6.1 方案

使用 Shadcn UI 官方推荐的 **ThemeProvider + CSS 变量** 方案：

1. `ThemeProvider` 管理 `light` / `dark` / `system` 三种模式
2. 通过 `document.documentElement.classList` 切换 `.dark` 类
3. Tailwind CSS v4 使用 `@custom-variant dark (&:is(.dark *))` 响应暗色模式
4. 所有颜色使用 CSS 变量（已在 `app.css` 中定义），暗色模式下自动切换

### 6.2 色彩系统

采用 **黑白中性色系**（Neutral），强调医学软件的专业感：

| 语义 | 亮色模式 | 暗色模式 |
| --- | --- | --- |
| 背景 | 白色 (oklch 1 0 0) | 深灰 (oklch 0.145 0 0) |
| 前景 | 近黑 (oklch 0.145 0 0) | 近白 (oklch 0.985 0 0) |
| 主色 | 深黑 (oklch 0.205 0 0) | 浅灰 (oklch 0.922 0 0) |
| 卡片 | 白色 | 深灰 (oklch 0.205 0 0) |
| 边框 | 浅灰 (oklch 0.922 0 0) | 白色 10% 透明 |
| 警告 | 红色 (oklch 0.577 0.245 27) | 亮红 (oklch 0.704 0.191 22) |

**设计原则**：
- 主体黑白色系保持视觉克制，不干扰医学图像的色彩判读
- 警示色仅用于危险操作（删除等）
- 分割 mask 叠加使用高饱和度半透明色以与背景图像区分

---

## 7 · 医学影像模块

### 7.1 技术选型

| 组件 | 选择 | 说明 |
| --- | --- | --- |
| 渲染引擎 | `@cornerstonejs/core` | 基于 WebGL 的高性能体积渲染 |
| 图像加载 | `@cornerstonejs/dicom-image-loader` | DICOM 文件加载 |
| NIfTI 加载 | `@cornerstonejs/nifti-volume-loader` | NIfTI 格式体积加载 |
| 标注工具 | `@cornerstonejs/tools` | 手动标注、分割画笔、窗宽窗位等 |

### 7.2 初始化

Cornerstone3D 需在应用启动时全局初始化一次：

```ts
// app/features/viewer/cornerstone-init.ts
import { init as coreInit } from "@cornerstonejs/core";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";
import { init as cornerstoneToolsInit } from "@cornerstonejs/tools";

let initialized = false;

export async function initCornerstone(): Promise<void> {
  if (initialized) return;
  await coreInit();
  await dicomImageLoaderInit();
  await cornerstoneToolsInit();
  initialized = true;
}
```

### 7.3 图像加载策略

后端提供 `/api/.../images/{id}/download` 端点下载原始图像文件。前端需要：

1. **下载图像文件**为 `ArrayBuffer`
2. **根据格式选择加载器**：
   - NIfTI：使用 `@cornerstonejs/nifti-volume-loader`，通过自定义 URL scheme `nifti:blob:<blobUrl>` 加载
   - DICOM：使用 `@cornerstonejs/dicom-image-loader`，通过 `wadouri:<blobUrl>` 加载
3. **创建体积**并加载到 `RenderingEngine`

```ts
// 加载流程示意
async function loadNiftiVolume(imageId: string, downloadUrl: string) {
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const arrayBuffer = await response.arrayBuffer();

  // 注册为 Blob URL 供 Cornerstone 加载
  const blob = new Blob([arrayBuffer]);
  const blobUrl = URL.createObjectURL(blob);

  const volumeId = `nifti:${blobUrl}`;
  const volume = await volumeLoader.createAndCacheVolume(volumeId);
  await volume.load();

  return volumeId;
}
```

### 7.4 MPR 三视图

预览页面采用经典的 **MPR (Multi-Planar Reconstruction)** 三视图布局：

```
┌──────────────────┬──────────────────┐
│                  │                  │
│   Axial (轴位)   │  Sagittal (矢状) │
│                  │                  │
├──────────────────┼──────────────────┤
│                  │                  │
│  Coronal (冠状)  │   工具面板/信息   │
│                  │                  │
└──────────────────┴──────────────────┘
```

每个视口为一个 `CornerstoneViewport` React 组件，封装 `RenderingEngine` 的创建和销毁逻辑：

```tsx
// app/features/viewer/cornerstone-viewport.tsx
function CornerstoneViewport({ viewportId, orientation, volumeId }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current || !volumeId) return;
    // 创建/更新 viewport，加载 volume，设置方向
    // 组件卸载时清理 viewport
  }, [viewportId, orientation, volumeId]);

  return <div ref={elementRef} className="w-full h-full" />;
}
```

### 7.5 分割标注工具

| 工具 | 用途 | 鼠标绑定 |
| --- | --- | --- |
| `WindowLevelTool` | 窗宽窗位调节 | 右键拖拽 |
| `ZoomTool` | 缩放 | 滚轮 |
| `PanTool` | 平移 | 中键拖拽 |
| `BrushTool` | 分割画笔 | 左键（标注模式） |
| `EraserTool` | 擦除分割 | 左键（擦除模式） |
| `SegmentationDisplayTool` | 分割 mask 显示 | 自动 |

工具通过 `ToolGroupManager` 统一管理，支持在工具栏中切换活跃工具。

### 7.6 分割结果叠加

当子集 `metadata.is_segmentation === true` 时：

1. 从 `metadata.source_subset_id` 加载原始图像
2. 从 `metadata.source_image_id_mapping` 确定分割 mask 与原始图像的对应关系
3. 将原始图像加载为基础体积
4. 将分割 mask 加载为 **Derived Labelmap Volume**
5. 通过 `segmentation.addLabelmapRepresentationToViewportMap()` 叠加到对应视口
6. 分割 mask 以半透明彩色覆盖层渲染

---

## 8 · 页面设计

### 8.1 全局布局

已认证区域采用 **Sidebar + Content** 布局：

```
┌────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────┐  │
│ │          │ │ Header (面包屑 + 用户菜单 + 主题) │  │
│ │ Sidebar  │ ├──────────────────────────────────┤  │
│ │          │ │                                  │  │
│ │ - 样本库  │ │         Page Content             │  │
│ │ - 共享库  │ │         (Outlet)                 │  │
│ │ - 任务中心│ │                                  │  │
│ │ - 管理后台│ │                                  │  │
│ │          │ │                                  │  │
│ └──────────┘ └──────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

Sidebar 使用 Shadcn UI 的 **Sidebar** 组件，支持折叠/展开，响应式适配。

### 8.2 页面列表与职责

| 页面 | URL | 职责 |
| --- | --- | --- |
| 首页 | `/` | 品牌展示 / 未登录引导（登录后重定向至样本库） |
| 登录 | `/login` | 用户名 + 密码登录 |
| 注册 | `/register` | 注册新用户 |
| 样本库 | `/app/library` | 目录树浏览、搜索、创建文件夹/样本集、上传 |
| 共享样本库 | `/app/shared` | 浏览公共共享的样本集、复制到个人库 |
| 样本集详情 | `/app/sample-sets/:id` | 子集列表、管线感知建议、运行处理、查看元数据 |
| 图像查看器 | `/app/viewer/:setId/:subsetId` | Cornerstone3D 渲染、MPR 三视图、标注、分割叠加 |
| 任务中心 | `/app/tasks` | 当前/历史任务列表、排队状态、取消任务 |
| 用户管理 | `/app/admin/users` | 用户列表增删改、角色分配 |
| 模块管理 | `/app/admin/modules` | 模块列表、启用/禁用、手动加载/卸载、资源查看 |
| 全局样本库 | `/app/admin/sample-sets` | 浏览所有用户样本集、管理共享库 |

### 8.3 关键交互流程

#### 样本集浏览 → 处理 → 查看

```
样本库页                 样本集详情页              图像查看器
┌─────────┐         ┌──────────────────┐     ┌──────────────┐
│目录树浏览 │──点击──>│ 子集列表          │     │ MPR 三视图    │
│         │         │ 管线感知建议卡片    │     │ 工具栏        │
│         │         │  [一键运行按钮]    │     │ 分割叠加      │
│         │         │                  │     │              │
│         │         │ → 运行对话框       │     │              │
│         │         │   选模块/填参数    │     │              │
│         │         │   提交任务        │     │              │
│         │         │                  │     │              │
│         │         │ 任务完成 → 刷新    │──点击──>│          │
│         │         │ 新子集出现        │     │              │
└─────────┘         └──────────────────┘     └──────────────┘
```

#### 分割叠加显示

```
点击分割结果子集
       │
       ▼
  检查 metadata.is_segmentation === true
       │
       ▼
  获取 source_subset_id → 加载原始图像为基础体积
       │
       ▼
  加载分割 mask 为 Derived Labelmap Volume
       │
       ▼
  叠加渲染：原始图像 + 半透明彩色 mask
```

---

## 9 · 动态参数表单

### 9.1 需求

处理模块可声明 `params_schema`（JSON Schema 格式）。前端需要根据该 Schema 动态渲染参数表单，让用户在运行管线时填写参数。

### 9.2 方案

实现一个 `DynamicForm` 组件，解析 JSON Schema 并自动生成表单控件：

| JSON Schema 类型 | 渲染控件 |
| --- | --- |
| `string` | `<Input />` |
| `number` / `integer` | `<Input type="number" />` |
| `boolean` | `<Switch />` |
| `string` + `enum` | `<Select />` |
| `string` + format `textarea` | `<Textarea />` |

- 支持 `default`、`minimum`、`maximum`、`description` 等约束
- 校验失败时显示字段级错误提示
- 无 `params_schema` 的模块不显示参数表单

---

## 10 · 构建与部署

### 10.1 开发环境

```bash
# 安装依赖
pnpm install

# 生成 API 客户端（需要后端运行中）
pnpm run api:generate

# 启动开发服务器
pnpm run dev
```

### 10.2 生产构建

```bash
pnpm run build
```

SPA 模式下，构建产物为静态文件（`build/client/`），可由后端 FastAPI 的 `StaticFiles` 中间件直接托管（参照后端 `app/core/static.py`）。

### 10.3 API 客户端生成流程

```
后端 FastAPI 启动
       │
       ▼
  /api/openapi.json (自动生成)
       │
       ▼
  pnpm run api:generate
       │
       ▼
  app/api/ 目录生成:
    ├── client.gen.ts   (HTTP 客户端)
    ├── sdk.gen.ts      (SDK 函数)
    ├── types.gen.ts    (TypeScript 类型)
    └── index.ts        (入口)
```

每当后端 API Schema 变更时，重新运行 `api:generate` 即可同步前端类型。

---

## 11 · 关键依赖清单

### 11.1 运行依赖

| 包名 | 用途 |
| --- | --- |
| `react`, `react-dom` | UI 框架 |
| `react-router`, `@react-router/dev` | 路由框架 |
| `tailwindcss`, `@tailwindcss/vite` | 样式方案 |
| `shadcn`, `radix-ui` | UI 组件库 |
| `lucide-react` | 图标 |
| `zustand` | 状态管理 |
| `@hey-api/client-fetch` | 生成的 API 客户端运行时 |
| `@cornerstonejs/core` | 医学影像渲染核心 |
| `@cornerstonejs/tools` | 标注与分割工具 |
| `@cornerstonejs/dicom-image-loader` | DICOM 加载器 |
| `@cornerstonejs/nifti-volume-loader` | NIfTI 加载器 |

### 11.2 开发依赖

| 包名 | 用途 |
| --- | --- |
| `@hey-api/openapi-ts` | OpenAPI → TypeScript 代码生成 |
| `vite` | 构建工具 |
| `typescript` | 类型检查 |

---

## 12 · 设计规范

### 12.1 视觉原则

- **黑白色系**：主体使用 Neutral 色板，保持医学软件的专业克制感
- **留白充足**：卡片间距 `gap-4` 以上，内容不拥挤
- **层次分明**：通过背景色差异（`background` vs `card`）区分内容层级
- **图标一致**：全部使用 Lucide 图标，大小统一（`h-4 w-4` / `h-5 w-5`）
- **字体统一**：全局使用 Inter Variable 字体

### 12.2 交互规范

- **操作反馈**：所有异步操作显示 loading 状态，完成后 toast 提示
- **确认机制**：危险操作（删除）弹出确认对话框
- **空状态**：列表/目录为空时显示引导性空状态组件
- **错误提示**：API 错误通过 toast 展示 `message` 字段，表单校验错误显示在字段下方
- **键盘导航**：对话框支持 `Escape` 关闭，表单支持 `Enter` 提交

### 12.3 响应式

- 最小支持宽度：1280px（PRD 要求）
- Sidebar 在窄屏下自动折叠为图标模式
- 图像查看器占满可用空间，MPR 视口等分

---

## 13 · 决策记录

| # | 决策 | 考虑因素 | 备选方案 |
| --- | --- | --- | --- |
| D1 | SPA 模式 (`ssr: false`) | 医学影像前端依赖大量客户端 API（WebGL、WebSocket），SSR 无优势 | SSR 模式 |
| D2 | Zustand 作为状态管理 | 轻量无样板、与 React hooks 天然契合、支持 persist | Redux Toolkit, Jotai |
| D3 | @hey-api/openapi-ts 生成 API 客户端 | 类型安全、支持 Fetch API、社区活跃、配置简洁 | openapi-typescript, orval |
| D4 | Cornerstone3D v2 | 医学影像领域事实标准、支持 NIfTI + DICOM、内置分割工具 | ITK.js, VTK.js |
| D5 | React Router v7 Framework mode | 类型安全路由、clientLoader 数据加载、项目已初始化 | TanStack Router |
| D6 | 不引入 TanStack Query | 使用 clientLoader 管理服务端数据已足够，减少复杂度 | TanStack Query |
| D7 | 动态表单自实现 | params_schema 结构简单，无需引入完整 JSON Schema 表单库 | react-jsonschema-form |
