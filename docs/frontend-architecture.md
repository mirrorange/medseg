# MedSeg Cloud — 前端架构设计文档

| 项目 | 值 |
| --- | --- |
| 文档版本 | v1.1 |
| 对应 PRD 版本 | v1.1 |
| 日期 | 2026-04-13 |
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
│   │   ├── library/                    # 样本库模块（类文件管理器）
│   │   │   ├── library-browser.tsx     # 主浏览器（工具栏 + 视图 + 对话框编排 + 框选）
│   │   │   ├── library-toolbar.tsx     # 工具栏（导航按钮、地址栏、视图切换、操作）
│   │   │   ├── library-breadcrumb.tsx  # 双态地址栏（点击式路径段 / 可编辑输入框）
│   │   │   ├── library-list-view.tsx   # 列表/表格视图（含拖放）
│   │   │   ├── library-grid-view.tsx   # 网格/卡片视图（含拖放）
│   │   │   ├── library-context-menu.tsx # 右键上下文菜单
│   │   │   ├── library-item-icon.tsx   # 项目类型图标（文件夹/样本集）
│   │   │   ├── use-lasso-selection.tsx  # 鼠标框选 hook + 选框覆盖层
│   │   │   ├── create-folder-dialog.tsx    # 创建文件夹对话框
│   │   │   ├── create-sample-set-dialog.tsx # 创建样本集对话框
│   │   │   ├── rename-dialog.tsx       # 统一重命名对话框（文件夹/样本集）
│   │   │   ├── move-dialog.tsx         # 移动对话框（目录树浏览选择目标）
│   │   │   └── delete-dialog.tsx       # 删除确认对话框
│   │   │
│   │   ├── sample-set/                 # 样本集详情模块（文件浏览器风格）
│   │   │   ├── sample-set-header.tsx   # 顶部信息区（名称/描述/首选操作/分享）
│   │   │   ├── sample-set-browser.tsx  # 主浏览器容器（编排子组件 + 对话框 + 键盘快捷键）
│   │   │   ├── sample-set-toolbar.tsx  # 工具栏（返回上级、视图切换、操作按钮）
│   │   │   ├── sample-set-list-view.tsx  # 列表视图（子集列表 或 图像列表）
│   │   │   ├── sample-set-grid-view.tsx  # 网格视图（子集卡片 或 图像卡片）
│   │   │   ├── sample-set-context-menu.tsx  # 右键上下文菜单（含管线操作）
│   │   │   ├── sample-set-item-icon.tsx    # 项目类型图标（子集/图像）
│   │   │   ├── create-subset-dialog.tsx    # 创建子集对话框
│   │   │   ├── rename-dialog.tsx           # 统一重命名对话框（子集/图像）
│   │   │   ├── delete-dialog.tsx           # 删除确认对话框（子集/图像）
│   │   │   ├── properties-dialog.tsx       # 属性对话框（详细信息 + 元数据编辑）
│   │   │   ├── image-upload-dialog.tsx     # 图像上传对话框（在子集内上传）
│   │   │   ├── run-pipeline-dialog.tsx     # 运行管线对话框（含动态参数表单）
│   │   │   └── use-lasso-selection.tsx     # 鼠标框选 hook + 选框覆盖层
│   │   │
│   │   ├── viewer/                     # 医学影像查看器模块
│   │   │   ├── cornerstone-viewport.tsx  # 单个 Cornerstone 视口组件
│   │   │   ├── mpr-viewer.tsx            # MPR 三视图布局
│   │   │   ├── segmentation-overlay.tsx  # 分割 mask 叠加控制
│   │   │   ├── image-navigator.tsx       # 子集内图像切换导航
│   │   │   ├── toolbar.tsx               # 工具栏（窗宽窗位、缩放、标注工具）
│   │   │   └── cornerstone-init.ts       # Cornerstone3D 初始化逻辑
│   │   │
│   │   ├── tasks/                      # 任务模块
│   │   │   ├── task-list.tsx           # 任务数据表格（表格视图，含状态徽标、关联名称、操作列）
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
│   │   ├── app-sidebar.tsx             # 应用侧边栏（导航菜单 + 底部用户菜单/退出）
│   │   ├── mode-toggle.tsx             # 暗色模式单击切换（light ↔ dark）
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
│   │   ├── library.ts                  # 样本库浏览器状态（当前目录、选中项、视图模式等）
│   │   ├── sample-set.ts              # 样本集浏览器状态（当前位置、选中项、视图模式等）
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
    // 查看器支持 ?imageId=xxx 查询参数指定初始图像
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
        // Use upsertTasks to handle tasks not yet in store
        // (e.g. submitted but WS update arrives before store is populated)
        useTaskStore.getState().upsertTasks([{
          id: message.data.task_id,
          status: message.data.status,
          module_name: message.data.module_name ?? "",
          sample_set_id: message.data.sample_set_id ?? "",
          queue_position: message.data.queue_position ?? null,
          estimated_wait_ms: message.data.estimated_wait_ms ?? null,
        }]);
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

