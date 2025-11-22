"use client"

import { Button } from "@/components/ui/button";
import { Database, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function Header() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 bg-background border-b border-border px-8 py-4">
         <div className="flex max-w-7xl mx-auto items-center justify-between">
             <div className="h-10 w-32" /> 
         </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border px-8 py-4">
      <div className="flex max-w-7xl mx-auto items-center justify-between">
        <div className="flex items-center align-center justify-between gap-3">
          {resolvedTheme === "dark" ? (
            <Image
              src="/logo.png"
              alt="HawkEye Logo"
              width={50}
              height={50}
              className="object-contain"
            />
          ) : (
            <Image
              src="/logo2.png"
              alt="HawkEye Logo"
              width={50}
              height={50}
              className="object-contain"
            />
          )}
          <h1 className="text-xl font-bold text-foreground">HawkEye</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            {resolvedTheme === "dark" ? (
              <>
                <Sun className="h-4 w-4" />
                <span>Modo Claro</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span>Modo Escuro</span>
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin")}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <Database className="h-4 w-4" />
            <span> Admin </span>
          </Button>
        </div>
      </div>
    </header>
  );
}