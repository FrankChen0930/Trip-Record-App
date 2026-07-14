import { useMutation, useQueryClient } from '@tanstack/react-query';
import { itineraryApi, type ItineraryPayload, type TicketStatusInput } from '../api';

function useInvalidateItinerary(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
}

export function useSaveItinerary(tripId: string | undefined) {
  const invalidate = useInvalidateItinerary(tripId);
  return useMutation({
    mutationFn: async (vars: { id: string | null; payload: ItineraryPayload }) => {
      const { error } = vars.id
        ? await itineraryApi.update(vars.id, vars.payload)
        : await itineraryApi.create(vars.payload);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteItinerary(tripId: string | undefined) {
  const invalidate = useInvalidateItinerary(tripId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await itineraryApi.remove(id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMemberTicket(tripId: string | undefined) {
  const invalidate = useInvalidateItinerary(tripId);
  return useMutation({
    mutationFn: async (status: TicketStatusInput) => {
      const { error } = await itineraryApi.upsertTicketStatus(status);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}