1. 从 `metadata.source_subset_id` 加载源子集的全部图像
2. 从 `metadata.source_image_id_mapping` 确定分割 mask 与原始图像的对应关系
3. 将原始图像加载为基础体积
4. 将分割 mask 加载为 **Derived Labelmap Volume**
5. 通过 `segmentation.addLabelmapRepresentationToViewportMap()` 叠加到对应视口
6. 分割 mask 以半透明彩色覆盖层渲染
7. **切换图像时**：同步加载对应的源图像和分割 mask，保持叠加关系

### 7.7 子集内图像导航

查看器支持在同一子集的图像间切换：

- **侧边面板或底部缩略图栏**：显示当前子集内所有图像，高亮当前查看的图像
- **前/后切换按钮**（或键盘左右箭头）：在子集图像列表中前后切换
- 切换时自动加载新图像的体积数据
- 若当前为分割结果子集，切换时同步加载对应源图像进行叠加

---

## 8 · 页面设计

### 8.1 全局布局

已认证区域采用 **Sidebar + Content** 布局：

```
┌────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────┐  │
│ │          │ │ Header (SidebarTrigger + 主题切换) │  │
│ │ Sidebar  │ ├──────────────────────────────────┤  │
│ │          │ │                                  │  │
│ │ - 样本库  │ │         Page Content             │  │
│ │ - 共享库  │ │         (Outlet)                 │  │
│ │ - 任务中心│ │                                  │  │
│ │ - 管理后台│ │                                  │  │
│ │          │ │                                  │  │
│ │──────────│ └──────────────────────────────────┘  │
│ │用户头像   │                                       │
│ │+ 退出登录 │                                       │
│ └──────────┘                                       │
└────────────────────────────────────────────────────┘
```

- **Header** 仅包含 SidebarTrigger（折叠/展开侧边栏按钮）和主题切换按钮（单击切换 light/dark）
- **Sidebar 底部** 显示当前用户头像、用户名、邮箱，点击展开下拉菜单可退出登录
- **主题切换** 采用单击切换（light ↔ dark），不使用下拉菜单，简化交互

Sidebar 使用 Shadcn UI 的 **Sidebar** 组件，支持折叠/展开，响应式适配。

### 8.2 页面列表与职责

| 页面 | URL | 职责 |
| --- | --- | --- |
| 首页 | `/` | 品牌展示 / 未登录引导（登录后重定向至样本库） |
| 登录 | `/login` | 用户名 + 密码登录 |
| 注册 | `/register` | 注册新用户 |
| 样本库 | `/app/library` | 类文件管理器浏览、列表/网格视图切换、路径导航、拖拽移动、右键菜单、创建/重命名/移动/删除文件夹与样本集 |
| 共享样本库 | `/app/shared` | 浏览公共共享的样本集、复制到个人库 |
| 样本集详情 | `/app/sample-sets/:id` | 顶部信息区（名称/描述/首选操作/分享）+ 文件浏览器风格：列表/网格双视图、子集列表（根级）→ 图像列表（子集内）、右键菜单含管线操作建议和预览入口、属性对话框 |
| 图像查看器 | `/app/viewer/:setId/:subsetId` | Cornerstone3D 渲染、MPR 三视图、子集内图像切换导航、标注、分割叠加（自动加载源子集） |
| 任务中心 | `/app/tasks` | 当前/历史任务列表、排队状态、取消任务 |
| 用户管理 | `/app/admin/users` | 用户列表增删改、角色分配 |
| 模块管理 | `/app/admin/modules` | 模块列表、启用/禁用、手动加载/卸载、资源查看 |
| 全局样本库 | `/app/admin/sample-sets` | 浏览所有用户样本集、管理共享库 |

### 8.3 关键交互流程

#### 样本库浏览 → 样本集详情 → 图像查看

```
样本库页（文件管理器风格）        样本集详情页（文件浏览器风格）     图像查看器
┌───────────────────────┐   ┌──────────────────────┐   ┌──────────────┐
│ 🔧 工具栏              │   │ 🔧 工具栏              │   │ MPR 三视图    │
│  ← → ↑ | 地址栏       │   │  [← 返回子集]          │   │ 工具栏        │
│  | 列表/网格 | 新建 ▼   │   │  | 列表/网格 | 新建 ▼  │   │ 分割叠加      │
│─────────────────────── │   │  | [▶ 运行首选操作]     │   │ 图像切换导航  │
│ 📁 CT Scans        5项 │   │──────────────────────│   │              │
│ 📁 MRI Studies     3项 │   │ 📁 raw            3张 │   │              │
│ 📄 Patient-001         │──双击──>│ 📁 normalized   3张 │   │              │
│ 📄 Study-A             │   │ 📁 segmentation   3张 │   │              │
│                       │   │                      │   │              │
│ [右键] 新建/重命名/    │   │ [右键] 建议操作/       │──双击──>│      │
│ 移动/删除/属性         │   │ 更多操作/预览/重命名   │   │              │
│ [拖拽] 移动到文件夹内   │   │ 删除/属性             │   │              │
└───────────────────────┘   └──────────────────────┘   └──────────────┘
```

#### 样本集详情交互详解

