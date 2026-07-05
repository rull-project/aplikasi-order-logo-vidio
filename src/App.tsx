import React, { useState, useEffect } from "react";
import LandingView from "./components/LandingView";
import ChatView from "./components/ChatView";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import CustomerDashboard from "./components/CustomerDashboard";
import { db } from "./lib/firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { OrderBrief, Order, OrderStatus } from "./types";

type RouteView = "landing" | "logo-chat" | "video-chat" | "admin-login" | "admin-dashboard" | "customer-dashboard";

export default function App() {
  const [currentView, setCurrentView] = useState<RouteView>("landing");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);

  // Read the last order ID from local storage on load so the user can easily trace their active brief
  useEffect(() => {
    const savedId = localStorage.getItem("last_design_order_id");
    if (savedId) {
      setLastCreatedOrderId(savedId);
    }

    const adminSession = localStorage.getItem("admin_logged_in");
    if (adminSession === "true") {
      setIsAdminLoggedIn(true);
      setCurrentView("admin-dashboard");
    }
  }, []);

  // Submit order to Firestore
  const handleSubmitOrderToDatabase = async (brief: OrderBrief, orderType: "logo" | "video"): Promise<string> => {
    try {
      const ordersRef = collection(db, "orders");
      const clientName = brief.fullName || "Customer";
      const clientWA = brief.whatsApp || "081234567890";

      const orderData: Omit<Order, "id"> = {
        customerName: clientName,
        customerWhatsApp: clientWA,
        orderType: orderType,
        status: "MENUNGGU" as OrderStatus,
        createdAt: new Date().toISOString(),
        brief: brief,
        adminNotes: "",
        timeline: [
          {
            title: "Brief Dibuat",
            description: `Kebutuhan ${orderType === "logo" ? "Logo" : "Video"} Anda berhasil dirangkum oleh asisten AI Studio.`,
            timestamp: new Date().toISOString()
          },
          {
            title: "Pesanan Menunggu",
            description: "Menunggu tim desainer pro menyetujui brief dan menetapkan jadwal kerja.",
            timestamp: new Date().toISOString()
          }
        ],
        revisions: [],
        results: []
      };

      const docRef = await addDoc(ordersRef, orderData);
      const generatedId = docRef.id;

      // Persist locally so client can track immediately
      localStorage.setItem("last_design_order_id", generatedId);
      setLastCreatedOrderId(generatedId);

      // Seed initial welcoming message in order chat
      const messagesRef = collection(db, `orders/${generatedId}/messages`);
      await addDoc(messagesRef, {
        sender: "ai",
        text: `Halo ${clientName}! Chat diskusi pesanan #${generatedId.slice(-6)} Anda telah dibuka. Tim desainer kami akan meninjau dan merespon di sini jika ada revisi hasil.`,
        timestamp: new Date().toISOString()
      });

      return generatedId;
    } catch (error) {
      console.error("Gagal menyimpan order ke database:", error);
      throw error;
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    localStorage.setItem("admin_logged_in", "true");
    setCurrentView("admin-dashboard");
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem("admin_logged_in");
    setCurrentView("landing");
  };

  return (
    <>
      {currentView === "landing" && (
        <LandingView
          onSelectFlow={(flow) => {
            if (flow === "logo") setCurrentView("logo-chat");
            else setCurrentView("video-chat");
          }}
          onGoToLogin={() => {
            if (isAdminLoggedIn) setCurrentView("admin-dashboard");
            else setCurrentView("admin-login");
          }}
          onGoToTrackOrder={() => setCurrentView("customer-dashboard")}
          hasExistingOrders={!!lastCreatedOrderId}
        />
      )}

      {(currentView === "logo-chat" || currentView === "video-chat") && (
        <ChatView
          flowType={currentView === "logo-chat" ? "logo" : "video"}
          onBack={() => setCurrentView("landing")}
          onSubmitOrder={(brief) =>
            handleSubmitOrderToDatabase(brief, currentView === "logo-chat" ? "logo" : "video")
          }
        />
      )}

      {currentView === "admin-login" && (
        <AdminLogin
          onLoginSuccess={handleAdminLoginSuccess}
          onBack={() => setCurrentView("landing")}
        />
      )}

      {currentView === "admin-dashboard" && (
        <AdminDashboard onLogout={handleAdminLogout} />
      )}

      {currentView === "customer-dashboard" && (
        <CustomerDashboard
          initialOrderId={lastCreatedOrderId}
          onBack={() => setCurrentView("landing")}
        />
      )}
    </>
  );
}
