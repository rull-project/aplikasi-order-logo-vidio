export type OrderStatus = "MENUNGGU" | "SEDANG DIKERJAKAN" | "REVISI" | "SELESAI";

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl: string; // Base64 string for preview & download
}

export interface AdminResultFile {
  type: "logo" | "video" | "thumbnail" | "zip";
  name: string;
  dataUrl: string;
}

export interface TimelineEvent {
  title: string;
  description: string;
  timestamp: string; // ISO String
}

export interface RevisionRequest {
  text: string;
  timestamp: string; // ISO String
}

export interface OrderBrief {
  // Logo Brief
  fullName?: string;
  whatsApp?: string;
  brandName?: string;
  businessSector?: string;
  tagline?: string;
  targetCustomer?: string;
  logoStyle?: string;
  primaryColor?: string;
  referenceFile?: FileAttachment | null;
  oldLogoFile?: FileAttachment | null;
  additionalDetails?: string;

  // Video Brief
  videoType?: string;
  duration?: string;
  style?: string;
  dominantColor?: string;
  uploadedLogo?: FileAttachment | null;
  uploadedPoster?: FileAttachment | null;
  uploadedFoto?: FileAttachment | null;
  uploadedLagu?: FileAttachment | null;
  uploadedReference?: FileAttachment | null;
}

export interface Order {
  id: string;
  customerName: string;
  customerWhatsApp: string;
  orderType: "logo" | "video";
  status: OrderStatus;
  createdAt: string; // ISO string
  brief: OrderBrief;
  adminNotes?: string;
  timeline: TimelineEvent[];
  revisions: RevisionRequest[];
  results: AdminResultFile[];
}

export interface ChatMessage {
  id: string;
  sender: "customer" | "admin" | "ai";
  text: string;
  timestamp: string; // ISO string
  file?: FileAttachment | null;
}
