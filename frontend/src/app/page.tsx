import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to StoreSync
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Multi-location marketing operations platform with AI-powered content
          generation.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
