import type { TravelMode, TreePlan, RouteTree } from "@voya/core";

/** The slice of the trip the editor needs, serialisable from the server page. */
export interface TreePlace { id: string; name: string; lat: number; lng: number; color: string; isHotel: boolean; category: string }
export interface TreeTraveler { id: string; name: string; color: string }
export interface TreeEditorProps {
  tripId: string;
  tripName: string;
  currency: string;
  initialTree: RouteTree;
  initialPlan: TreePlan | null;
  places: TreePlace[];
  travelers: TreeTraveler[];
  planAction: (input: unknown) => Promise<TreePlan | { error: string }>;
  saveAction: (input: unknown) => Promise<{ ok: true; routeId: string } | { error: string }>;
  legModesAction: (tripId: string, fromPlaceId: string, toPlaceId: string) => Promise<Partial<Record<TravelMode, number>> | { error: string }>;
}
