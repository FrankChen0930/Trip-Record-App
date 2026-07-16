import { supabase } from '@/lib/supabase/client';

export const planApi = {
  listItinerary: (tripId: string) =>
    supabase.from('trip_itinerary').select('*').eq('trip_id', tripId).order('start_time'),
  listAccommodations: (tripId: string) =>
    supabase.from('trip_accommodations').select('*').eq('trip_id', tripId),
  listBucket: (tripId: string) =>
    supabase.from('trip_bucket_list').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),

  insertItinerary: (row: Record<string, unknown>) =>
    supabase.from('trip_itinerary').insert([row]),
  updateItinerary: (id: string, data: Record<string, unknown>) =>
    supabase.from('trip_itinerary').update(data).eq('id', id),
  removeItinerary: (id: string) =>
    supabase.from('trip_itinerary').delete().eq('id', id),

  addBucket: (row: {
    trip_id: string | undefined; category: string; title: string;
    note?: string | null; link?: string | null; price?: number | null;
    lat?: number | null; lng?: number | null; place_id?: string | null; address?: string | null; rating?: number | null;
  }) =>
    supabase.from('trip_bucket_list').insert([row]),
  updateBucket: (id: string, data: Record<string, unknown>) =>
    supabase.from('trip_bucket_list').update(data).eq('id', id),
  removeBucket: (id: string) =>
    supabase.from('trip_bucket_list').delete().eq('id', id),

  insertAccommodation: (row: { trip_id: string | undefined; day: number; name: string; map_url: string; booking_url: string }) =>
    supabase.from('trip_accommodations').insert([row]),
  updateAccommodation: (id: string, data: { name: string; map_url: string; booking_url: string }) =>
    supabase.from('trip_accommodations').update(data).eq('id', id),
};
