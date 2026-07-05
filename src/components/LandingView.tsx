import React from "react";
import { Paintbrush, Play, Sparkles, LogIn, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface LandingViewProps {
  onSelectFlow: (flow: "logo" | "video") => void;
  onGoToLogin: () => void;
  onGoToTrackOrder: () => void;
  hasExistingOrders: boolean;
}

export default function LandingView({
  onSelectFlow,
  onGoToLogin,
  onGoToTrackOrder,
  hasExistingOrders
}: LandingViewProps) {
  return (
    <div className="min-h-screen hero-gradient text-gray-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Decorative ambient gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/10">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            <div className="absolute inset-0 rounded-lg border border-white/20 animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            AI Design <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-medium">Studio</span>
          </span>
        </div>
        <div className="flex items-center gap-8 text-sm font-medium">
          {hasExistingOrders && (
            <button
              onClick={onGoToTrackOrder}
              className="text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              Pantau Pesanan
            </button>
          )}
          <button
            onClick={onGoToLogin}
            className="px-5 py-2 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
          >
            Login Admin
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 flex-1 flex flex-col justify-center items-center py-12 gap-12">
        <div className="text-center max-w-2xl space-y-4">
          <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 leading-tight">
            Apa yang ingin Anda buat hari ini?
          </h1>
          <p className="text-white/40 text-lg">
            Platform pemesanan jasa desain premium yang dibantu AI untuk menyempurnakan brief Anda.
          </p>
        </div>

        {/* 2 Big Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* Card 1: Logo */}
          <motion.div
            whileHover={{ y: -4 }}
            className="glass p-10 flex flex-col gap-6 hover:border-blue-500/50 transition-all duration-500 group relative"
          >
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <path d="M2 2l7.586 7.586"></path>
                <circle cx="11" cy="11" r="2"></circle>
              </svg>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-3">Buat Logo</h3>
              <p className="text-white/50 leading-relaxed text-sm">
                Buat logo profesional dengan proses yang mudah. AI akan membantu mengumpulkan kebutuhan Anda sebelum dikirim ke desainer ahli kami.
              </p>
            </div>

            <button
              onClick={() => onSelectFlow("logo")}
              className="btn-gradient mt-auto w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg cursor-pointer"
            >
              Mulai Buat Logo
            </button>
          </motion.div>

          {/* Card 2: Video */}
          <motion.div
            whileHover={{ y: -4 }}
            className="glass p-10 flex flex-col gap-6 hover:border-purple-500/50 transition-all duration-500 group relative"
          >
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                <line x1="7" y1="2" x2="7" y2="22"></line>
                <line x1="17" y1="2" x2="17" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="2" y1="7" x2="7" y2="7"></line>
                <line x1="2" y1="17" x2="7" y2="17"></line>
                <line x1="17" y1="17" x2="22" y2="17"></line>
                <line x1="17" y1="7" x2="22" y2="7"></line>
              </svg>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-3">Buat Video</h3>
              <p className="text-white/50 leading-relaxed text-sm">
                Video animasi, pamflet karnaval, promosi event, atau visualizer sound system. Cukup chat dengan AI kami untuk merancang konsep visualnya.
              </p>
            </div>

            <button
              onClick={() => onSelectFlow("video")}
              className="btn-gradient mt-auto w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg cursor-pointer"
            >
              Mulai Buat Video
            </button>
          </motion.div>
        </div>

        <div className="flex gap-8 text-xs font-medium text-white/20 uppercase tracking-[0.2em] mt-4">
          <span>Powered by Gemini API</span>
          <span>•</span>
          <span>Firestore Realtime</span>
          <span>•</span>
          <span>Tailwind CSS</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex justify-between border-t border-white/5 text-xs text-white/30">
        <div>© 2026 AI Design Studio. All rights reserved.</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
