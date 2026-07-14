import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { itineraryApi } from '../api';
import type { ItineraryItem, TripAccommodation } from '@/lib/types';

export interface ItineraryBundle {
  items: ItineraryItem[];
  accommodations: TripAccommodation[];
}

// 一次取回行程 + 取票狀態 + 住宿，並把取票狀態併進每筆行程。內建 Realtime 訂閱。
export function useItinerary(tripId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['itinerary', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<ItineraryBundle> => {
      const [itinRes, statusRes, accRes] = await Promise.all([
        itineraryApi.list(tripId as string),
        itineraryApi.listTicketStatuses(),
        itineraryApi.listAccommodations(tripId as string),
      ]);
      if (itinRes.error) throw itinRes.error;
      const statuses = statusRes.data ?? [];
      const items: ItineraryItem[] = (itinRes.data ?? []).map((item) => ({
        ...item,
        member_statuses: statuses.filter((s) => s.itinerary_id === item.id),
      }));
      return { items, accommodations: accRes.data ?? [] };
    },
  });

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`trip-realtime-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_itinerary' },
        () => queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_member_ticket_status' },
        () => queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId, queryClient]);

  return query;
}
