import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),

  // Authenticated area
  layout("routes/layout.tsx", [
    route("app/library", "routes/library.tsx"),
    route("app/shared", "routes/shared-library.tsx"),
    route("app/sample-sets/:id", "routes/sample-set.$id.tsx"),
    route("app/tasks", "routes/tasks.tsx"),
    route("app/viewer/:setId/:subsetId", "routes/viewer.$setId.$subsetId.tsx"),

    // Admin routes
    route("app/admin/users", "routes/admin.users.tsx"),
    route("app/admin/modules", "routes/admin.modules.tsx"),
    route("app/admin/sample-sets", "routes/admin.sample-sets.tsx"),
  ]),
] satisfies RouteConfig;