样本集详情页分为 **顶部信息区** 和 **文件浏览器区** 两部分。

**顶部信息区**：
1. **样本集名称和描述**：直接显示在页面顶部，可点击编辑
2. **首选操作按钮**：对应 awareness 响应中的 `primary` 模块（若存在）
   - 点击后：弹出运行对话框，预填首选模块及其所有 `recommended_subset_ids`
3. **分享 / 取消分享按钮**：
   - 未分享状态：显示「分享」按钮，点击发布到共享样本库
   - 已分享状态：显示「取消分享」按钮，点击撤回共享
   - 分享功能从文件浏览器视图中移除，统一在顶部信息区操作

**文件浏览器区**（子集列表 / 图像列表的两层浏览）：

**根级（子集列表）**：
1. **浏览子集**：显示所有子集，类似目录列表
2. **进入子集**：双击子集进入内部图像列表
3. **预览子集**：右键子集 → 预览，打开图像查看器加载整个子集
4. **新建子集**：工具栏或右键空白处新建
5. **重命名子集**：右键子集 → 重命名（F2 快捷键）
6. **删除子集**：右键子集 → 删除（Delete 快捷键）
7. **查看属性**：右键子集 → 属性，打开属性对话框（查看/编辑详细信息和元数据）
8. **管线操作（右键菜单）**：
   - 右键单个子集：显示该子集的建议处理操作（recommended 模块）
   - 「更多操作」子菜单：显示所有可用的处理模块（available 模块）
   - 选中多个子集时：若多个子集拥有相同的建议模块，允许批量运行
   - 点击管线操作 → 弹出运行对话框（含子集名称输入、参数表单）
9. **多选**：Ctrl/Cmd 点击多选，Shift 范围选，鼠标框选
10. **视图切换**：列表/网格视图切换

**子集内（图像列表）**：
1. **浏览图像**：显示子集内的所有图像
2. **返回上级**：工具栏 ← 按钮返回子集列表
3. **预览图像**：双击图像进入图像查看器 (`/app/viewer/:setId/:subsetId?imageId=xxx`)
4. **右键预览**：右键图像 → 预览（与双击行为相同）
5. **上传图像**：工具栏或右键空白处 → 上传（multipart 上传到当前子集）
6. **重命名图像**：右键图像 → 重命名
7. **删除图像**：右键图像 → 删除
8. **查看属性**：右键图像 → 属性，打开属性对话框（查看格式、元数据等）

> **变更说明**：
> - 移除了原有的样本集级别图像上传（不再自动创建 raw 子集），改为在子集内上传
> - 移除了原有的管线感知建议面板（Pipeline Awareness cards），改为右键菜单中的管线操作
> - 新增顶部信息区（名称/描述/首选操作/分享），首选操作和分享功能从文件浏览器中移出
> - 所有管线操作现在通过 RunPipelineDialog 触发（要求输入子集名称和参数）
> - 新增预览入口：双击图像、右键图像预览、右键子集预览

#### 分割叠加显示

```
点击分割结果子集（或预览分割图像）
       │
       ▼
  检查 metadata.is_segmentation === true
       │
       ▼
  获取 source_subset_id → 加载源子集的全部图像
       │
       ▼
  获取 source_image_id_mapping → 确定 mask 与源图像的对应关系
       │
       ▼
  加载当前图像对应的原始图像为基础体积
       │
       ▼
  加载分割 mask 为 Derived Labelmap Volume
       │
       ▼
  叠加渲染：原始图像 + 半透明彩色 mask
       │
       ▼
  切换图像时：同步加载对应源图像 + mask
```

#### 图像查看器交互

查看器支持在子集内浏览全部图像：

```
┌──────────────────────────────────────────────────────────┐
│  ← 返回样本集  |  子集名称  |  图像 2 / 8  |  < > 切换    │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────┬──────────────────┐                  │
│ │                  │                  │                  │
│ │   Axial (轴位)   │  Sagittal (矢状) │                  │
│ │                  │                  │                  │
│ ├──────────────────┼──────────────────┤  ┌────────────┐ │
│ │                  │                  │  │ 图像列表     │ │
│ │  Coronal (冠状)  │   工具面板/信息   │  │ ✓ img1.nii  │ │
│ │                  │                  │  │ ● img2.nii  │ │
│ └──────────────────┴──────────────────┘  │   img3.nii  │ │
│                                          └────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- **入口 1**：双击图像 → 导航到 `/app/viewer/:setId/:subsetId?imageId=xxx`，定位到被双击的图像
- **入口 2**：右键图像 → 预览 → 同上
- **入口 3**：右键子集 → 预览 → 导航到 `/app/viewer/:setId/:subsetId`（无 imageId，从第一张开始）
- **图像切换**：侧边图像列表 + 前后切换按钮 + 键盘左右箭头
- **分割叠加**：若当前子集 `metadata.is_segmentation === true`，每次切换图像时自动加载对应源图像叠加渲染

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

## 10 · 样本库 V2 — 文件管理器风格 UI 设计

### 10.1 设计目标

将样本库从简单的目录树视图升级为功能完整的文件管理器风格界面，参考 XDeck 文件浏览器的交互模式，适配 MedSeg 的黑白中性色设计风格。

**核心能力**：
- 列表/网格双视图 + 视图模式切换
- 双态地址栏（可点击路径段 / 可编辑输入框）+ 前进/后退/上级
- 多选方式：Ctrl 点击、Shift 范围选、鼠标拖动框选（lasso）
- 批量操作（移动、删除）
- 拖拽移动（拖到文件夹上）
- 右键上下文菜单（右键自动选中目标项）
- 名称唯一性约束与友好错误提示

### 10.2 Library Store（Zustand）

```ts
// app/stores/library.ts
import { create } from "zustand";

