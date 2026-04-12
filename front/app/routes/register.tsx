import type { Route } from "./+types/register";
import { ModeToggle } from "~/components/mode-toggle";
import { RegisterForm } from "~/features/auth/register-form";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Register - MedSeg Cloud" }];
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <RegisterForm />
    </div>
  );
}
