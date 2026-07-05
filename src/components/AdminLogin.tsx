import React, { useState } from "react";
import { Sparkles, Lock, Mail, AlertCircle, ArrowLeft } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBack }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Simulate validation with default credentials
    setTimeout(() => {
      if (email === "admin@aidesign.com" && password === "admin123") {
        onLoginSuccess();
      } else {
        setError("Email atau Password salah. Silakan coba lagi.");
      }
      setIsLoading(false);
    }, 600);
  };

  const autofillCredentials = () => {
    setEmail("admin@aidesign.com");
    setPassword("admin123");
    setError("");
  };

  return (
    <div className="min-h-screen hero-gradient text-gray-100 flex flex-col justify-center items-center relative overflow-hidden px-4 font-sans">
      {/* Background ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 px-5 py-2 text-xs font-medium text-white/80 hover:text-white border border-white/10 bg-white/5 rounded-full transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 inline-block mr-1.5 align-text-bottom" />
        Kembali ke Beranda
      </button>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
          <div className="w-5 h-5 border-2 border-white rounded-sm"></div>
          <div className="absolute inset-0 rounded-xl border border-white/20" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
          AI Design <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-medium">Studio</span>
        </h1>
        <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Portal Keamanan Admin</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md p-8 glass shadow-2xl relative space-y-6">
        <div className="space-y-1.5 text-center">
          <h2 className="text-xl font-semibold text-white">Selamat Datang Kembali</h2>
          <p className="text-xs text-white/50">Masuk untuk mengelola brief dan hasil desain customer</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Alamat Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-white/40" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aidesign.com"
                className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-white/40" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl btn-gradient text-white font-bold text-base shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? "Memvalidasi..." : "Masuk Sebagai Admin"}
          </button>
        </form>

        {/* Demo Credentials Hint */}
        <div className="pt-4 border-t border-white/5 text-center space-y-2">
          <p className="text-[10px] text-white/30">
            Untuk pengujian & demo, silakan klik tombol instan di bawah ini:
          </p>
          <button
            onClick={autofillCredentials}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 py-1.5 px-3 rounded-full bg-blue-500/5 border border-blue-500/20 cursor-pointer hover:bg-blue-500/10 transition-all inline-flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gunakan Akun Demo Admin
          </button>
        </div>
      </div>
    </div>
  );
}
