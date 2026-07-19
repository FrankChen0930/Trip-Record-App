// ===== 資料庫型別定義 =====

export interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  cover_url: string | null;
  group_id: string | null;
  created_at?: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  day: number;
  start_time: string | null;
  end_time: string | null;
  location: string;
  transport_type: string;
  item_type: 'activity' | 'ticket';
  note: string | null;
  map_url: string | null;
  lat?: number | null;       // P5a: 地圖座標
  lng?: number | null;
  place_id?: string | null;  // P5b: Google Places ID
  // 營業時間快取（第一次顯示時打 Google 後永久存 DB；空陣列＝查過但該地點沒資訊）
  opening_hours?: { weekdayDescriptions: string[] } | null;
  member_statuses?: MemberTicketStatus[];
}

export interface Photo {
  id: string;
  trip_id: string;
  day: number;
  url: string;
  storage_path: string | null;
  is_storage: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  real_name: string;
  nickname: string;
  pin: string;
  email?: string | null;     // P2: 用於 Magic Link 登入對應
  user_id?: string | null;   // P2: 綁定的 Supabase Auth 使用者
  role?: 'admin' | 'member'; // P6/p9: admin 可管理名冊與身分組；member 唯讀
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  item_name: string;
  amount: number;
  payer: string;
  participants: string[];
  split_type?: 'equal' | 'custom';
  split_details?: Record<string, number>;
  is_transfer?: boolean;
  created_at: string;
}

export interface BucketItem {
  id: string;
  trip_id: string;
  category: 'accommodation' | 'attraction' | 'note';
  title: string;
  price?: number;
  link?: string;
  note?: string;
  lat?: number | null;       // P5a: 地圖座標
  lng?: number | null;
  place_id?: string | null;  // P5b: Google Places ID
  address?: string | null;
  rating?: number | null;
  created_at: string;
}

export interface TripMemo {
  id: string;
  trip_id: string;
  member_id: string | null;
  title?: string;
  content: string;
  is_checked: boolean;
  type: 'text' | 'heading1' | 'todo';
  sort_order: number;
  created_at: string;
}

export interface TripAccommodation {
  id: string;
  trip_id: string;
  day: number;
  name: string;
  map_url?: string;
  booking_url?: string;
  note?: string | null;       // 備註 / 注意事項
  check_in?: string | null;   // 入住時間 (time, "15:00:00")
  check_out?: string | null;  // 退房時間
  created_at: string;
}

export interface MemberTicketStatus {
  id: string;
  itinerary_id: string;
  member_name: string;
  ticket_link: string | null;
  is_ready: boolean;
}

// ===== 新增：身分組系統 =====

export interface Group {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  member_id: string;
}

// ===== 新增：探索清單（旅程之外的想去/再去口袋名單） =====

export type WishSourceType = 'instagram' | 'youtube' | 'friend' | 'visited' | 'other';

export interface WishPlace {
  id: string;
  title: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  rating: number | null;
  found_by: string | null;        // trip_members.id
  source_type: WishSourceType;
  source_url: string | null;
  note: string | null;
  expires_at: string | null;      // 限時活動截止日
  business_status: string | null; // OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY / NOT_FOUND
  status_checked_at: string | null;
  created_at: string;
}

// ===== 新增：每日日記 =====

export interface Journal {
  id: string;
  trip_id: string;
  day: number;
  content: string;
  created_at: string;
  updated_at: string;
}
