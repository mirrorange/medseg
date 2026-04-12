import { client } from "~/api/client.gen";
import { useAuthStore } from "~/stores/auth";

export function setupApiClient() {
  client.setConfig({
    baseUrl: "/api",
  });

  client.interceptors.request.use(async (request) => {
    const token = useAuthStore.getState().token;
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    request.headers.set(
      "Accept-Language",
      navigator.language.startsWith("zh") ? "zh" : "en"
    );
    return request;
  });

  client.interceptors.response.use(async (response) => {
    if (response.status === 401) {
      const { token, logout } = useAuthStore.getState();
      if (token) {
        logout();
        window.location.href = "/login";
      }
    }
    return response;
  });
}
