/**
 * Supabase Database types. Hand-authored to match supabase/migrations; regenerate
 * with `pnpm db:types` once the Supabase CLI is linked (output is drop-in compatible).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TripStatus = "draft" | "upcoming" | "active" | "past";
export type MemberRole = "owner" | "editor" | "viewer";
export type StayKind = "hotel" | "airbnb" | "hostel" | "friend" | "rental" | "other";
export type PlacePriority = "must" | "maybe" | "skip";
export type TravelModeDb = "walk" | "transit" | "drive" | "cycle";

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
export type TravelerRow = {
  id: string; trip_id: string; user_id: string | null; name: string; color: string; created_at: string;
  email: string | null; phone: string | null; home_currency: string | null; joining_start: string | null; joining_end: string | null; joining_note: string | null; updated_at: string;
}
export type TripInviteRow = {
  token: string; trip_id: string; traveler_id: string | null; role: MemberRole; created_by: string | null; expires_at: string;
  accepted_by: string | null; accepted_at: string | null; created_at: string;
}
export type BillStatus = "draft" | "open" | "settled";
export type ClaimStatus = "none" | "sent" | "opened" | "claimed";
export type PassKind = "trip" | "monthly" | "yearly" | "gift";
export type BillRow = {
  id: string; trip_id: string; place_id: string | null; merchant: string; currency: string; status: BillStatus; bill_date: string | null;
  tax_amount: number; tax_label: string | null; service_amount: number; discount_amount: number; rounding_unit: number; tax_mode: "proportional" | "even";
  paid_by: string | null; receipt_pages: number; created_by: string | null; created_at: string; updated_at: string; closed_at: string | null;
}
export type BillItemRow = {
  id: string; bill_id: string; trip_id: string; name: string; local_name: string | null; qty: number; unit_price: number; confidence: number | null; sort_order: number; created_at: string;
}
export type BillParticipantRow = {
  id: string; bill_id: string; trip_id: string; traveler_id: string | null; name: string; color: string; home_currency: string | null;
  claim_token: string | null; claim_status: ClaimStatus; claim_expires_at: string; created_at: string;
}
export type BillShareRow = { item_id: string; participant_id: string; bill_id: string; trip_id: string }
export type EntitlementRow = {
  id: string; user_id: string; kind: PassKind; trip_id: string | null; starts_at: string; ends_at: string; gifted_by: string | null; source: string | null; created_at: string;
}
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

export type RouteRow = {
  id: string; trip_id: string; name: string; day: string | null; mode: TravelModeDb; notes: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}
export type RouteStopRow = {
  id: string; route_id: string; trip_id: string; place_id: string; sort_order: number; planned_time: string | null;
  dwell_min: number | null; mode: TravelModeDb | null; branch_id: string | null; created_at: string;
}
export type RouteBranchRow = {
  id: string; route_id: string; trip_id: string; name: string; color: string; sort_order: number;
  split_after_stop_id: string; merge_mode: TravelModeDb | null; created_at: string;
}
export type RouteBranchTravelerRow = { branch_id: string; traveler_id: string; trip_id: string }
export type PhraseRow = {
  id: string; trip_id: string; source_text: string; source_lang: string; target_text: string; target_lang: string;
  romanized: string | null; sort_order: number; created_by: string | null; created_at: string;
}
export type TripCurrencyRow = { trip_id: string; code: string; label: string | null; sort_order: number; created_at: string }

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Row<ProfileRow>; Insert: Insert<ProfileRow, "avatar_url" | "home_currency" | "home_tz" | "locale" | "theme" | "marketing_opt_in" | "created_at" | "updated_at">; Update: Partial<ProfileRow>; Relationships: [] };
      trips: { Row: Row<TripRow>; Insert: Insert<TripRow, "id" | "countries" | "cities" | "start_date" | "end_date" | "status" | "local_currency" | "local_tz" | "local_language" | "notes" | "created_at" | "updated_at", "cover_letter">; Update: Partial<Omit<TripRow, "cover_letter">>; Relationships: [] };
      trip_members: { Row: TripMemberRow; Insert: Insert<TripMemberRow, "role" | "created_at">; Update: Partial<TripMemberRow>; Relationships: [] };
      travelers: { Row: TravelerRow; Insert: Insert<TravelerRow, "id" | "user_id" | "color" | "created_at" | "email" | "phone" | "home_currency" | "joining_start" | "joining_end" | "joining_note" | "updated_at">; Update: Partial<TravelerRow>; Relationships: [] };
      trip_invites: { Row: TripInviteRow; Insert: Insert<TripInviteRow, "token" | "traveler_id" | "role" | "created_by" | "expires_at" | "accepted_by" | "accepted_at" | "created_at">; Update: Partial<TripInviteRow>; Relationships: [] };
      bills: { Row: BillRow; Insert: Insert<BillRow, "id" | "place_id" | "status" | "bill_date" | "tax_amount" | "tax_label" | "service_amount" | "discount_amount" | "rounding_unit" | "tax_mode" | "paid_by" | "receipt_pages" | "created_by" | "created_at" | "updated_at" | "closed_at">; Update: Partial<BillRow>; Relationships: [] };
      bill_items: { Row: BillItemRow; Insert: Insert<BillItemRow, "id" | "local_name" | "qty" | "confidence" | "sort_order" | "created_at">; Update: Partial<BillItemRow>; Relationships: [] };
      bill_participants: { Row: BillParticipantRow; Insert: Insert<BillParticipantRow, "id" | "traveler_id" | "color" | "home_currency" | "claim_token" | "claim_status" | "claim_expires_at" | "created_at">; Update: Partial<BillParticipantRow>; Relationships: [] };
      bill_shares: { Row: BillShareRow; Insert: BillShareRow; Update: Partial<BillShareRow>; Relationships: [] };
      entitlements: { Row: EntitlementRow; Insert: Insert<EntitlementRow, "id" | "trip_id" | "starts_at" | "gifted_by" | "source" | "created_at">; Update: Partial<EntitlementRow>; Relationships: [] };
      categories: { Row: CategoryRow; Insert: Insert<CategoryRow, "id" | "icon" | "color" | "sort_order" | "created_at">; Update: Partial<CategoryRow>; Relationships: [] };
      places: { Row: PlaceRow; Insert: Insert<PlaceRow, "id" | "address" | "local_name" | "local_address" | "lat" | "lng" | "provider" | "provider_ref" | "phone" | "website" | "hours" | "notes" | "priority" | "created_by" | "created_at" | "updated_at">; Update: Partial<PlaceRow>; Relationships: [] };
      place_categories: { Row: PlaceCategoryRow; Insert: PlaceCategoryRow; Update: Partial<PlaceCategoryRow>; Relationships: [] };
      stays: { Row: StayRow; Insert: Insert<StayRow, "id" | "kind" | "check_in" | "check_out" | "confirmation" | "notes" | "created_at">; Update: Partial<StayRow>; Relationships: [] };
      routes: { Row: RouteRow; Insert: Insert<RouteRow, "id" | "day" | "mode" | "notes" | "created_by" | "created_at" | "updated_at">; Update: Partial<RouteRow>; Relationships: [] };
      route_stops: { Row: RouteStopRow; Insert: Insert<RouteStopRow, "id" | "sort_order" | "planned_time" | "dwell_min" | "mode" | "branch_id" | "created_at">; Update: Partial<RouteStopRow>; Relationships: [] };
      route_branches: { Row: RouteBranchRow; Insert: Insert<RouteBranchRow, "id" | "color" | "sort_order" | "merge_mode" | "created_at">; Update: Partial<RouteBranchRow>; Relationships: [] };
      route_branch_travelers: { Row: RouteBranchTravelerRow; Insert: RouteBranchTravelerRow; Update: Partial<RouteBranchTravelerRow>; Relationships: [] };
      phrases: { Row: PhraseRow; Insert: Insert<PhraseRow, "id" | "romanized" | "sort_order" | "created_by" | "created_at">; Update: Partial<PhraseRow>; Relationships: [] };
      trip_currencies: { Row: TripCurrencyRow; Insert: Insert<TripCurrencyRow, "label" | "sort_order" | "created_at">; Update: Partial<TripCurrencyRow>; Relationships: [] };
      itinerary_items: { Row: ItineraryItemRow; Insert: Insert<ItineraryItemRow, "id" | "place_id" | "start_time" | "end_time" | "title" | "note" | "sort_order" | "created_at">; Update: Partial<ItineraryItemRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      export_my_data: { Args: Record<string, never>; Returns: Json };
      is_trip_member: { Args: { p_trip: string; p_min_role?: MemberRole }; Returns: boolean };
      save_route_tree: { Args: { p_route_id: string | null; p_trip_id: string; p_name: string; p_day: string | null; p_mode: TravelModeDb; p_stops: Json; p_branches: Json }; Returns: string };
      save_bill: { Args: { p_bill_id: string | null; p_trip_id: string; p_bill: Json; p_items: Json; p_participants: Json; p_shares: Json }; Returns: string };
      invite_preview: { Args: { p_token: string }; Returns: Json };
      accept_trip_invite: { Args: { p_token: string }; Returns: string };
      bill_claim_view: { Args: { p_token: string }; Returns: Json };
      bill_claim_submit: { Args: { p_token: string; p_item_ids: string[] }; Returns: Json };
    };
    Enums: { trip_status: TripStatus; member_role: MemberRole; stay_kind: StayKind; place_priority: PlacePriority; travel_mode: TravelModeDb; bill_status: BillStatus; claim_status: ClaimStatus; pass_kind: PassKind };
    CompositeTypes: Record<string, never>;
  };
}
