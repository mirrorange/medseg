import type { Route } from "./+types/login";
import { ModeToggle } from "~/components/mode-toggle";
import { LoginForm } from "~/features/auth/login-form";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign In - MedSeg Cloud" }];
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <LoginForm />
    </div>
  );
}
