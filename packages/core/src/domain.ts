import type {
  BillItemRow, BillParticipantRow, BillRow, BillShareRow, CategoryRow, ItineraryItemRow, PhraseRow, PlaceCategoryRow, PlaceRow, ProfileRow, RouteBranchRow, RouteBranchTravelerRow, RouteRow, RouteStopRow,
  PassGiftRow, PassMarkRow, StayRow, TravelerRow, TripCurrencyRow, TripInviteRow, TripRow,
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
  phrases: PhraseRow[];
  tripCurrencies: TripCurrencyRow[];
  tripInvites: TripInviteRow[];
  bills: BillRow[];
  billItems: BillItemRow[];
  billParticipants: BillParticipantRow[];
  billShares: BillShareRow[];
  passGifts: PassGiftRow[];
  passMarks: PassMarkRow[];
}
export type PassGift = PassGiftRow;
export type Phrase = PhraseRow;
export type Bill = BillRow;
export type BillItem = BillItemRow;
export type BillParticipant = BillParticipantRow;
export type BillShare = BillShareRow;
export type TripInvite = TripInviteRow;
/** One bill with its rows, as the editor and the results screen consume it. */
export interface BillBundle { bill: BillRow; items: BillItemRow[]; participants: BillParticipantRow[]; shares: BillShareRow[] }
export function billBundle(bundle: Pick<TripBundle, "bills" | "billItems" | "billParticipants" | "billShares">, billId: string): BillBundle | null {
  const bill = bundle.bills.find((b) => b.id === billId);
  if (!bill) return null;
  return {
    bill,
    items: bundle.billItems.filter((i) => i.bill_id === billId).sort((a, b) => a.sort_order - b.sort_order),
    participants: bundle.billParticipants.filter((p) => p.bill_id === billId),
    shares: bundle.billShares.filter((s) => s.bill_id === billId),
  };
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
