import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import NavigateHub from "../../app/(tabs)/navigate";
import RouteScreen from "../../app/navigate/route";
import DayRouteScreen from "../../app/navigate/day";

const AFURI = "44444444-4444-4444-8444-444444444445";
const MORNING_SHIBUYA = "55555555-5555-4555-8555-555555555551";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: ReactNode }) => children,
  Redirect: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
}));

function SignedIn({ children }: { children: ReactNode }) {
  const { user, ready, signIn } = useSession();
  useEffect(() => { if (ready && !user) void signIn("joe@example.com", "VoyaDemo-2027!"); }, [ready, user, signIn]);
  return user ? <>{children}</> : null;
}
const wrap = (ui: ReactNode) => render(<SessionProvider><DataProvider><SignedIn>{ui}</SignedIn></DataProvider></SessionProvider>);

beforeEach(() => { mockParams = {}; jest.clearAllMocks(); });

describe("Navigate hub", () => {
  it("offers the contextual shortcuts and saved routes as buttons that deep-link", async () => {
    await wrap(<NavigateHub />);
    expect(await screen.findByRole("header", { name: "Navigate" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Take me to my hotel: Hotel Gracery Shinjuku" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/navigate/route", params: { to: "44444444-4444-4444-8444-444444444441" } });
    expect(screen.getByRole("button", { name: "Tonight's dinner: Afuri Ramen Harajuku" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Next planned: Shibuya Sky" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Navigate the day, Day 1 · hotel → 4 stops → hotel/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /Morning Shibuya, 4 stops · Walk · Hotel → Afuri/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/navigate/day", params: { route: MORNING_SHIBUYA } });
  });
});

describe("Directions", () => {
  it("compares modes as radios, lists steps, and announces a mode change", async () => {
    mockParams = { to: AFURI };
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await wrap(<RouteScreen />);
    expect(await screen.findByRole("header", { name: "To Afuri Ramen Harajuku" })).toBeOnTheScreen();
    const transit = await screen.findByRole("radio", { name: /^Transit, / });
    expect(transit).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("image", { name: /Map of the transit route from Hotel Gracery Shinjuku to Afuri Ramen Harajuku/ })).toBeOnTheScreen();
    expect(screen.getByRole("summary", { name: /^Next: Walk to the station/ })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Step 1 of \d+: Walk to the station/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Step \d+ of \d+: Arrive/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: /^Drive, / }));
    expect(screen.getByRole("radio", { name: /^Drive, / })).toBeChecked();
    expect(mockRouter.setParams).toHaveBeenCalledWith({ mode: "drive" });
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Drive, \d+ min/));
    expect(screen.getByLabelText(/^Step 1 of \d+: Head out/)).toBeOnTheScreen();
    // "Instead" shortcuts swap the destination.
    await fireEvent.press(screen.getByRole("button", { name: "Next planned" }));
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ to: "44444444-4444-4444-8444-444444444444" });
  });

  it("refuses an unknown destination instead of guessing", async () => {
    mockParams = { to: "not-a-place" };
    await wrap(<RouteScreen />);
    expect(await screen.findByText("Can't route that")).toBeOnTheScreen();
  });
});

describe("Day route", () => {
  it("routes hotel → stops → hotel, reorders with announcements, and saves", async () => {
    mockParams = { day: "2027-03-15" };
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await wrap(<DayRouteScreen />);
    expect(await screen.findByRole("header", { name: "Day 1 route" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Route totals: .* total, .* on foot, fares none/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Stop 1 of 6: Hotel Gracery Shinjuku\. Leave \d{2}:\d{2}/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Stop 2 of 6: Fuglen Tokyo\. Arrive 09:00/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Stop 6 of 6: Back to hotel/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Move Fuglen Tokyo up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Afuri Ramen Harajuku down" })).toBeDisabled();

    await fireEvent.press(screen.getByRole("button", { name: "Move Fuglen Tokyo down" }));
    expect(announce).toHaveBeenCalledWith("Fuglen Tokyo moved to stop 2 of 4");
    await waitFor(() => expect(screen.getByLabelText(/^Stop 2 of 6: Meiji Jingu/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Stop 3 of 6: Fuglen Tokyo/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: "Transit" }));
    expect(screen.getByRole("radio", { name: "Transit" })).toBeChecked();
    await waitFor(() => expect(screen.getByLabelText(/^Route totals: .* fares ¥\d/)).toBeOnTheScreen());

    await fireEvent.changeText(screen.getByLabelText("Route name"), "Meiji first");
    await fireEvent.press(screen.getByRole("button", { name: "Save route" }));
    await waitFor(() => expect(screen.getByText('Saved "Meiji first" to your routes.')).toBeOnTheScreen());
    expect(announce).toHaveBeenLastCalledWith('Saved "Meiji first" to your routes.');
  });

  it("shows a saved route read-only", async () => {
    mockParams = { route: MORNING_SHIBUYA };
    await wrap(<DayRouteScreen />);
    expect(await screen.findByRole("header", { name: "Morning Shibuya" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Stop 1 of 4: Hotel Gracery Shinjuku/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Stop 4 of 4: Afuri Ramen Harajuku/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save route" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  });

  it("does not leak another route id", async () => {
    mockParams = { route: "55555555-5555-4555-8555-555555555599" };
    await wrap(<DayRouteScreen />);
    expect(await screen.findByText("Route not found")).toBeOnTheScreen();
  });
});