export type LibraryItemType = "folder" | "sample_set";
export type ViewMode = "list" | "grid";
export type SortField = "name" | "created_at" | "updated_at";
export type SortDirection = "asc" | "desc";

export interface LibraryItem {
  id: string;
  name: string;
  type: LibraryItemType;
  description?: string | null;   // 仅 sample_set
  childCount?: number | null;    // 仅 folder
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface LibraryState {
  // 当前目录
  currentFolderId: string | null;
  breadcrumb: BreadcrumbItem[];
  items: LibraryItem[];
  isLoading: boolean;
  error: string | null;

  // 选择
  selectedIds: Set<string>;

  // 视图设置
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;

  // 导航历史
  history: (string | null)[];
  historyIndex: number;

  // Actions
  navigateTo: (folderId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;

  selectItem: (id: string, toggle: boolean) => void;
  selectRange: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
}
```

**数据流**：`navigateTo(folderId)` → 调用 `GET /api/library/contents?folder_id=...` → 更新 `items`、`breadcrumb`、`currentFolderId`、导航历史。

### 10.3 组件架构

```
LibraryBrowser (library-browser.tsx)
├── LibraryToolbar (library-toolbar.tsx)
│   ├── 导航按钮 (← → ↑ 🔄)
│   ├── LibraryAddressBar (library-breadcrumb.tsx)  ← 双态地址栏
│   ├── 视图模式切换 (列表 ↔ 网格)
│   └── 操作按钮 (新建文件夹 / 新建样本集)
├── useLassoSelection (use-lasso-selection.tsx)      ← 鼠标框选
│   └── LassoOverlay (选框覆盖层)
├── LibraryContextMenu (library-context-menu.tsx)
├── LibraryListView (library-list-view.tsx)    ← viewMode === "list"
│   └── Table (名称、类型、创建时间、修改时间) + DnD
├── LibraryGridView (library-grid-view.tsx)    ← viewMode === "grid"
│   └── 卡片网格 (图标 + 名称) + DnD
├── CreateFolderDialog
├── CreateSampleSetDialog
├── RenameDialog (rename-dialog.tsx)
├── MoveDialog (move-dialog.tsx)
└── DeleteDialog (delete-dialog.tsx)
```

### 10.4 组件详细设计

#### 10.4.1 LibraryBrowser（主容器）

**文件**：`features/library/library-browser.tsx`

- 从 LibraryStore 读取状态，编排子组件
- 管理所有对话框的开/关状态
- 处理统一的 action 派发（类似 XDeck `handleAction`）
- 监听键盘快捷键（Ctrl+A 全选、Delete 删除、F2 重命名）

```tsx
type LibraryAction =
  | "open"           // 双击打开（文件夹进入，样本集跳转详情页）
  | "new-folder"     // 新建文件夹
  | "new-sample-set" // 新建样本集
  | "rename"         // 重命名
  | "move"           // 移动
  | "delete"         // 删除
  | "refresh"        // 刷新
  | "select-all";    // 全选
```

#### 10.4.2 LibraryToolbar（工具栏）

**文件**：`features/library/library-toolbar.tsx`

布局：`← → ↑ | [双态地址栏] | [列表|网格] | [新建▼] | [刷新]`

- 导航按钮：后退 (`←`)、前进 (`→`)、上级 (`↑`)，根据历史栈控制禁用状态
- 地址栏：`LibraryAddressBar`，双态切换（点击路径段导航 / 点击空白编辑）
- 视图切换：列表 (`List`) / 网格 (`Grid3X3`) 图标按钮
- 新建下拉菜单：新建文件夹、新建样本集
- 刷新按钮

#### 10.4.3 LibraryAddressBar（双态地址栏）

**文件**：`features/library/library-breadcrumb.tsx`

仿 Windows 资源管理器 / XDeck 文件管理器的双态地址栏：

- **显示态**：在 `bg-muted/50` 容器中渲染可点击路径段（"Library / Folder A / Subfolder B"），点击各段导航到对应目录，点击容器空白区域切换到编辑态
- **编辑态**：Input 输入框显示完整路径文本（"Library / Folder A / ..."），自动聚焦并全选，按 Enter 或失焦退出编辑，按 Escape 取消
- 根级始终显示 "Library"

#### 10.4.4 LibraryListView（列表视图）

**文件**：`features/library/library-list-view.tsx`

- 使用 Shadcn `Table` 组件
- 列：选择框 | 图标+名称 | 类型 | 修改时间
- 单击选中行（支持 Ctrl 多选、Shift 范围选）
- 双击打开（文件夹进入 / 样本集跳转详情）
- 右键弹出上下文菜单（右键时自动选中目标项）
- 支持拖拽（drag）到文件夹行上完成移动
- 每个项标记 `data-library-item` 和 `data-item-id`，配合框选
- 文件夹类型行作为 drop target，拖入时高亮
- 列头可点击排序

#### 10.4.5 LibraryGridView（网格视图）

**文件**：`features/library/library-grid-view.tsx`

- 响应式网格布局 (`grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))]`)
- 每个卡片：类型图标（大号） + 名称（居中截断）
- 交互同列表视图：单击选中、双击打开、右键菜单、拖拽
- 每个项标记 `data-library-item` 和 `data-item-id`，配合框选
- 选中卡片显示蓝色边框/背景高亮

#### 10.4.6 useLassoSelection（鼠标框选）

**文件**：`features/library/use-lasso-selection.tsx`

- 仿 XDeck `lasso-selection.tsx` 的桌面端鼠标框选实现
- 在空白区域按下鼠标，拖动生成半透明蓝色选框
- 5px 移动阈值避免误触发
- `rectsIntersect()` 检测选框与 `[data-library-item]` 元素的交叉
- 支持 additive 模式：按住 Shift/Cmd/Ctrl 时合并已有选择
- 不在项目、按钮、输入框上触发
- 导出 `LassoOverlay` 组件渲染选框覆盖层

#### 10.4.7 LibraryContextMenu（右键菜单）

**文件**：`features/library/library-context-menu.tsx`

- 使用 Shadcn `ContextMenu` 组件
- **右键单个项目**：打开 | 重命名 | 移动 | 分隔线 | 删除
- **右键空白区域**：新建文件夹 | 新建样本集 | 分隔线 | 刷新 | 全选
- **多选状态**：移动 N 项 | 分隔线 | 删除 N 项

#### 10.4.7 MoveDialog（移动对话框）

**文件**：`features/library/move-dialog.tsx`

- 参考 XDeck `MoveDialog` 设计
- 显示目录树供用户浏览选择目标文件夹
- 调用 `GET /api/library/tree` 获取完整目录树
- 支持导航进入子目录、返回上级
- 面包屑显示当前浏览位置
- 禁止选择被移动项自身或其子目录作为目标
- 确认后调用 `POST /api/library/batch-move`

#### 10.4.8 RenameDialog（重命名对话框）

**文件**：`features/library/rename-dialog.tsx`

- 统一处理文件夹和样本集的重命名
- 输入框预填当前名称，打开时自动全选文字
- 提交时根据 type 调用不同 API：
  - 文件夹：`PUT /api/library/folders/{id}`
  - 样本集：`PUT /api/sample-sets/{id}`
- 名称重复时显示 `DuplicateName` 错误提示

#### 10.4.9 DeleteDialog（删除对话框）

**文件**：`features/library/delete-dialog.tsx`

- 显示待删除项的名称列表
- 文件夹删除默认使用 `recursive=true`（级联删除）
- 样本集删除调用 `DELETE /api/sample-sets/{id}`
- 支持批量删除（依次调用删除 API）

### 10.5 拖拽移动

**实现方案**：使用原生 HTML5 Drag and Drop API（与 XDeck 一致）。

```
拖拽流程:
1. onDragStart  → 记录选中项路径，设置 dataTransfer
2. onDragOver   → 目标为文件夹时显示 drop 高亮
3. onDrop       → 调用 batch-move API 将选中项移入目标文件夹
4. onDragEnd    → 清理拖拽状态
```

**限制**：
- 只能拖到文件夹上（样本集不能作为 drop target）
- 不能拖到自身或自身子目录中
- 拖拽时半透明显示拖动项

### 10.6 样本集内部浏览器 V2 — 文件浏览器风格 UI 设计

#### 10.6.1 设计目标

将样本集详情页从简单的子集列表 + 管线感知建议面板升级为文件浏览器风格界面，与样本库页的交互模式保持一致。

**核心变更**：
- 列表/网格双视图 + 视图模式切换
- 两层浏览：根级（子集列表）→ 子集内（图像列表）
- 不需要拖拽操作，不需要地址栏导航（仅有单层目录深度）
- 右键上下文菜单，含管线操作建议
- 多选方式：Ctrl 点击、Shift 范围选、鼠标拖动框选（lasso）
- 属性对话框查看/编辑详细信息和元数据
- 移除原有的样本集级别图像上传、移除独立的管线感知建议面板
- 样本集级别首选操作按钮

#### 10.6.2 Sample Set Store（Zustand）

```ts
// app/stores/sample-set.ts
import { create } from "zustand";

