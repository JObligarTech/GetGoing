/**
 * Supabase Database types. Hand-authored to match supabase/migrations; regenerate
 * with `pnpm db:types` once the Supabase CLI is linked (output is drop-in compatible).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TripStatus = "draft" | "upcoming" | "active" | "past";
export type MemberRole = "owner" | "editor" | "viewer";
export type StayKind = "hotel" | "airbnb" | "hostel" | "friend" | "rental" | "other";
export type PlacePriority = "must" | "maybe" | "skip";

type Row<T> = T;
type Insert<T, Optional extends keyof T, Omitted extends keyof T = never> = Omit<T, Optional | Omitted> & Partial<Pick<T, Optional>>;

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_currency: string;
  home_tz: string;
  locale: string;
  theme: "system" | "light" | "dark";
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
}
export type TripRow = {
  id: string;
  owner_id: string;
  name: string;
  cover_letter: string;
  countries: string[];
  cities: string[];
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  local_currency: string | null;
  local_tz: string | null;
  local_language: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type TripMemberRow = { trip_id: string; user_id: string; role: MemberRole; created_at: string }
export type TravelerRow = { id: string; trip_id: string; user_id: string | null; name: string; color: string; created_at: string }
export type CategoryRow = { id: string; trip_id: string; name: string; icon: string; color: string; sort_order: number; created_at: string }
export type PlaceRow = {
  id: string;
  trip_id: string;
  name: string;
  address: string | null;
  local_name: string | null;
  local_address: string | null;
  lat: number | null;
  lng: number | null;
  provider: string | null;
  provider_ref: string | null;
  phone: string | null;
  website: string | null;
  hours: Json | null;
  notes: string | null;
  priority: PlacePriority;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export type PlaceCategoryRow = { place_id: string; category_id: string }
export type StayRow = {
  id: string; trip_id: string; place_id: string; kind: StayKind;
  check_in: string | null; check_out: string | null; confirmation: string | null; notes: string | null; created_at: string;
}
export type ItineraryItemRow = {
  id: string; trip_id: string; place_id: string | null; day: string; start_time: string | null; end_time: string | null;
  title: string | null; note: string | null; sort_order: number; created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Row<ProfileRow>; Insert: Insert<ProfileRow, "avatar_url" | "home_currency" | "home_tz" | "locale" | "theme" | "marketing_opt_in" | "created_at" | "updated_at">; Update: Partial<ProfileRow>; Relationships: [] };
      trips: { Row: Row<TripRow>; Insert: Insert<TripRow, "id" | "countries" | "cities" | "start_date" | "end_date" | "status" | "local_currency" | "local_tz" | "local_language" | "notes" | "created_at" | "updated_at", "cover_letter">; Update: Partial<Omit<TripRow, "cover_letter">>; Relationships: [] };
      trip_members: { Row: TripMemberRow; Insert: Insert<TripMemberRow, "role" | "created_at">; Update: Partial<TripMemberRow>; Relationships: [] };
      travelers: { Row: TravelerRow; Insert: Insert<TravelerRow, "id" | "user_id" | "color" | "created_at">; Update: Partial<TravelerRow>; Relationships: [] };
      categories: { Row: CategoryRow; Insert: Insert<CategoryRow, "id" | "icon" | "color" | "sort_order" | "created_at">; Update: Partial<CategoryRow>; Relationships: [] };
      places: { Row: PlaceRow; Insert: Insert<PlaceRow, "id" | "address" | "local_name" | "local_address" | "lat" | "lng" | "provider" | "provider_ref" | "phone" | "website" | "hours" | "notes" | "priority" | "created_by" | "created_at" | "updated_at">; Update: Partial<PlaceRow>; Relationships: [] };
      place_categories: { Row: PlaceCategoryRow; Insert: PlaceCategoryRow; Update: Partial<PlaceCategoryRow>; Relationships: [] };
      stays: { Row: StayRow; Insert: Insert<StayRow, "id" | "kind" | "check_in" | "check_out" | "confirmation" | "notes" | "created_at">; Update: Partial<StayRow>; Relationships: [] };
      itinerary_items: { Row: ItineraryItemRow; Insert: Insert<ItineraryItemRow, "id" | "place_id" | "start_time" | "end_time" | "title" | "note" | "sort_order" | "created_at">; Update: Partial<ItineraryItemRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      export_my_data: { Args: Record<string, never>; Returns: Json };
      is_trip_member: { Args: { p_trip: string; p_min_role?: MemberRole }; Returns: boolean };
    };
    Enums: { trip_status: TripStatus; member_role: MemberRole; stay_kind: StayKind; place_priority: PlacePriority };
    CompositeTypes: Record<string, never>;
  };
}
