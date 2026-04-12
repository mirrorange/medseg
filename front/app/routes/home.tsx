import type { Route } from "./+types/home";
import { ModeToggle } from "~/components/mode-toggle";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MedSeg Cloud" },
    {
      name: "description",
      content: "Medical Image Cloud Processing & Annotation Platform",
    },
  ];
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          MedSeg Cloud
        </h1>
        <p className="max-w-md text-muted-foreground">
          Medical Image Cloud Processing & Annotation Platform
        </p>
        <div className="flex gap-3">
          <a
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Register
          </a>
        </div>
      </div>
    </div>
  );
}
