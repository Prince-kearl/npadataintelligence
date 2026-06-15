import { useQuery } from "@tanstack/react-query";
import { listIncidents, type IncidentRow } from "@/lib/incidents";

export function useIncidents() {
  return useQuery<IncidentRow[]>({
    queryKey: ["incidents"],
    queryFn: listIncidents,
    staleTime: 30_000,
  });
}
