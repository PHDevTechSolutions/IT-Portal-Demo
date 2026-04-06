"use client";

import { Cpu, Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#050a14]">
      {/* Animated background grid - full screen coverage */}
      <div className="absolute inset-0 h-full w-full">
        <div 
          className="h-full w-full opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            backgroundRepeat: 'repeat'
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/60 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {/* Main loading container */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* CPU Icon with glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/30 blur-xl rounded-full animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <Cpu className="h-10 w-10 text-cyan-400" />
          </div>
        </div>

        {/* Loading spinner */}
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <div className="absolute inset-0 blur-xl bg-cyan-500/30 rounded-full" />
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className="text-cyan-400 text-sm tracking-widest uppercase animate-pulse">
            Initializing System...
          </p>
          <p className="text-slate-500 text-xs mt-2 font-mono">
            LOADING MODULES
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 animate-[loading_2s_ease-in-out_infinite]" 
            style={{
              width: '30%',
              animation: 'loading 2s ease-in-out infinite'
            }}
          />
        </div>
      </div>

      {/* Bottom status */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-slate-600">
        <span className="font-mono">SYSTEM: ONLINE</span>
        <span className="w-px h-4 bg-slate-700" />
        <span className="font-mono">STATUS: LOADING</span>
      </div>

      <style jsx global>{`
        @keyframes loading {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 30%; margin-left: 0%; }
          100% { width: 0%; margin-left: 100%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
