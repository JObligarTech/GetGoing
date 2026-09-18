import type {
  CategoryRow, ItineraryItemRow, PlaceCategoryRow, PlaceRow, ProfileRow, RouteBranchRow, RouteBranchTravelerRow, RouteRow, RouteStopRow, StayRow, TravelerRow, TripRow,
} from "./db/database.types";

export interface TripBundle {
  trip: TripRow;
  travelers: TravelerRow[];
  categories: CategoryRow[];
  places: PlaceRow[];
  placeCategories: PlaceCategoryRow[];
  stays: StayRow[];
  itinerary: ItineraryItemRow[];
  routes: RouteRow[];
  routeStops: RouteStopRow[];
  routeBranches: RouteBranchRow[];
  routeBranchTravelers: RouteBranchTravelerRow[];
}

export type Profile = ProfileRow;
export type Trip = TripRow;
export type Place = PlaceRow;
export type Stay = StayRow;
export type Category = CategoryRow;
export type Traveler = TravelerRow;
export type ItineraryItem = ItineraryItemRow;
export type SavedRoute = RouteRow;
export type SavedRouteStop = RouteStopRow;

export interface LatLng { lat: number; lng: number }

export interface MapPin extends LatLng {
  id: string;
  label?: string;
  color: string;
  /** dark pill (used for the hotel) */
  dark?: boolean;
}