export type BrowseLevel = "subsets" | "images";
export type ViewMode = "list" | "grid";
export type SortField = "name" | "created_at" | "type";
export type SortDirection = "asc" | "desc";

export interface SubsetItem {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, any>;
  sourceModule: string | null;
  sourceSubsetId: string | null;
  imageCount: number;
  createdAt: string;
}

export interface ImageItem {
  id: string;
  filename: string;
  format: string;
  metadata: Record<string, any>;
  sourceImageId: string | null;
  createdAt: string;
}

interface SampleSetBrowserState {
  // 当前浏览层级
  level: BrowseLevel;
  currentSubsetId: string | null;     // images 层级时记录当前子集 ID
  currentSubsetName: string | null;   // 用于显示

  // 数据
  subsets: SubsetItem[];
  images: ImageItem[];
  isLoading: boolean;

  // 选择
  selectedIds: Set<string>;

  // 视图设置
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;

  // 管线感知
  awareness: AwarenessResponse | null;

  // Actions
  loadSubsets: (sampleSetId: string) => Promise<void>;
  enterSubset: (subsetId: string, subsetName: string) => Promise<void>;
  goBackToSubsets: () => void;
  refresh: () => Promise<void>;

  selectItem: (id: string, toggle: boolean) => void;
  selectRange: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;

