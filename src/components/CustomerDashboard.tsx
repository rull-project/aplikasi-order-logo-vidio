import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, ArrowLeft, Search, Bell, Clock, CheckCircle, HelpCircle, Download,
  MessageSquare, Send, FileText, Calendar, ShieldAlert, AlertCircle, RefreshCw, Undo, Play,
  Paperclip, Trash2
} from "lucide-react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, updateDoc, collection, addDoc, query, where, getDoc } from "firebase/firestore";
import { Order, OrderStatus, ChatMessage, RevisionRequest, FileAttachment } from "../types";

interface CustomerDashboardProps {
  initialOrderId?: string | null;
  onBack: () => void;
}

export default function CustomerDashboard({ initialOrderId, onBack }: CustomerDashboardProps) {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(initialOrderId || null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chat and Notifications
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [customerChatText, setCustomerChatText] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [revisionText, setRevisionText] = useState("");
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If initialOrderId is supplied, immediately look it up
  useEffect(() => {
    if (initialOrderId) {
      setActiveOrderId(initialOrderId);
    }
  }, [initialOrderId]);

  // Synchronize Order details in real-time if we have an activeOrderId
  useEffect(() => {
    if (!activeOrderId) return;
    setLoading(true);
    setError("");

    // Look up by doc ID (or find matching suffix)
    const docRef = doc(db, "orders", activeOrderId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        setError("");
      } else {
        // Fallback: search if it's a suffix
        setError("ID Pesanan tidak ditemukan. Pastikan ID yang dimasukkan sesuai.");
        setOrder(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Gagal melacak pesanan:", err);
      setError("Kesalahan sinkronisasi database.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeOrderId]);

  // Sync Chat Messages
  useEffect(() => {
    if (!activeOrderId) return;
    const messagesQuery = query(collection(db, `orders/${activeOrderId}/messages`));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgList.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      msgList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setChatMessages(msgList);
      
      // scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => unsubscribe();
  }, [activeOrderId]);

  // Sync Notifications for this order
  useEffect(() => {
    if (!activeOrderId) return;
    const notifQuery = query(collection(db, "notifications"), where("orderId", "==", activeOrderId));
    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list);
    });

    return () => unsubscribe();
  }, [activeOrderId]);

  const handleTrackOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdInput.trim()) return;
    setActiveOrderId(orderIdInput.trim());
  };

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

  const handleSendCustomerMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerChatText.trim() && !selectedFile) return;
    if (!activeOrderId) return;

    setIsSendingMsg(true);
    try {
      const messagesRef = collection(db, `orders/${activeOrderId}/messages`);
      const newMsg: any = {
        sender: "customer",
        text: customerChatText.trim() || `Mengirim berkas: ${selectedFile?.name}`,
        timestamp: new Date().toISOString()
      };

      if (selectedFile) {
        newMsg.file = selectedFile;
      }

      await addDoc(messagesRef, newMsg);
      setCustomerChatText("");
      setSelectedFile(null);

      // Create notification for admin
      await addDoc(collection(db, "notifications"), {
        orderId: activeOrderId,
        text: `Customer ${order?.customerName || "Klien"} mengirimkan pesan/berkas baru dalam diskusi.`,
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error("Gagal mengirim pesan chat:", err);
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleRequestRevision = async () => {
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

      setRevisionText("");
      setShowRevisionModal(false);
      alert("Permintaan revisi Anda berhasil dikirim ke tim desainer!");
    } catch (err) {
      console.error("Gagal mengajukan revisi:", err);
      alert("Gagal mengirim revisi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient text-gray-200 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Decorative background ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />

      {/* Search Order Tracker View if no active order loaded */}
      {!order ? (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative z-10">
          {/* Back button */}
          <button
            onClick={onBack}
            className="absolute top-6 left-6 px-5 py-2 text-xs font-medium text-white/80 hover:text-white border border-white/10 bg-white/5 rounded-full transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 inline-block mr-1.5 align-text-bottom" />
            Kembali ke Beranda
          </button>

          <div className="w-full max-w-md text-center space-y-6">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Clock className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">Pantau Pesanan Desain Anda</h1>
              <p className="text-xs text-white/40">Masukkan ID Pesanan Anda untuk melacak brief, timeline kerja, file hasil, dan chat desainer.</p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-xs text-red-400 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleTrackOrderSubmit} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Masukkan ID Pesanan (Contoh: z7yXwb...)"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-3.5 pl-11 pr-4 text-xs text-white outline-none transition-all placeholder:text-white/20 font-mono"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 btn-gradient text-white font-bold text-sm rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menyinkronkan...
                  </>
                ) : (
                  "Lacak Pesanan"
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Customer Dashboard loaded with Order details */
        <div className="flex-1 flex flex-col min-h-screen">
          
          {/* Header */}
          <header className="border-b border-white/5 bg-[#050505]/80 backdrop-blur-md px-6 py-4 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setOrder(null);
                  setActiveOrderId(null);
                }}
                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xs font-semibold text-white">ID Pesanan: <span className="font-mono text-blue-400 font-bold">#{order.id.slice(-6)}</span></h1>
                <p className="text-[10px] text-white/40">Atas Nama: {order.customerName}</p>
              </div>
            </div>

            {/* Dynamic Status Badges */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 font-medium">Status Pekerjaan:</span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                order.status === "MENUNGGU" ? "bg-blue-500/10 text-blue-400" :
                order.status === "SEDANG DIKERJAKAN" ? "bg-amber-500/10 text-amber-400 animate-pulse" :
                order.status === "REVISI" ? "bg-purple-500/10 text-purple-400" :
                "bg-emerald-500/10 text-emerald-400"
              }`}>
                {order.status}
              </span>
            </div>
          </header>

          {/* Main workspace dashboard */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            
            {/* Left col: Timeline & Outcome preview */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Outcome Preview Area (Show only if outcomes are uploaded by Admin) */}
              {order.results && order.results.length > 0 ? (
                <div className="p-6 glass border-emerald-500/20 bg-gradient-to-br from-emerald-950/5 to-transparent space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <h3 className="font-bold text-sm">Hasil Pekerjaan Desain Rilis!</h3>
                    </div>
                    {order.status !== "SELESAI" && (
                      <button
                        onClick={() => setShowRevisionModal(true)}
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 py-1.5 px-3 rounded-full bg-purple-500/5 border border-purple-500/20 cursor-pointer transition-all"
                      >
                        Ajukan Revisi Hasil
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-white/40">
                    Tim desainer kami telah mengunggah file hasil desain di bawah ini. Silakan pratinjau dan download hasil final Anda:
                  </p>

                  {/* Outcome list Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {order.results.map((r, i) => {
                      const isImage = r.type === "logo" || r.type === "thumbnail";
                      return (
                        <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3.5">
                          {isImage ? (
                            <div className="relative group rounded-xl overflow-hidden bg-neutral-950 aspect-video flex items-center justify-center border border-white/10">
                              <img src={r.dataUrl} alt={r.name} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="rounded-xl bg-neutral-950 aspect-video flex flex-col items-center justify-center text-center p-4 border border-white/10 gap-2">
                              {r.type === "video" ? (
                                <>
                                  <Play className="w-8 h-8 text-purple-400" />
                                  <span className="text-[10px] font-mono text-gray-400">Berkas Video Tersemat</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-8 h-8 text-amber-400" />
                                  <span className="text-[10px] font-mono text-gray-400">Kumpulan File Mentah (ZIP)</span>
                                </>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center text-xs">
                            <div className="min-w-0">
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">{r.type}</span>
                              <p className="text-white font-medium truncate">{r.name}</p>
                            </div>
                            <a
                              href={r.dataUrl}
                              download={r.name}
                              className="p-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex items-center gap-1.5 cursor-pointer text-xs"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* No outcome yet: Show elegant active production process card */
                <div className="p-8 glass space-y-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto animate-pulse border border-blue-500/20">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-sm font-bold text-white">Desain Anda Sedang Diproduksi</h3>
                    <p className="text-xs text-white/40">
                      Briefing otomatis Anda telah diserahkan ke desainer pro kami. Proses desain memakan waktu 1-3 hari tergantung antrean.
                    </p>
                  </div>
                  <div className="text-[10px] text-white/30 font-mono">
                    ID Transaksi: #{order.id}
                  </div>
                </div>
              )}

              {/* Work Process Timeline */}
              <div className="p-6 glass space-y-4">
                <h3 className="text-sm font-bold text-white">Timeline Perkembangan Proyek</h3>
                
                <div className="space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5">
                  {(order.timeline || []).map((ev, i) => (
                    <div key={i} className="relative space-y-1 text-xs">
                      {/* circle node */}
                      <div className="absolute left-[-22px] top-1 w-3.5 h-3.5 rounded-full border border-[#050505] bg-blue-500 shadow shadow-blue-500/50" />
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-bold text-white">{ev.title}</span>
                        <span className="text-[10px] text-white/40 shrink-0">
                          {new Date(ev.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-white/60">{ev.description}</p>
                    </div>
                  ))}

                  {/* Root placement event */}
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute left-[-22px] top-1 w-3.5 h-3.5 rounded-full border border-[#050505] bg-gray-600" />
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-400">Briefing Terkirim</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="text-gray-500">Penyusunan brief dibantu asisten AI selesai.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right col: Direct chat with designer team & notifications */}
            <div className="lg:col-span-1 space-y-6 flex flex-col h-[75vh]">
              
              {/* Direct Chat Card */}
              <div className="flex-1 rounded-3xl border border-white/10 bg-[#050505]/40 backdrop-blur-md flex flex-col justify-between overflow-hidden">
                <div className="border-b border-white/10 bg-white/[0.02] px-5 py-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-white">Diskusi Revisi & Hasil</span>
                  </div>
                  <span className="text-[9px] text-white/30 font-mono uppercase tracking-wider font-bold">DESAINER PRO</span>
                </div>

                {/* Message body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                  {chatMessages.map((m) => {
                    const isSelf = m.sender === "customer";
                    const isAi = m.sender === "ai";
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-2.5 max-w-[85%] ${isSelf ? "self-end ml-auto flex-row-reverse" : "self-start"}`}
                      >
                        <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                          isSelf ? "bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/20" : "bg-neutral-800 border-white/5 text-gray-300"
                        }`}>
                          {isSelf ? "ME" : isAi ? "AI" : "AD"}
                        </div>
                        <div className="space-y-1">
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isSelf
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "glass rounded-tl-none text-white/90"
                          }`}>
                            <p className="whitespace-pre-line">{m.text}</p>
                            
                            {m.file && (
                              <div className="mt-2.5 p-2 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2 text-left">
                                {m.file.type.startsWith("image/") ? (
                                  <img
                                    src={m.file.dataUrl}
                                    alt="Attached asset"
                                    className="w-10 h-10 rounded object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <FileText className="w-5 h-5 text-blue-400" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] text-white truncate font-medium">{m.file.name}</p>
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
                          <span className="text-[9px] text-white/30 block text-right">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 p-4">
                      <MessageSquare className="w-5 h-5 mb-1 text-gray-700" />
                      <p className="text-[10px]">Tulis pesan di bawah untuk berdiskusi revisi langsung dengan desainer pro kami.</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input action */}
                <div className="p-3 bg-white/[0.01] border-t border-white/10 space-y-2">
                  {selectedFile && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs">
                      <span className="text-white truncate max-w-[200px]">{selectedFile.name}</span>
                      <button onClick={() => setSelectedFile(null)} className="text-red-400 hover:text-red-300 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSendCustomerMessage} className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,application/pdf,application/zip,audio/*"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    
                    <input
                      type="text"
                      value={customerChatText}
                      onChange={(e) => setCustomerChatText(e.target.value)}
                      placeholder="Tulis pesan ke desainer..."
                      className="flex-1 bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-2 px-3 text-xs text-white outline-none placeholder:text-white/20"
                    />
                    <button
                      type="submit"
                      disabled={(!customerChatText.trim() && !selectedFile) || isSendingMsg}
                      className="p-2 rounded-xl btn-gradient disabled:opacity-55 text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Notification Center */}
              <div className="p-4 rounded-3xl border border-white/10 bg-[#050505]/40 backdrop-blur-md max-h-48 overflow-y-auto space-y-3 shrink-0">
                <span className="text-[10px] font-bold text-white/40 block uppercase tracking-wider">Notifikasi Aktivitas</span>
                <div className="space-y-2">
                  {notifications.map((n, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-[10px] leading-normal text-white/80 flex items-start gap-2">
                      <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p>{n.text}</p>
                        <span className="text-[9px] text-white/30 block mt-1">
                          {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-[10px] text-white/30 text-center py-2">Belum ada notifikasi pesanan.</p>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Revision Modal Form */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 glass space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Undo className="w-4 h-4 text-purple-400" />
              Ajukan Revisi Hasil Desain
            </h3>
            <p className="text-xs text-white/40">
              Jelaskan bagian mana saja dari Logo/Video yang ingin diubah secara detail. Desainer akan segera merevisi dan mengunggah hasilnya kembali.
            </p>

            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              placeholder="Contoh: Tolong ubah warna latar belakang video menjadi sedikit biru gelap cyberpunk, dan buat tagline logo kami lebih tebal..."
              className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white outline-none min-h-[120px] placeholder:text-white/20"
            />

            <div className="flex gap-3 text-xs">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleRequestRevision}
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
