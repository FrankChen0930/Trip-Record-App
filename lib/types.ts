// ===== 資料庫型別定義 =====

export interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  cover_url: string | null;
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
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  item_name: string;
  amount: number;
  payer: string;
  participants: string[];
  created_at: string;
}

export interface MemberTicketStatus {
  id: string;
  itinerary_id: string;
  member_name: string;
  ticket_link: string | null;
  is_ready: boolean;
}
