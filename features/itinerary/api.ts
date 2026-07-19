import { supabase } from '@/lib/supabase/client';

export interface ItineraryPayload {
  day: number;
  start_time: string;
  end_time: string | null;
  location: string;
  transport_type: string;
  item_type: string;
  note: string;
  trip_id: string | undefined;
  map_url: string;
  lat?: number | null;       // P5a: 地圖座標
  lng?: number | null;
  place_id?: string | null;
}

export interface TicketStatusInput {
  itinerary_id: string;
  member_name: string;
  ticket_link: string | null;
  is_ready: boolean;
}

export const itineraryApi = {
  list: (tripId: string) =>
    supabase.from('trip_itinerary').select('*').eq('trip_id', tripId).order('day').order('start_time'),
  listTicketStatuses: () =>
    supabase.from('trip_member_ticket_status').select('*'),
  listAccommodations: (tripId: string) =>
    supabase.from('trip_accommodations').select('*').eq('trip_id', tripId),
  create: (payload: ItineraryPayload) =>
    supabase.from('trip_itinerary').insert([payload]),
  update: (id: string, payload: ItineraryPayload) =>
    supabase.from('trip_itinerary').update(payload).eq('id', id),
  remove: (id: string) =>
    supabase.from('trip_itinerary').delete().eq('id', id),
  // 營業時間快取寫回（見 useOpeningHours；空陣列＝查過但該地點沒資訊）
  updateOpeningHours: (id: string, opening_hours: { weekdayDescriptions: string[] }) =>
    supabase.from('trip_itinerary').update({ opening_hours }).eq('id', id),
  upsertTicketStatus: (status: TicketStatusInput) =>
    supabase.from('trip_member_ticket_status').upsert(status, { onConflict: 'itinerary_id,member_name' }),
};
