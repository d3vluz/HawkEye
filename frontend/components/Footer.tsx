import { Github } from "lucide-react";
import React from "react";

export function Footer() {
  return (
    <footer className="bg-background border-t border-border px-8 py-4">
      <div className="flex max-w-7xl mx-auto items-center justify-between text-sm text-muted-foreground">
  <p>© 2025 HawkEye • <span className="text-red-500">❤️</span> Feito com amor</p>
        
        <a
          href="https://github.com/d3vluz/HawkEye-BackEnd"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          <Github className="w-5 h-5" />
        </a>
      </div>
    </footer>
  );
}
