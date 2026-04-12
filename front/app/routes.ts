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
    route("app/tasks", "routes/tasks.tsx"),
  ]),
] satisfies RouteConfig;