  loadAwareness: (sampleSetId: string) => Promise<void>;
}
```

**数据流**：
- `loadSubsets(sampleSetId)` → 调用 `GET /api/sample-sets/{id}` → 更新 `subsets`，设置 `level = "subsets"`
- `enterSubset(subsetId)` → 调用 `GET /api/sample-sets/{set_id}/subsets/{subset_id}` → 更新 `images`，设置 `level = "images"`
- `goBackToSubsets()` → 恢复 `level = "subsets"`，清空 `images` 和 `currentSubsetId`
- `loadAwareness(sampleSetId)` → 调用 `GET /api/pipelines/awareness/{sample_set_id}` → 更新 `awareness`

#### 10.6.3 组件架构

```
SampleSetBrowser (sample-set-browser.tsx)
├── SampleSetToolbar (sample-set-toolbar.tsx)
│   ├── 返回按钮 (← 仅在 images 层级显示)
│   ├── 当前位置标题 (样本集名 / 子集名)
│   ├── 视图模式切换 (列表 ↔ 网格)
│   └── 操作按钮 (新建子集 / 上传图像，按当前层级切换)
├── useLassoSelection (use-lasso-selection.tsx)      ← 鼠标框选
│   └── LassoOverlay (选框覆盖层)
├── SampleSetContextMenu (sample-set-context-menu.tsx)
├── SampleSetListView (sample-set-list-view.tsx)
│   └── subsets 层级: Table (名称、类型、来源模块、图像数、创建时间)
│   └── images 层级: Table (文件名、格式、创建时间)
├── SampleSetGridView (sample-set-grid-view.tsx)
│   └── subsets 层级: 卡片网格 (图标 + 名称 + 类型标签 + 图像数)
│   └── images 层级: 卡片网格 (格式图标 + 文件名)
├── CreateSubsetDialog
├── RenameDialog (rename-dialog.tsx)
├── DeleteDialog (delete-dialog.tsx)
├── PropertiesDialog (properties-dialog.tsx)
├── ImageUploadDialog (image-upload-dialog.tsx)
└── RunPipelineDialog (run-pipeline-dialog.tsx)

SampleSetHeader (sample-set-header.tsx)          ← 新增：页面顶部信息区
├── 样本集名称 / 描述（inline edit）
├── 首选操作按钮 (弹出 RunPipelineDialog)
└── 分享 / 取消分享按钮
```

#### 10.6.4 组件详细设计

##### SampleSetBrowser（主容器）

**文件**：`features/sample-set/sample-set-browser.tsx`

- 从 SampleSetStore 读取状态，编排子组件
- 管理所有对话框的开/关状态
- 根据当前 `level` 切换显示子集列表或图像列表
- 初始化时加载子集列表和管线感知数据
- 监听键盘快捷键（Ctrl+A 全选、Delete 删除、F2 重命名）

```tsx
type SampleSetAction =
  | "open"              // 双击：子集→进入图像列表，图像→跳转查看器
  | "preview"           // 预览：子集→查看器（加载整个子集），图像→查看器（定位到该图像）
  | "new-subset"        // 新建子集（仅 subsets 层级）
  | "upload"            // 上传图像（仅 images 层级）
  | "rename"            // 重命名
  | "delete"            // 删除
  | "properties"        // 查看/编辑属性对话框
  | "run-pipeline"      // 运行指定管线模块（来自右键菜单，弹出 RunPipelineDialog）
  | "run-primary"       // 运行首选操作（从顶部信息区触发，弹出 RunPipelineDialog）
  | "share"             // 分享 / 取消分享
  | "refresh"           // 刷新
  | "select-all";       // 全选
