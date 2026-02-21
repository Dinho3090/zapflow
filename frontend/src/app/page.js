"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona automaticamente para o login ao abrir a raiz
    router.push("/login");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#080b10] text-white">
      <p>Carregando ZapFlow...</p>
    </div>
  );
}
