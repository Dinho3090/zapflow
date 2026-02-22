import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>A carregar o ZapFlow...</p>
    </div>
  );
}
