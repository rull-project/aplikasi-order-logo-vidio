import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Send, Sparkles, Upload, Paperclip, ChevronRight, Check,
  AlertCircle, FileText, Trash2, HelpCircle, Download, Clock, CheckCircle, Undo, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FileAttachment, OrderBrief, Order, ChatMessage, OrderStatus } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, doc, onSnapshot, updateDoc, query, getDoc } from "firebase/firestore";

interface ChatViewProps {
  flowType: "logo" | "video";
  onBack: () => void;
  onSubmitOrder: (brief: OrderBrief) => Promise<string>; // returns the order ID
}

export default function ChatView({ flowType, onBack, onSubmitOrder }: ChatViewProps) {
  // Form States
  const [fullName, setFullName] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [brandName, setBrandName] = useState("");
  const [initialRequirements, setInitialRequirements] = useState("");
  const [formError, setFormError] = useState("");

  // Chat/Order States
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "detail">("chat"); // for mobile responsiveness

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Synchronize Order details in real-time once created
  useEffect(() => {
    if (!activeOrderId) return;

    const docRef = doc(db, "orders", activeOrderId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
      }
    }, (err) => {
      console.error("Gagal sinkronisasi data order:", err);
    });

    return () => unsubscribe();
  }, [activeOrderId]);

  // Sync Chat Messages in real-time from Firestore
  useEffect(() => {
    if (!activeOrderId) return;

    const messagesQuery = query(collection(db, `orders/${activeOrderId}/messages`));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgList.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      // Sort messages by timestamp ascending
      msgList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setChatMessages(msgList);
    }, (err) => {
      console.error("Gagal sinkronisasi chat messages:", err);
    });

    return () => unsubscribe();
  }, [activeOrderId]);

  // Handle initialization and creation of the Order
  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!fullName.trim() || !whatsApp.trim() || !brandName.trim() || !initialRequirements.trim()) {
      setFormError("Silakan lengkapi semua bidang di bawah untuk memulai chat.");
      return;
    }

    setIsSubmitting(true);
    try {
      const briefData: OrderBrief = {
        fullName: fullName.trim(),
        whatsApp: whatsApp.trim(),
        brandName: brandName.trim(),
        additionalDetails: initialRequirements.trim()
      };

      // Create Order
      const orderId = await onSubmitOrder(briefData);
      
      // Send the initial requirements message inside the chat
      const messagesRef = collection(db, `orders/${orderId}/messages`);
      await addDoc(messagesRef, {
        sender: "customer",
        text: `Halo, saya mengajukan brief pengerjaan ${flowType === "logo" ? "Logo" : "Video"} untuk brand kami: **${brandName.trim()}**.\n\nDetail kebutuhan:\n"${initialRequirements.trim()}"`,
        timestamp: new Date().toISOString()
      });

      // Set active Order ID to switch to real-time chat interface
      setActiveOrderId(orderId);
    } catch (err) {
      console.error("Gagal memulai chat:", err);
      setFormError("Terjadi kesalahan teknis. Silakan coba kembali.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert uploaded files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: dataUrl
      });
    };
    reader.readAsDataURL(file);
  };

  // Send real-time Chat Message to Firestore
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() && !selectedFile) return;
    if (!activeOrderId) return;

    setIsSendingMsg(true);
    try {
      const messagesRef = collection(db, `orders/${activeOrderId}/messages`);
      
      const newMsg: Omit<ChatMessage, "id"> = {
        sender: "customer",
        text: inputValue.trim() || `Mengirim berkas: ${selectedFile?.name}`,
        timestamp: new Date().toISOString()
      };

      if (selectedFile) {
        newMsg.file = selectedFile;
      }

      await addDoc(messagesRef, newMsg);

      // Create internal notification event for Admin
      await addDoc(collection(db, "notifications"), {
        orderId: activeOrderId,
        text: `Customer ${fullName || "Klien"} mengirimkan pesan/berkas baru dalam diskusi.`,
        createdAt: new Date().toISOString(),
        read: false
      });

      // Reset Inputs
      setInputValue("");
      setSelectedFile(null);
    } catch (err) {
      console.error("Gagal mengirim pesan chat:", err);
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Request Revision for Design Outcomes
  const handleRequestRevisionSubmit = async () => {
    if (!revisionText.trim() || !order || !activeOrderId) return;
    setIsSubmittingRevision(true);

    try {
      const orderRef = doc(db, "orders", activeOrderId);
      
      const currentRevisions = [...(order.revisions || [])];
      currentRevisions.push({
        text: revisionText.trim(),
        timestamp: new Date().toISOString()
      });

      const currentTimeline = [...(order.timeline || [])];
      currentTimeline.push({
        title: "Revisi Diajukan",
        description: `Customer meminta revisi: "${revisionText.trim()}"`,
        timestamp: new Date().toISOString()
      });

      await updateDoc(orderRef, {
        revisions: currentRevisions,
        status: "REVISI" as OrderStatus,
        timeline: currentTimeline
      });

      // Send revision text as chat message
      const messagesRef = collection(db, `orders/${activeOrderId}/messages`);
      await addDoc(messagesRef, {
        sender: "customer",
        text: `⚠️ *AJUAN REVISI KLIEN*:\n"${revisionText.trim()}"`,
        timestamp: new Date().toISOString()
      });

      setRevisionText("");
      setShowRevisionModal(false);
      alert("Permintaan revisi Anda berhasil diajukan secara real-time ke tim desainer!");
    } catch (err) {
      console.error("Gagal mengajukan revisi:", err);
      alert("Gagal mengirim ajuan revisi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // -----------------------------------------------------------------
  // VIEW RENDER: Phase 1 (Initial Form)
  // -----------------------------------------------------------------
  if (!activeOrderId) {
    return (
      <div className="min-h-screen hero-gradient text-gray-200 flex flex-col justify-between relative overflow-hidden font-sans">
        {/* Decorative ambient light */}
        <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-blue-950/20 via-purple-950/5 to-transparent pointer-events-none" />
        
        {/* Header */}
        <header className="relative z-10 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Live Chat & Briefing Instant
              </h1>
              <p className="text-xs text-white/40">
                Mulai konsultasi langsung dengan desainer profesional kami
              </p>
            </div>
          </div>
        </header>

        {/* Main Form Area */}
        <main className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-xl glass p-8 space-y-6 shadow-2xl rounded-3xl border border-white/10">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold mx-auto shadow-lg">
                {flowType === "logo" ? "🎨" : "🎬"}
              </div>
              <h2 className="text-lg font-bold text-white">
                Briefing Jasa {flowType === "logo" ? "Desain Logo" : "Editing Video"}
              </h2>
              <p className="text-xs text-white/50 max-w-sm mx-auto">
                Isi form di bawah untuk merangkum kebutuhan awal Anda dan membuka saluran chat WhatsApp-style dengan Admin desainer secara instan.
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleStartChat} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/60 font-semibold block">Nama Lengkap Anda</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-3 px-4 text-white outline-none transition-all placeholder:text-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/60 font-semibold block">Nomor WhatsApp Aktif</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 081234567890"
                    value={whatsApp}
                    onChange={(e) => setWhatsApp(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-3 px-4 text-white outline-none transition-all placeholder:text-white/20 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/60 font-semibold block">Nama Brand / Judul Projek</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Sembilan Belas / Pamflet Sound System"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-3 px-4 text-white outline-none transition-all placeholder:text-white/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-white/60 font-semibold block">Jelaskan Detail Kebutuhan Awal Anda</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tulis instruksi pengerjaan desain, warna dominan, teks running yang diinginkan, dsb..."
                  value={initialRequirements}
                  onChange={(e) => setInitialRequirements(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl p-4 text-white outline-none transition-all placeholder:text-white/20 resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 btn-gradient text-white font-bold rounded-xl text-xs hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Menyiapkan Diskusi Live...
                  </>
                ) : (
                  <>
                    <span>Mulai Chat Langsung</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        <footer className="py-4 text-center text-[10px] text-white/20 relative z-10">
          AI Design Studio SaaS • Transaksi Terenskripsi & Transparan
        </footer>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // VIEW RENDER: Phase 2 (Real-time Chat with Admin)
  // -----------------------------------------------------------------
  return (
    <div className="min-h-screen hero-gradient text-gray-200 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Decorative ambient light */}
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-blue-950/15 via-purple-950/5 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Real-time Diskusi Jasa: <span className="font-bold text-blue-400">#{activeOrderId.slice(-6)}</span>
            </h1>
            <p className="text-[10px] text-white/40">
              Projek: {brandName} ({flowType === "logo" ? "Logo" : "Video"})
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        {order && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 font-medium hidden sm:inline">Status Pekerjaan:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
              order.status === "MENUNGGU" ? "bg-blue-500/10 text-blue-400" :
              order.status === "SEDANG DIKERJAKAN" ? "bg-amber-500/10 text-amber-400 animate-pulse" :
              order.status === "REVISI" ? "bg-purple-500/10 text-purple-400" :
              "bg-emerald-500/10 text-emerald-400"
            }`}>
              {order.status}
            </span>
          </div>
        )}
      </header>

      {/* Mobile responsive Tabs */}
      <div className="lg:hidden relative z-10 flex border-b border-white/5 bg-[#050505]/60 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 text-center transition-all ${
            activeTab === "chat" ? "text-blue-400 border-b-2 border-blue-500 bg-white/[0.02]" : "text-gray-400"
          }`}
        >
          Ruang Diskusi (Chat)
        </button>
        <button
          onClick={() => setActiveTab("detail")}
          className={`flex-1 py-3 text-center transition-all ${
            activeTab === "detail" ? "text-blue-400 border-b-2 border-blue-500 bg-white/[0.02]" : "text-gray-400"
          }`}
        >
          Detail Projek & Hasil
        </button>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 h-[calc(100vh-140px)] overflow-hidden">
        
        {/* Left Col: Real-time Live Chat Panel (WhatsApp Web style) */}
        <div className={`lg:col-span-2 flex flex-col justify-between h-full bg-[#050505]/40 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden ${
          activeTab === "chat" ? "flex" : "hidden lg:flex"
        }`}>
          
          {/* Chat Messages Log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatMessages.map((m) => {
              const isSelf = m.sender === "customer";
              const isAi = m.sender === "ai";
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-[85%] ${isSelf ? "self-end ml-auto flex-row-reverse animate-[slideIn_0.2s_ease-out]" : "self-start"}`}
                >
                  {/* Icon Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold border ${
                    isSelf ? "bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/20" :
                    isAi ? "bg-purple-600/25 border-purple-500/20 text-purple-400" :
                    "bg-neutral-800 border-white/5 text-gray-300"
                  }`}>
                    {isSelf ? "ME" : isAi ? "AI" : "DS"}
                  </div>

                  {/* Bubble Content */}
                  <div className="space-y-1">
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      isSelf
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md"
                        : "glass rounded-tl-none text-white/90"
                    }`}>
                      <p className="whitespace-pre-line">{m.text}</p>

                      {/* Display attached file if any */}
                      {m.file && (
                        <div className="mt-2.5 p-2 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2">
                          {m.file.type.startsWith("image/") ? (
                            <img
                              src={m.file.dataUrl}
                              alt="Upload preview"
                              className="w-10 h-10 rounded-lg object-cover bg-neutral-950 border border-white/10"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-blue-400">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-[10px] font-medium text-white truncate">{m.file.name}</p>
                            <p className="text-[8px] text-gray-400">{(m.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <a
                            href={m.file.dataUrl}
                            download={m.file.name}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-white/30 block text-right px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}

            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-8">
                <Clock className="w-8 h-8 text-gray-600 mb-2 animate-pulse" />
                <p className="text-xs font-semibold text-white/60">Sedang menyambungkan ke Desainer...</p>
                <p className="text-[10px] text-gray-600 mt-1 max-w-xs">Konsultasikan langsung konsep warna, style, dsb. Desainer kami akan merespon segera di sini.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Inputs & File Attachment Bar */}
          <div className="p-3 bg-white/[0.01] border-t border-white/10 space-y-2">
            
            {/* File Attachment Upload Indicator */}
            {selectedFile && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20 max-w-md">
                <div className="flex items-center gap-2.5 min-w-0 text-left">
                  {selectedFile.type.startsWith("image/") ? (
                    <img
                      src={selectedFile.dataUrl}
                      alt="Selected preview"
                      className="w-8 h-8 rounded object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <FileText className="w-4 h-4 text-blue-400" />
                  )}
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-white truncate">{selectedFile.name}</p>
                    <p className="text-[9px] text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-gray-400 hover:text-red-400 rounded cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main Form Chat input fields */}
            <form onSubmit={handleSendMessage} className="flex gap-2 text-xs">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,application/pdf,application/zip,audio/*"
              />
              <button
                type="button"
                onClick={triggerFileSelect}
                className="p-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-colors"
                title="Pilih Berkas Referensi"
              >
                <Paperclip className="w-4.5 h-4.5" />
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Tulis pesan ke desainer..."
                className="flex-1 bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none transition-all placeholder:text-white/20"
              />

              <button
                type="submit"
                disabled={(!inputValue.trim() && !selectedFile) || isSendingMsg}
                className="p-2.5 px-4 rounded-xl btn-gradient text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Details, Timeline, outcomes & Revision Requests */}
        <div className={`space-y-6 h-full overflow-y-auto ${
          activeTab === "detail" ? "block" : "hidden lg:block"
        }`}>
          
          {/* Outcomes / Files Released Section */}
          {order && order.results && order.results.length > 0 ? (
            <div className="p-5 glass border-emerald-500/20 bg-gradient-to-br from-emerald-950/5 to-transparent space-y-4 rounded-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>Hasil Pekerjaan Tersedia!</span>
                </div>
                {order.status !== "SELESAI" && (
                  <button
                    onClick={() => setShowRevisionModal(true)}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 py-1 px-2.5 rounded-full bg-purple-500/5 border border-purple-500/20 cursor-pointer transition-all"
                  >
                    Ajukan Revisi
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {order.results.map((r, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className="text-[9px] text-gray-500 font-bold uppercase block">{r.type}</span>
                        <p className="text-white font-bold truncate">{r.name}</p>
                      </div>
                      <a
                        href={r.dataUrl}
                        download={r.name}
                        className="p-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all flex items-center gap-1 cursor-pointer text-[10px]"
                      >
                        <Download className="w-3 h-3" /> Unduh
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5 glass space-y-3 text-center rounded-3xl">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto animate-pulse border border-blue-500/20">
                <Clock className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Desain Sedang Diproses</h4>
                <p className="text-[10px] text-white/40 mt-1">
                  Desainer profesional kami sedang mengerjakan brief Anda. Proses memakan waktu 1-3 hari. Semua hasil file rilis akan tampil secara otomatis di panel ini secara real-time.
                </p>
              </div>
            </div>
          )}

          {/* Project Timeline Process */}
          {order && (
            <div className="p-5 glass space-y-4 rounded-3xl">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Progress Timeline Kerja
              </h3>
              
              <div className="space-y-4 relative pl-5 before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-white/5 max-h-48 overflow-y-auto">
                {(order.timeline || []).map((ev, i) => (
                  <div key={i} className="relative space-y-0.5 text-[11px]">
                    <div className="absolute left-[-19px] top-1 w-2.5 h-2.5 rounded-full border border-[#050505] bg-blue-500 shadow shadow-blue-500/50" />
                    <div className="flex justify-between items-start gap-4">
                      <span className="font-bold text-white">{ev.title}</span>
                      <span className="text-[9px] text-white/40 shrink-0">
                        {new Date(ev.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-white/60 text-[10px]">{ev.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID Tracking Info */}
          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-blue-400 leading-normal text-[10px] space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 shrink-0" /> ID Pelacakan Mandiri:
            </p>
            <p className="font-mono text-[11px] text-white select-all bg-white/5 py-1 px-2 rounded-lg border border-white/5">{activeOrderId}</p>
            <p className="text-white/45">
              Simpan ID di atas! Anda bisa menggunakannya di menu "Lacak Pesanan" pada halaman utama untuk membuka chat ini kembali kapan saja.
            </p>
          </div>
        </div>
      </div>

      {/* Revision Modal Form overlay */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 text-xs">
          <div className="w-full max-w-md p-6 glass space-y-4 rounded-3xl border border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Undo className="w-4 h-4 text-purple-400" />
              Ajukan Revisi Hasil Desain
            </h3>
            <p className="text-[11px] text-white/45">
              Jelaskan bagian mana saja yang ingin diubah. Desainer akan melihat ajuan revisi Anda secara real-time dan memperbarui file hasil pengerjaan.
            </p>

            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              placeholder="Contoh: Tolong ubah tagline menjadi warna putih solid, dan ganti latar belakang video visualizer menjadi cyberpunk neon biru..."
              className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl p-3 text-white outline-none min-h-[100px] placeholder:text-white/20 resize-none leading-relaxed"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleRequestRevisionSubmit}
                disabled={!revisionText.trim() || isSubmittingRevision}
                className="flex-1 py-2.5 btn-gradient disabled:opacity-50 text-white rounded-xl transition-all cursor-pointer font-semibold"
              >
                Kirim Revisi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
