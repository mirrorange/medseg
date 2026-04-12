import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { loginApiAuthLoginPost, getMeApiUsersMeGet } from "~/api";
import { useAuthStore } from "~/stores/auth";

export function LoginForm() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: tokenData, error: loginError } =
        await loginApiAuthLoginPost({
          body: { username, password },
        });

      if (loginError || !tokenData) {
        setError(
          (loginError as { detail?: { message?: string } })?.detail?.message ??
            "Login failed"
        );
        return;
      }

      // Temporarily set token so getMeApiUsersMeGet can use it via interceptor
      useAuthStore.getState().setAuth(tokenData.access_token, null!);

      const { data: user, error: meError } = await getMeApiUsersMeGet();

      if (meError || !user) {
        useAuthStore.getState().logout();
        setError("Failed to fetch user info");
        return;
      }

      setAuth(tokenData.access_token, user);
      navigate("/app/library");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>
          Enter your credentials to access MedSeg Cloud
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="/register" className="underline underline-offset-4 hover:text-foreground">
              Register
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
