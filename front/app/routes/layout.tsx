import { Outlet, redirect } from "react-router";
import type { Route } from "./+types/layout";
import { getMeApiUsersMeGet } from "~/api";
import { useAuthStore } from "~/stores/auth";
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { UserMenu } from "~/components/user-menu";
import { Separator } from "~/components/ui/separator";
import { useWebSocket } from "~/hooks/use-websocket";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw redirect("/login");
  }

  const { data: user, error } = await getMeApiUsersMeGet();
  if (error || !user) {
    useAuthStore.getState().logout();
    throw redirect("/login");
  }

  // Sync user info to store
  useAuthStore.getState().setUser(user);
  return { user };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  useWebSocket();

  return (
    <SidebarProvider>
      <AppSidebar user={loaderData.user} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