```

##### SampleSetToolbar（工具栏）

**文件**：`features/sample-set/sample-set-toolbar.tsx`

工具栏仅服务于文件浏览器区域，首选操作按钮和分享按钮已移至顶部信息区（由路由页面管理）。

布局根据层级动态变化：

**subsets 层级**：`[样本集标题] | [列表|网格] | [新建子集] | [刷新]`
**images 层级**：`[← 返回] [子集名称] | [列表|网格] | [上传图像] | [刷新]`

##### SampleSetHeader（顶部信息区）

**文件**：`features/sample-set/sample-set-header.tsx`（新增）

独立于文件浏览器，在样本集详情页顶部显示：

```
┌─────────────────────────────────────────────────────────────┐
│  📄 样本集名称（可点击编辑）                                   │
│  描述文字（可点击编辑）                   [▶ 首选操作] [分享]   │
└─────────────────────────────────────────────────────────────┘
```

- **样本集名称 / 描述**：直接展示，点击进入编辑模式（inline edit），失焦或 Enter 保存
- **首选操作按钮**：仅在 `awareness.primary` 存在时渲染，显示 primary 模块名称 + Sparkles 图标
  - 点击 → 弹出 RunPipelineDialog，预填首选模块及其 `recommended_subset_ids`
- **分享 / 取消分享按钮**：
  - 未分享：显示「分享」按钮（Share2 图标），点击调用 `POST /api/library/shared/{sample_set_id}`
  - 已分享：显示「取消分享」按钮（带 badge 标识已分享状态），点击调用 `DELETE /api/library/shared/{sample_set_id}`
  - 需要获取当前样本集的分享状态（从 `GET /api/sample-sets/{id}` 响应中增加 `is_shared` 字段）

##### SampleSetContextMenu（右键菜单）

**文件**：`features/sample-set/sample-set-context-menu.tsx`

右键菜单根据层级和选中状态动态生成：

**subsets 层级 — 右键单个子集**：
```
预览
──────────────
建议操作 (来自 awareness)
├── {Module A} — 建议         ← recommended_subset_ids 包含此子集的模块
├── {Module B} — 建议
├── ──────────────
└── 更多操作 ▸               ← 子菜单：所有可用模块（available_subset_ids 包含此子集）
    ├── {Module C}
    └── {Module D}
──────────────
重命名
属性
──────────────
删除
```

**subsets 层级 — 多选多个子集**：
```
建议操作 (仅显示所有选中子集共有的建议模块)
├── 批量运行 {Module A} (N 个子集)    ← 所有选中子集都在该模块的 recommended 中
├── ──────────────
└── 更多操作 ▸
    ├── 批量运行 {Module C} (N 个子集) ← 所有选中子集都在该模块的 available 中
    └── ...
──────────────
属性
──────────────
删除 (N 项)
```

**subsets 层级 — 右键空白处**：
```
新建子集
──────────────
刷新
全选
```

**images 层级 — 右键单个图像**：
```
预览
──────────────
重命名
属性
──────────────
删除
```

**images 层级 — 多选多个图像**：
```
属性
──────────────
删除 (N 项)
```

**images 层级 — 右键空白处**：
```
上传图像
──────────────
刷新
全选
```

**管线操作匹配逻辑**：
- 右键子集时，从 `awareness` 数据中筛选包含该子集 ID 的模块
- 模块在 `recommended_subset_ids` 中 → 显示为「建议操作」
- 模块仅在 `available_subset_ids` 中 → 放入「更多操作」子菜单
- 多选时取交集：仅显示所有选中子集 ID 都存在于其列表中的模块
- 按 `suggestion_priority` 排序

##### PropertiesDialog（属性对话框）

**文件**：`features/sample-set/properties-dialog.tsx`

通用属性对话框，根据项目类型显示不同内容：

**子集属性**：
| 字段 | 说明 | 可编辑 |
| --- | --- | --- |
| 名称 | 子集名称 | ✅ |
| 类型 | 子集类型（如 raw, normalized） | ❌ |
| 图像数量 | 包含的图像数 | ❌ |
| 来源模块 | 生成此子集的管线模块名 | ❌ |
| 来源子集 | 源子集名称 | ❌ |
| 创建时间 | 创建时间 | ❌ |
| 元数据 | JSON 编辑器（键值对显示 + 编辑） | ✅ |

**图像属性**：
| 字段 | 说明 | 可编辑 |
| --- | --- | --- |
| 文件名 | 图像文件名 | ✅ |
| 格式 | NIfTI / DICOM | ❌ |
| 源图像 | 关联的源图像文件名 | ❌ |
| 创建时间 | 创建时间 | ❌ |
| 存储路径 | 对象存储路径 | ❌ |
| 元数据 | JSON 编辑器（键值对显示 + 编辑） | ✅ |

##### RunPipelineDialog（运行管线对话框）

**文件**：`features/sample-set/run-pipeline-dialog.tsx`

改进自原有的运行管线对话框，适配新的交互流程：

- **输入子集已预填**：从右键菜单触发时，自动填充选中的子集（单个或多个）
- **模块已预选**：从建议操作或首选操作触发时，自动选择模块
- **输出名称模板**：批量运行时显示模板输入框（默认 `{input_name}_{module}`）
- **参数表单**：根据模块的 `params_schema` 动态渲染（复用 `DynamicForm`）
- **单/批量模式**：
  - 单个子集：显示输出子集名称输入框（文本输入），默认值 `{input_name}_{module_name}`
  - 多个子集：显示输出名称模板输入框（默认 `{input_name}_{module}`）+ 模板预览列表
- **名称冲突检测**：
  - 提交前在前端对比当前样本集的子集列表，检查生成的输出名称是否已存在
  - **重要**：子集列表必须从 Zustand store（`useSampleSetStore`）获取而非路由加载器数据，以确保反映最新状态（删除/新建子集后的实时数据）
  - 若存在冲突：在对话框内显示覆盖确认提示（如「子集 "xxx" 已存在，覆盖将删除原有数据」）
  - 用户确认覆盖后，提交时 `overwrite=true`；不确认则回到编辑状态修改名称
  - 批量运行时，对每个生成的名称独立检测冲突
- **提交**：
  - 单个子集 → 调用 `POST /api/pipelines/run`（含 `output_subset_name`、`params`、`overwrite`）
  - 多个子集 → 调用 `POST /api/pipelines/batch-run`（含 `output_subset_name_template`、`params`、`overwrite`）

##### ImageUploadDialog（图像上传对话框）

**文件**：`features/sample-set/image-upload-dialog.tsx`

- 仅在 images 层级（子集内）可用
- 支持选择 `.nii`、`.nii.gz`、`.dcm`、`.nrrd` 文件
- 上传到当前所在子集
- 调用 `POST /api/sample-sets/{set_id}/subsets/{subset_id}/images`

#### 10.6.5 路由变更

样本集详情页路由简化为挂载浏览器组件：

```tsx
// routes/sample-set.$id.tsx
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // 加载样本集基本信息（名称、描述、分享状态），子集等数据由 Store 自行管理
  const { data, error } = await getSampleSet({ path: { id: params.id } });
  if (error) throw redirect("/app/library");
  return { sampleSet: data };
}

