"use client"

import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import React from "react";

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function Header({ isDarkMode, toggleTheme }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border px-8 py-4">
      <div className="flex max-w-7xl mx-auto items-center justify-between">
        <div className="flex items-center align-center justify-between gap-3">
          {isDarkMode ?
          <Image
            src="/logo.png"
            alt="HawkEye Logo"
            width={50}
            height={50}
            className="object-contain"
          />
          :
          <Image
            src="/logo2.png"
            alt="HawkEye Logo"
            width={50}
            height={50}
            className="object-contain"
          />   
          }    
          <h1 className="text-xl font-bold text-foreground">HawkEye</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {isDarkMode ? "☀️ Modo Claro" : "🌙 Modo Escuro"}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Database className="h-4 w-4" />
            <span> Admin </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
