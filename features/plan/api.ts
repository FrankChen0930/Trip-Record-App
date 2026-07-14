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
  removeItinerary: (id: string) =>
    supabase.from('trip_itinerary').delete().eq('id', id),

  addBucket: (row: { trip_id: string | undefined; category: string; title: string }) =>
    supabase.from('trip_bucket_list').insert([row]),
  removeBucket: (id: string) =>
    supabase.from('trip_bucket_list').delete().eq('id', id),

  insertAccommodation: (row: { trip_id: string | undefined; day: number; name: string; map_url: string; booking_url: string }) =>
    supabase.from('trip_accommodations').insert([row]),
  updateAccommodation: (id: string, data: { name: string; map_url: string; booking_url: string }) =>
    supabase.from('trip_accommodations').update(data).eq('id', id),
};