export default function SampleSetPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex h-full flex-col">
      <SampleSetHeader sampleSet={loaderData.sampleSet} />
      <SampleSetBrowser sampleSet={loaderData.sampleSet} />
    </div>
  );
}
```

### 10.7 路由变更

Library 路由页面 (`routes/library.tsx`) 简化为：

```tsx
export default function LibraryPage() {
  return (
    <div className="flex h-full flex-col">
      <LibraryBrowser />
    </div>
  );
}
```

`clientLoader` 不再需要预加载整棵目录树，改由 `LibraryStore` 内部管理数据加载。

---

## 11 · 构建与部署

### 11.1 开发环境

```bash
pnpm run build
```

SPA 模式下，构建产物为静态文件（`build/client/`），可由后端 FastAPI 的 `StaticFiles` 中间件直接托管（参照后端 `app/core/static.py`）。

### 11.2 API 客户端生成流程

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

## 12 · 关键依赖清单

### 12.1 运行依赖

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

### 12.2 开发依赖

| 包名 | 用途 |
| --- | --- |
| `@hey-api/openapi-ts` | OpenAPI → TypeScript 代码生成 |
| `vite` | 构建工具 |
| `typescript` | 类型检查 |

---

## 13 · 设计规范

### 13.1 视觉原则

- **黑白色系**：主体使用 Neutral 色板，保持医学软件的专业克制感
- **留白充足**：卡片间距 `gap-4` 以上，内容不拥挤
- **层次分明**：通过背景色差异（`background` vs `card`）区分内容层级
- **图标一致**：全部使用 Lucide 图标，大小统一（`h-4 w-4` / `h-5 w-5`）
- **字体统一**：全局使用 Inter Variable 字体

### 13.2 交互规范

- **操作反馈**：所有异步操作显示 loading 状态，完成后 toast 提示
- **确认机制**：危险操作（删除）弹出确认对话框
- **空状态**：列表/目录为空时显示引导性空状态组件
- **错误提示**：API 错误通过 toast 展示 `message` 字段，表单校验错误显示在字段下方
- **键盘导航**：对话框支持 `Escape` 关闭，表单支持 `Enter` 提交

### 13.3 响应式

- 最小支持宽度：1280px（PRD 要求）
- Sidebar 在窄屏下自动折叠为图标模式
- 图像查看器占满可用空间，MPR 视口等分

---

## 14 · 决策记录

| # | 决策 | 考虑因素 | 备选方案 |
| --- | --- | --- | --- |
| D1 | SPA 模式 (`ssr: false`) | 医学影像前端依赖大量客户端 API（WebGL、WebSocket），SSR 无优势 | SSR 模式 |
| D2 | Zustand 作为状态管理 | 轻量无样板、与 React hooks 天然契合、支持 persist | Redux Toolkit, Jotai |
| D3 | @hey-api/openapi-ts 生成 API 客户端 | 类型安全、支持 Fetch API、社区活跃、配置简洁 | openapi-typescript, orval |
| D4 | Cornerstone3D v2 | 医学影像领域事实标准、支持 NIfTI + DICOM、内置分割工具 | ITK.js, VTK.js |
| D5 | React Router v7 Framework mode | 类型安全路由、clientLoader 数据加载、项目已初始化 | TanStack Router |
| D6 | 不引入 TanStack Query | 使用 clientLoader 管理服务端数据已足够，减少复杂度 | TanStack Query |
| D7 | 动态表单自实现 | params_schema 结构简单，无需引入完整 JSON Schema 表单库 | react-jsonschema-form |
