import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, LayoutDashboard, ShoppingBag, Users, MessageSquare, FolderOpen,
  CreditCard, History, Settings, LogOut, Check, Search, Calendar, Phone, Clock,
  Filter, ChevronRight, FileText, Download, Edit, RefreshCw, Send, Image as ImageIcon,
  CheckCircle, Loader2, AlertCircle, PlusCircle, Paperclip, Trash2
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, getDocs, getDoc, setDoc } from "firebase/firestore";
import { Order, OrderStatus, AdminResultFile, ChatMessage, FileAttachment } from "../types";

interface AdminDashboardProps {
  onLogout: () => void;
}

type TabType = "dashboard" | "pesanan" | "customer" | "chat" | "file" | "pembayaran" | "riwayat" | "pengaturan";

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Chat related states inside Admin Portal
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [adminChatText, setAdminChatText] = useState("");
  const [selectedChatFile, setSelectedChatFile] = useState<FileAttachment | null>(null);
  const [isSendingChatMsg, setIsSendingChatMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  // Upload outcome states
  const [outcomeLogo, setOutcomeLogo] = useState<AdminResultFile | null>(null);
  const [outcomeVideo, setOutcomeVideo] = useState<AdminResultFile | null>(null);
  const [outcomeThumb, setOutcomeThumb] = useState<AdminResultFile | null>(null);
  const [outcomeZip, setOutcomeZip] = useState<AdminResultFile | null>(null);
  const [adminNotesText, setAdminNotesText] = useState("");
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Pricing & Settings states connected to Firestore
  const [biayaLogo, setBiayaLogo] = useState<number>(350000);
  const [biayaVideo, setBiayaVideo] = useState<number>(650000);
  const [inputBiayaLogo, setInputBiayaLogo] = useState<string>("350000");
  const [inputBiayaVideo, setInputBiayaVideo] = useState<string>("650000");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Load Settings from Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "pricing");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.biayaLogo !== undefined) {
            setBiayaLogo(Number(data.biayaLogo));
            setInputBiayaLogo(String(data.biayaLogo));
          }
          if (data.biayaVideo !== undefined) {
            setBiayaVideo(Number(data.biayaVideo));
            setInputBiayaVideo(String(data.biayaVideo));
          }
        } else {
          // If settings document doesn't exist yet, automatically initialize it
          await setDoc(docRef, {
            biayaLogo: 350000,
            biayaVideo: 650000,
            updatedAt: new Date().toISOString()
          });
          setBiayaLogo(350000);
          setInputBiayaLogo("350000");
          setBiayaVideo(650000);
          setInputBiayaVideo("650000");
        }
      } catch (err) {
        console.error("Error loading settings from Firestore:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);
    try {
      const logoPrice = Number(inputBiayaLogo);
      const videoPrice = Number(inputBiayaVideo);
      if (isNaN(logoPrice) || logoPrice <= 0 || isNaN(videoPrice) || videoPrice <= 0) {
        throw new Error("Biaya harus berupa angka positif.");
      }

      const docRef = doc(db, "settings", "pricing");
      await setDoc(docRef, {
        biayaLogo: logoPrice,
        biayaVideo: videoPrice,
        updatedAt: new Date().toISOString()
      });

      setBiayaLogo(logoPrice);
      setBiayaVideo(videoPrice);
      setSettingsSuccess("Pengaturan biaya jasa berhasil diperbarui!");
      
      // Auto clear success alert after 3 seconds
      setTimeout(() => {
        setSettingsSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error saving settings to Firestore:", err);
      setSettingsError(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Stats
  const [stats, setStats] = useState({
    baru: 0,
    proses: 0,
    revisi: 0,
    selesai: 0,
    pendapatan: 0,
    customersCount: 0
  });

  // Listen to orders collection from Firestore
  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList: Order[] = [];
      snapshot.forEach((doc) => {
        ordersList.push({ id: doc.id, ...doc.data() } as Order);
      });
      
      // Sort orders by date descending
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersList);
      setLoading(false);

      // Re-evaluate stats
      let baru = 0, proses = 0, revisi = 0, selesai = 0, pendapatan = 0;
      const customersSet = new Set<string>();

      ordersList.forEach((o) => {
        customersSet.add(o.customerWhatsApp);
        if (o.status === "MENUNGGU") baru++;
        else if (o.status === "SEDANG DIKERJAKAN") proses++;
        else if (o.status === "REVISI") revisi++;
        else if (o.status === "SELESAI") selesai++;

        // Calculate simulated revenue based on settings
        if (o.status === "SELESAI") {
          pendapatan += o.orderType === "logo" ? biayaLogo : biayaVideo;
        } else {
          // Half deposit or active projects also add to revenue
          pendapatan += o.orderType === "logo" ? (biayaLogo / 2) : (biayaVideo / 2);
        }
      });

      setStats({
        baru,
        proses,
        revisi,
        selesai,
        pendapatan,
        customersCount: customersSet.size
      });

      // Update currently active selected order in detail side panel if it was updated
      if (selectedOrder) {
        const updated = ordersList.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    }, (error) => {
      console.error("Firestore listening error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedOrder?.id, biayaLogo, biayaVideo]);

  // Listen to messages for active chat thread
  useEffect(() => {
    if (!activeChatOrderId) return;
    const messagesQuery = query(collection(db, `orders/${activeChatOrderId}/messages`));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgList.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      // Sort messages by date ascending
      msgList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setChatMessages(msgList);
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => unsubscribe();
  }, [activeChatOrderId]);

  // Auto-set the first order in active chat tab if none selected
  useEffect(() => {
    if (activeTab === "chat" && !activeChatOrderId && orders.length > 0) {
      setActiveChatOrderId(orders[0].id);
    }
  }, [activeTab, orders, activeChatOrderId]);

  // Convert files for outcome uploads
  const handleResultFileChange = (type: "logo" | "video" | "thumbnail" | "zip", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const resFile: AdminResultFile = {
        type,
        name: file.name,
        dataUrl
      };

      if (type === "logo") setOutcomeLogo(resFile);
      else if (type === "video") setOutcomeVideo(resFile);
      else if (type === "thumbnail") setOutcomeThumb(resFile);
      else if (type === "zip") setOutcomeZip(resFile);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateOrderStatusAndFiles = async () => {
    if (!selectedOrder) return;
    setIsUpdatingOrder(true);

    try {
      const orderRef = doc(db, "orders", selectedOrder.id);
      
      // Gather outcome files uploaded
      const currentResults = [...(selectedOrder.results || [])];
      if (outcomeLogo) currentResults.push(outcomeLogo);
      if (outcomeVideo) currentResults.push(outcomeVideo);
      if (outcomeThumb) currentResults.push(outcomeThumb);
      if (outcomeZip) currentResults.push(outcomeZip);

      // Create new timeline event if status changed
      const currentTimeline = [...(selectedOrder.timeline || [])];
      
      const updates: any = {
        results: currentResults,
        adminNotes: adminNotesText || selectedOrder.adminNotes || ""
      };

      if (outcomeLogo || outcomeVideo || outcomeThumb || outcomeZip) {
        currentTimeline.push({
          title: "Hasil Desain Diunggah",
          description: `Desainer telah mengunggah hasil pekerjaan (${[
            outcomeLogo && "Logo",
            outcomeVideo && "Video",
            outcomeThumb && "Thumbnail",
            outcomeZip && "File ZIP"
          ].filter(Boolean).join(", ")}).`,
          timestamp: new Date().toISOString()
        });
        
        // Add notification event
        await addDoc(collection(db, "notifications"), {
          orderId: selectedOrder.id,
          text: `Tim desainer telah merilis file hasil pengerjaan untuk pesanan Anda #${selectedOrder.id.slice(-6)}!`,
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      updates.timeline = currentTimeline;
      await updateDoc(orderRef, updates);

      // Reset outcome files selection
      setOutcomeLogo(null);
      setOutcomeVideo(null);
      setOutcomeThumb(null);
      setOutcomeZip(null);

      alert("Pekerjaan berhasil diperbarui dan dikirim ke Customer!");
    } catch (err) {
      console.error("Gagal mengupdate order:", err);
      alert("Terjadi kesalahan ketika memperbarui order.");
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    try {
      const orderRef = doc(db, "orders", selectedOrder.id);
      const currentTimeline = [...(selectedOrder.timeline || [])];

      currentTimeline.push({
        title: `Status Diubah ke ${newStatus}`,
        description: `Pekerjaan Anda kini berstatus: ${newStatus}`,
        timestamp: new Date().toISOString()
      });

      await updateDoc(orderRef, {
        status: newStatus,
        timeline: currentTimeline
      });

      // Add customer notification
      await addDoc(collection(db, "notifications"), {
        orderId: selectedOrder.id,
        text: `Pesanan Anda #${selectedOrder.id.slice(-6)} kini berstatus: ${newStatus}`,
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error("Gagal mengganti status:", err);
    }
  };

  const handleAdminChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedChatFile({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: dataUrl
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendAdminChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminChatText.trim() && !selectedChatFile) return;
    if (!activeChatOrderId) return;

    setIsSendingChatMsg(true);
    try {
      const messagesRef = collection(db, `orders/${activeChatOrderId}/messages`);
      const newMsg: any = {
        sender: "admin",
        text: adminChatText.trim() || `Mengirim berkas: ${selectedChatFile?.name}`,
        timestamp: new Date().toISOString()
      };

      if (selectedChatFile) {
        newMsg.file = selectedChatFile;
      }

      await addDoc(messagesRef, newMsg);
      setAdminChatText("");
      setSelectedChatFile(null);

      // Create notification for customer
      await addDoc(collection(db, "notifications"), {
        orderId: activeChatOrderId,
        text: `Admin mengirimkan pesan chat baru untuk Anda.`,
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error("Gagal mengirim pesan chat:", err);
    } finally {
      setIsSendingChatMsg(false);
    }
  };

  // Filtered orders list for the table
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerWhatsApp.includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate unique customer analytics list
  const customersList = Array.from(new Set(orders.map(o => o.customerWhatsApp))).map(wa => {
    const customerOrders = orders.filter(o => o.customerWhatsApp === wa);
    return {
      whatsApp: wa,
      name: customerOrders[0]?.customerName || "Customer",
      totalOrders: customerOrders.length,
      lastOrderDate: customerOrders[0]?.createdAt,
      totalSpent: customerOrders.reduce((sum, o) => sum + (o.status === "SELESAI" ? (o.orderType === "logo" ? biayaLogo : biayaVideo) : 0), 0)
    };
  });

  // File lists (all reference files uploaded)
  const filesList: { name: string; size: number; source: string; orderId: string }[] = [];
  orders.forEach(o => {
    // Collect from brief files
    Object.entries(o.brief || {}).forEach(([key, val]) => {
      if (val && typeof val === "object" && (val as any).name) {
        filesList.push({
          name: (val as any).name,
          size: (val as any).size || 0,
          source: `Customer Brief (${key})`,
          orderId: o.id
        });
      }
    });
    // Collect from results
    (o.results || []).forEach(r => {
      filesList.push({
        name: r.name,
        size: 204800, // estimated
        source: `Admin Outcome (${r.type})`,
        orderId: o.id
      });
    });
  });

  return (
    <div className="min-h-screen hero-gradient text-gray-200 flex font-sans relative overflow-hidden">
      {/* Decorative background ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#050505]/60 backdrop-blur-md p-5 flex flex-col justify-between shrink-0 relative z-20">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-white text-sm">
              AI Studio <span className="text-xs bg-blue-500/10 text-blue-400 font-semibold px-1.5 py-0.5 rounded-md ml-1">Admin</span>
            </span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "pesanan", label: "Pesanan", icon: ShoppingBag, badge: stats.baru },
              { id: "customer", label: "Customer", icon: Users },
              { id: "chat", label: "Live Chat", icon: MessageSquare },
              { id: "file", label: "File Explorer", icon: FolderOpen },
              { id: "pembayaran", label: "Pembayaran", icon: CreditCard },
              { id: "riwayat", label: "Riwayat", icon: History },
              { id: "pengaturan", label: "Pengaturan", icon: Settings }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "btn-gradient text-white shadow-lg shadow-blue-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>Keluar Portal</span>
        </button>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto relative z-10">
        
        {/* Top bar header */}
        <header className="border-b border-white/5 bg-[#050505]/40 backdrop-blur-md px-8 py-5 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-base font-bold text-white capitalize">
              {activeTab === "pesanan" ? "Daftar Pesanan Brief" : `${activeTab} Workspace`}
            </h1>
            <p className="text-xs text-white/40">Kelola dan selesaikan kebutuhan visual klien Anda</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30 font-mono">
              Live Connection: <span className="text-emerald-400">● Online</span>
            </span>
          </div>
        </header>

        {/* Dynamic content rendering based on activeTab */}
        <div className="p-8 flex-1">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-xs font-mono">Sinkronisasi data Firestore...</p>
            </div>
          ) : activeTab === "dashboard" ? (
            /* Tab 1: Dashboard Analytics */
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Order Baru", value: stats.baru, color: "text-blue-400", desc: "Menunggu brief di-review" },
                  { label: "Sedang Dikerjakan", value: stats.proses, color: "text-amber-400", desc: "Sedang di-desain oleh tim" },
                  { label: "Dalam Revisi", value: stats.revisi, color: "text-purple-400", desc: "Customer mengajukan revisi" },
                  { label: "Selesai", value: stats.selesai, color: "text-emerald-400", desc: "Hasil terkirim dan disetujui" }
                ].map((s, idx) => (
                  <div key={idx} className="p-6 glass space-y-1">
                    <span className="text-xs font-semibold text-white/40">{s.label}</span>
                    <p className={`text-3xl font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-white/30">{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* Financial & Customer Summary row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 glass flex flex-col justify-between min-h-[160px]">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-white/40">Estimasi Pendapatan SaaS</span>
                    <h2 className="text-3xl font-extrabold text-white">
                      Rp {stats.pendapatan.toLocaleString("id-ID")}
                    </h2>
                    <p className="text-[10px] text-white/30">
                      Dihitung berdasarkan pesanan selesai dan uang muka aktif (sesuai pengaturan biaya layanan).
                    </p>
                  </div>
                  <div className="flex gap-2.5 pt-4">
                    <div className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full font-semibold border border-blue-500/20">
                      Harga Logo: Rp {biayaLogo.toLocaleString("id-ID")} / order
                    </div>
                    <div className="text-xs bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-full font-semibold border border-purple-500/20">
                      Harga Video: Rp {biayaVideo.toLocaleString("id-ID")} / order
                    </div>
                  </div>
                </div>

                <div className="p-6 glass flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white/40 font-medium">Total Customer</span>
                    <p className="text-4xl font-black text-white mt-1">{stats.customersCount}</p>
                    <p className="text-[10px] text-white/30 mt-1">Unique WhatsApp client databases</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("customer")}
                    className="w-full mt-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full text-xs font-semibold transition-all cursor-pointer"
                  >
                    Lihat Direktori Customer
                  </button>
                </div>
              </div>

              {/* Recent Orders List */}
              <div className="p-6 glass space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white">Aktivitas Pesanan Terkini</h3>
                  <button
                    onClick={() => setActiveTab("pesanan")}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    Lihat Semua
                  </button>
                </div>

                <div className="space-y-2.5">
                  {orders.slice(0, 4).map((o) => (
                    <div
                      key={o.id}
                      onClick={() => {
                        setSelectedOrder(o);
                        setActiveTab("pesanan");
                      }}
                      className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 flex items-center justify-between transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                          o.orderType === "logo" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                        }`}>
                          {o.orderType === "logo" ? "LG" : "VD"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{o.customerName}</p>
                          <p className="text-[10px] text-white/30 font-mono">ID: #{o.id.slice(-6)} • {o.brief.brandName || "No Brand"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-white/40">
                            {new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-0.5 ${
                            o.status === "MENUNGGU" ? "bg-blue-500/10 text-blue-400" :
                            o.status === "SEDANG DIKERJAKAN" ? "bg-amber-500/10 text-amber-400" :
                            o.status === "REVISI" ? "bg-purple-500/10 text-purple-400" :
                            "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {o.status}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20" />
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-500">
                      Belum ada pesanan masuk di dalam sistem.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "pesanan" ? (
            /* Tab 2: Pesanan Table & Detail view */
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* Left col: Table List */}
              <div className="xl:col-span-2 space-y-4">
                {/* Search & filters */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/[0.01] p-4 rounded-2xl border border-white/5">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Cari Customer, Brand, WhatsApp..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs text-white outline-none focus:border-blue-500/30 transition-all placeholder:text-gray-600"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white/[0.02] border border-white/5 rounded-xl py-2 px-3 text-xs text-gray-300 outline-none cursor-pointer"
                    >
                      <option value="all">Semua Status</option>
                      <option value="MENUNGGU">Menunggu</option>
                      <option value="SEDANG DIKERJAKAN">Sedang Dikerjakan</option>
                      <option value="REVISI">Revisi</option>
                      <option value="SELESAI">Selesai</option>
                    </select>
                  </div>
                </div>

                {/* Table wrapper */}
                <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 font-medium">
                        <th className="p-4">Nomor Order</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">WhatsApp</th>
                        <th className="p-4">Jenis Pesanan</th>
                        <th className="p-4">Tanggal Masuk</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => {
                            setSelectedOrder(o);
                            setAdminNotesText(o.adminNotes || "");
                          }}
                          className={`border-b border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer ${
                            selectedOrder?.id === o.id ? "bg-blue-600/5 border-l-2 border-l-blue-500" : ""
                          }`}
                        >
                          <td className="p-4 font-mono text-blue-400 font-bold">
                            #{o.id.slice(-6)}
                          </td>
                          <td className="p-4 font-bold text-white">{o.customerName}</td>
                          <td className="p-4">{o.customerWhatsApp}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              o.orderType === "logo" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                            }`}>
                              {o.orderType === "logo" ? "🎨 Logo" : "🎬 Video"}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400">
                            {new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              o.status === "MENUNGGU" ? "bg-blue-500/10 text-blue-400" :
                              o.status === "SEDANG DIKERJAKAN" ? "bg-amber-500/10 text-amber-400" :
                              o.status === "REVISI" ? "bg-purple-500/10 text-purple-400" :
                              "bg-emerald-500/10 text-emerald-400"
                            }`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            Tidak ada pesanan yang sesuai filter pencarian.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right col: Order details side sheet */}
              <div className="xl:col-span-1">
                {selectedOrder ? (
                  <div className="p-6 rounded-3xl border border-white/5 bg-[#0a0a0d] space-y-6 max-h-[85vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-white/5 pb-4">
                      <div>
                        <span className="text-[10px] text-blue-400 font-mono font-bold">DETAIL PESANAN</span>
                        <h2 className="text-base font-extrabold text-white">ID: #{selectedOrder.id.slice(-6)}</h2>
                        <p className="text-xs text-gray-500 mt-1">Jenis: {selectedOrder.orderType.toUpperCase()}</p>
                      </div>
                      
                      {/* Status Dropdown selector */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 block font-medium">Ubah Status</span>
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                          className="bg-white/5 border border-white/10 rounded-xl py-1.5 px-2.5 text-xs text-white font-semibold outline-none cursor-pointer"
                        >
                          <option value="MENUNGGU">MENUNGGU</option>
                          <option value="SEDANG DIKERJAKAN">SEDANG DIKERJAKAN</option>
                          <option value="REVISI">REVISI</option>
                          <option value="SELESAI">SELESAI</option>
                        </select>
                      </div>
                    </div>

                    {/* Customer Identity */}
                    <div className="space-y-2.5 text-xs">
                      <h4 className="font-bold text-gray-400">Informasi Klien</h4>
                      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="flex justify-between"><span className="text-gray-500">Nama</span> <span className="text-white font-medium">{selectedOrder.customerName}</span></div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">WhatsApp</span> 
                          <a href={`https://wa.me/${selectedOrder.customerWhatsApp}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono">
                            {selectedOrder.customerWhatsApp}
                          </a>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-500">Tanggal Masuk</span> <span className="text-white">{new Date(selectedOrder.createdAt).toLocaleString("id-ID")}</span></div>
                      </div>
                    </div>

                    {/* AI Brief Questionnaire Answers */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        Semua Jawaban Briefing AI
                      </h4>
                      <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4 max-h-72 overflow-y-auto text-xs">
                        {Object.entries(selectedOrder.brief || {}).map(([key, value]) => {
                          if (!value) return null;
                          const isFileObj = typeof value === "object" && (value as any).dataUrl;

                          return (
                            <div key={key} className="space-y-1.5 border-b border-white/[0.03] pb-3 last:border-0 last:pb-0">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">{key}</span>
                              {isFileObj ? (
                                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {(value as any).type?.startsWith("image/") ? (
                                      <img src={(value as any).dataUrl} className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                                    )}
                                    <span className="text-white text-xs truncate">{(value as any).name}</span>
                                  </div>
                                  <a
                                    href={(value as any).dataUrl}
                                    download={(value as any).name}
                                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              ) : (
                                <p className="text-gray-200 leading-relaxed font-medium">{String(value)}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Admin Notes Section */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400">Catatan Internal Admin / Desainer</label>
                      <textarea
                        value={adminNotesText}
                        onChange={(e) => setAdminNotesText(e.target.value)}
                        placeholder="Tuliskan catatan teknis revisi, estimasi selesai, progres, dll..."
                        className="w-full bg-white/[0.02] border border-white/5 focus:border-blue-500/30 rounded-xl p-3 text-xs text-white outline-none min-h-[70px] resize-none"
                      />
                    </div>

                    {/* UPLOAD HASIL SECTION */}
                    <div className="space-y-3.5 border-t border-white/5 pt-5">
                      <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                        <PlusCircle className="w-4 h-4 text-emerald-400" />
                        Unggah Hasil Desain untuk Klien
                      </h4>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Outcome Logo */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">HASIL LOGO</span>
                          <input
                            type="file"
                            id="admin-logo-upload"
                            className="hidden"
                            onChange={(e) => handleResultFileChange("logo", e)}
                            accept="image/*"
                          />
                          {outcomeLogo ? (
                            <span className="text-[10px] text-emerald-400 font-bold truncate mt-1">✓ {outcomeLogo.name}</span>
                          ) : (
                            <button
                              onClick={() => document.getElementById("admin-logo-upload")?.click()}
                              className="mt-2 text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Paperclip className="w-3.5 h-3.5" /> Pilih Logo
                            </button>
                          )}
                        </div>

                        {/* Outcome Video */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">HASIL VIDEO</span>
                          <input
                            type="file"
                            id="admin-video-upload"
                            className="hidden"
                            onChange={(e) => handleResultFileChange("video", e)}
                            accept="video/*"
                          />
                          {outcomeVideo ? (
                            <span className="text-[10px] text-emerald-400 font-bold truncate mt-1">✓ {outcomeVideo.name}</span>
                          ) : (
                            <button
                              onClick={() => document.getElementById("admin-video-upload")?.click()}
                              className="mt-2 text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Paperclip className="w-3.5 h-3.5" /> Pilih Video
                            </button>
                          )}
                        </div>

                        {/* Outcome Thumbnail */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">HASIL THUMBNAIL</span>
                          <input
                            type="file"
                            id="admin-thumb-upload"
                            className="hidden"
                            onChange={(e) => handleResultFileChange("thumbnail", e)}
                            accept="image/*"
                          />
                          {outcomeThumb ? (
                            <span className="text-[10px] text-emerald-400 font-bold truncate mt-1">✓ {outcomeThumb.name}</span>
                          ) : (
                            <button
                              onClick={() => document.getElementById("admin-thumb-upload")?.click()}
                              className="mt-2 text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Paperclip className="w-3.5 h-3.5" /> Pilih Thumb
                            </button>
                          )}
                        </div>

                        {/* Outcome ZIP */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">HASIL FILE ZIP</span>
                          <input
                            type="file"
                            id="admin-zip-upload"
                            className="hidden"
                            onChange={(e) => handleResultFileChange("zip", e)}
                            accept=".zip,.rar,.tar"
                          />
                          {outcomeZip ? (
                            <span className="text-[10px] text-emerald-400 font-bold truncate mt-1">✓ {outcomeZip.name}</span>
                          ) : (
                            <button
                              onClick={() => document.getElementById("admin-zip-upload")?.click()}
                              className="mt-2 text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Paperclip className="w-3.5 h-3.5" /> Pilih ZIP
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Submit Update */}
                      <button
                        onClick={handleUpdateOrderStatusAndFiles}
                        disabled={isUpdatingOrder}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isUpdatingOrder ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Mengunggah Data ke Klien...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Kirim ke Customer
                          </>
                        )}
                      </button>
                    </div>

                    {/* Render existing Outcome Files list */}
                    {selectedOrder.results && selectedOrder.results.length > 0 && (
                      <div className="space-y-2 border-t border-white/5 pt-4">
                        <span className="text-xs font-bold text-gray-400 block">Daftar Hasil yang Sudah Terkirim:</span>
                        <div className="space-y-2">
                          {selectedOrder.results.map((r, i) => (
                            <div key={i} className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between text-xs text-emerald-400 font-semibold">
                              <span className="truncate">{r.type.toUpperCase()}: {r.name}</span>
                              <a href={r.dataUrl} download={r.name} className="text-emerald-400 hover:text-white cursor-pointer">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-96 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-center text-gray-500 p-8">
                    <ShoppingBag className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-xs font-semibold">Pilih Salah Satu Pesanan</p>
                    <p className="text-[10px] text-gray-600 mt-1">Klik pesanan pada tabel sebelah kiri untuk melihat detail brief AI, file upload, dan mengirim hasil pekerjaan.</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "customer" ? (
            /* Tab 3: Customer Directory */
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-white mb-2">Direktori Database Customer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customersList.map((c, idx) => (
                  <div key={idx} className="p-6 rounded-3xl border border-white/5 bg-white/[0.01] space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 font-bold text-xs">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{c.name}</h4>
                        <a href={`https://wa.me/${c.whatsApp}`} target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 hover:underline">
                          {c.whatsApp}
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs border-t border-white/5 pt-4">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Total Pesanan</span>
                        <span className="text-white font-bold">{c.totalOrders} Order</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Total Belanja</span>
                        <span className="text-emerald-400 font-bold">Rp {c.totalSpent.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {customersList.length === 0 && (
                  <div className="col-span-full text-center py-12 text-xs text-gray-500">
                    Belum ada database customer terdaftar.
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "chat" ? (
            /* Tab 4: Live Chat between Admin and active Customer order */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[65vh]">
              {/* Left Column: Chat Threads List */}
              <div className="lg:col-span-1 border border-white/5 bg-[#0a0a0d] rounded-3xl overflow-y-auto p-4 space-y-2">
                <h3 className="text-xs font-bold text-gray-400 mb-4 px-2 uppercase tracking-wider">Saluran Diskusi Aktif</h3>
                {orders.map((o) => {
                  const isActive = activeChatOrderId === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setActiveChatOrderId(o.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-white/[0.01] hover:bg-white/[0.03] border-white/5 text-gray-300"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold truncate">{o.customerName}</p>
                        <p className={`text-[10px] mt-1 font-mono ${isActive ? "text-blue-200" : "text-gray-500"}`}>
                          Order: #{o.id.slice(-6)} • {o.brief.brandName || "No Brand"}
                        </p>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${isActive ? "bg-white/20 text-white" : "bg-white/5 text-gray-400"}`}>
                        {o.orderType.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Chat Box */}
              <div className="lg:col-span-2 border border-white/5 bg-[#0a0a0d] rounded-3xl flex flex-col justify-between overflow-hidden">
                {activeChatOrderId ? (
                  <>
                    {/* Chat Header */}
                    <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          Diskusi dengan {orders.find(o => o.id === activeChatOrderId)?.customerName}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">ID Pesanan: #{activeChatOrderId.slice(-6)}</p>
                      </div>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                      {chatMessages.map((m) => {
                        const isSelf = m.sender === "admin";
                        const isAi = m.sender === "ai";
                        return (
                          <div
                            key={m.id}
                            className={`flex gap-3 max-w-[80%] ${isSelf ? "self-end ml-auto flex-row-reverse" : "self-start"}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border text-xs font-bold ${
                              isSelf ? "bg-blue-600 text-white border-blue-500" :
                              isAi ? "bg-purple-600/25 text-purple-400 border-purple-500/20" :
                              "bg-neutral-800 text-gray-300 border-white/5"
                            }`}>
                              {isSelf ? "AD" : isAi ? "AI" : "CS"}
                            </div>
                            <div className="space-y-1">
                              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                isSelf
                                  ? "bg-blue-600 text-white rounded-tr-none"
                                  : "bg-white/[0.03] text-gray-200 border border-white/5 rounded-tl-none"
                              }`}>
                                <p className="whitespace-pre-line">{m.text}</p>
                              </div>
                              <span className="text-[9px] text-gray-500 block text-right">
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {chatMessages.length === 0 && (
                        <div className="h-full flex items-center justify-center text-xs text-gray-500">
                          Belum ada obrolan dalam diskusi pesanan ini.
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input form */}
                    <form onSubmit={handleSendAdminChatMessage} className="p-4 border-t border-white/5 bg-white/[0.01] flex gap-3">
                      <input
                        type="text"
                        value={adminChatText}
                        onChange={(e) => setAdminChatText(e.target.value)}
                        placeholder="Tulis tanggapan / revisi hasil desain..."
                        className="flex-1 bg-white/[0.02] border border-white/5 focus:border-blue-500/30 rounded-xl py-3 px-4 text-xs text-white outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!adminChatText.trim()}
                        className="py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Kirim
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-8">
                    <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-xs font-semibold">Pilih Percakapan Diskusi</p>
                    <p className="text-[10px] text-gray-600 mt-1">Silakan pilih salah satu saluran order untuk mulai berdiskusi langsung dengan klien.</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "file" ? (
            /* Tab 5: File Explorer */
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-white mb-2">Daftar Semua File Terunggah</h3>
              <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 font-medium">
                      <th className="p-4">Nama File</th>
                      <th className="p-4">Ukuran</th>
                      <th className="p-4">Sumber</th>
                      <th className="p-4">ID Pesanan</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filesList.map((f, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="p-4 font-bold text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="truncate max-w-xs">{f.name}</span>
                        </td>
                        <td className="p-4 text-gray-400">{(f.size / 1024).toFixed(1)} KB</td>
                        <td className="p-4">{f.source}</td>
                        <td className="p-4 font-mono text-blue-400">#{f.orderId.slice(-6)}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedOrder(orders.find(o => o.id === f.orderId) || null);
                              setActiveTab("pesanan");
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                          >
                            Buka Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">
                          Belum ada berkas terunggah di dalam database.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "pembayaran" ? (
            /* Tab 6: Pembayaran */
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-white">Lacak & Verifikasi Invoice Pembayaran</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orders.map((o) => {
                  const basePrice = o.orderType === "logo" ? biayaLogo : biayaVideo;
                  return (
                    <div key={o.id} className="p-6 rounded-3xl border border-white/5 bg-white/[0.01] space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-gray-500 block font-mono">ORDER ID: #{o.id.slice(-6)}</span>
                          <h4 className="text-xs font-bold text-white mt-0.5">{o.customerName}</h4>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          o.status === "SELESAI" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {o.status === "SELESAI" ? "LUNAS" : "DEPOSIT AKTIF"}
                        </span>
                      </div>

                      <div className="border-t border-white/5 pt-3.5 space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">Kategori Jasa</span> <span className="text-white">{o.orderType === "logo" ? "Pengerjaan Desain Logo Pro" : "Penyusunan Video Pamflet / Opening"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Total Tarif</span> <span className="text-white font-bold">Rp {basePrice.toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Pembayaran Diterima</span> <span className="text-emerald-400 font-bold">Rp {(o.status === "SELESAI" ? basePrice : basePrice / 2).toLocaleString("id-ID")}</span></div>
                      </div>
                    </div>
                  );
                })}
                {orders.length === 0 && (
                  <div className="col-span-full text-center py-12 text-xs text-gray-500">
                    Belum ada transaksi pembayaran.
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "riwayat" ? (
            /* Tab 7: Riwayat */
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-white">Riwayat Pesanan yang Selesai</h3>
              <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 font-medium">
                      <th className="p-4">Nomor Order</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">WhatsApp</th>
                      <th className="p-4">Hasil Karya</th>
                      <th className="p-4">Tanggal Selesai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.status === "SELESAI").map((o) => (
                      <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="p-4 font-mono text-emerald-400 font-bold">#{o.id.slice(-6)}</td>
                        <td className="p-4 font-bold text-white">{o.customerName}</td>
                        <td className="p-4">{o.customerWhatsApp}</td>
                        <td className="p-4 text-emerald-400">✓ {(o.results || []).length} Berkas Rilis</td>
                        <td className="p-4 text-gray-400">
                          {new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                    {orders.filter(o => o.status === "SELESAI").length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">
                          Belum ada riwayat pesanan bersatuts SELESAI.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Tab 8: Pengaturan */
            <div className="max-w-xl p-8 rounded-3xl border border-white/5 bg-white/[0.01] space-y-6">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">SaaS Platform Settings</h3>
                <p className="text-xs text-gray-400">Konfigurasi pengaturan instansi AI Design Studio</p>
              </div>

              {settingsSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-gray-400 block font-semibold">Nama Platform</label>
                  <input
                    type="text"
                    defaultValue="AI Design Studio SaaS"
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-2.5 px-3.5 text-white/55 outline-none cursor-not-allowed"
                    disabled
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-gray-400 block font-semibold">Biaya Logo Jasa (IDR)</label>
                    <input
                      type="number"
                      value={inputBiayaLogo}
                      onChange={(e) => setInputBiayaLogo(e.target.value)}
                      placeholder="350000"
                      className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-2.5 px-3.5 text-white outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-gray-400 block font-semibold">Biaya Video Jasa (IDR)</label>
                    <input
                      type="number"
                      value={inputBiayaVideo}
                      onChange={(e) => setInputBiayaVideo(e.target.value)}
                      placeholder="650000"
                      className="w-full bg-white/[0.02] border border-white/10 focus:border-blue-500/50 rounded-xl py-2.5 px-3.5 text-white outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="w-full py-3.5 btn-gradient text-white font-bold text-xs rounded-xl hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan ke Firestore...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Simpan Pengaturan
                    </>
                  )}
                </button>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-blue-400 leading-relaxed text-[10px]">
                  Semua transaksi diproses langsung menggunakan server Firestore cloud terproteksi. Mengubah biaya di sini akan langsung merubah kalkulasi estimasi pendapatan secara dinamis di dashboard.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
