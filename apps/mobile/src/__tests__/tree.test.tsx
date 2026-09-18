import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Share } from "react-native";
import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import NavigateHub from "../../app/(tabs)/navigate";
import TreeScreen from "../../app/navigate/tree";

const SHIBUYA_TREE = "55555555-5555-4555-8555-555555555553";

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

describe("Tree route (saved)", () => {
  it("shows the trunk, both lanes with their travelers, and the comparison", async () => {
    mockParams = { route: SHIBUYA_TREE };
    await wrap(<TreeScreen />);
    expect(await screen.findByLabelText(/^Hotel Gracery Shinjuku: Everyone · leave 2:30 PM/)).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Group A: Joe, Sarah" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Group B: Chris, Daniel" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Shibuya Sky: Arrive \d{1,2}:\d{2} [AP]M · 1 h 30 there · by transit/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Pokémon Center Shibuya: Arrive .* · 1 h there · by walk/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Afuri Ramen Harajuku: Everyone meets · 7:30 PM/)).toBeOnTheScreen();
    expect(screen.getByText(/Everyone back together by/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByLabelText(/^Group A: .* door to Afuri\. Travel .*, fares ¥\d+ per person/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Group B: .* fares none, 0 transfers/)).toBeOnTheScreen();
    expect(screen.getByText(/Both make the 7:30 PM plan\./)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /^Walk instead of train, plus/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Start Group A" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/navigate/route", params: { to: "44444444-4444-4444-8444-444444444444", mode: "transit" } });
  });
});

describe("Tree route (from the day)", () => {
  it("branches after a stop, assigns a traveler, sets a mode, and saves", async () => {
    mockParams = { day: "2027-03-15" };
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await wrap(<TreeScreen />);
    expect(await screen.findByLabelText(/^Meiji Jingu/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Branch" })).toBeDisabled();
    await fireEvent.press(screen.getByLabelText(/^Meiji Jingu/));
    await fireEvent.press(screen.getByRole("button", { name: "Done" }));
    await fireEvent.press(screen.getByRole("button", { name: "Branch" }));
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("Branched after Meiji Jingu into Group A and Group B"));
    expect(screen.getByRole("header", { name: "Group A: Joe, Chris" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Group B: Daniel, Sarah" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Add stop to Group B" }));
    await fireEvent.changeText(screen.getByLabelText("Search saved places"), "pok");
    await fireEvent.press(screen.getByRole("button", { name: "Add Pokémon Center Shibuya" }));
    const stop = await screen.findByLabelText(/^Pokémon Center Shibuya/);
    await fireEvent.press(stop);
    expect(await screen.findByRole("header", { name: "Meiji Jingu → Pokémon Center Shibuya" })).toBeOnTheScreen();
    const chris = screen.getByRole("checkbox", { name: "Chris, on Group A" });
    expect(chris).not.toBeChecked();
    await fireEvent.press(chris);
    expect(screen.getByRole("checkbox", { name: "Chris" })).toBeChecked();
    await waitFor(() => expect(screen.getByRole("radio", { name: /^Drive, \d+ min/ })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole("radio", { name: /^Drive/ }));
    expect(screen.getByRole("radio", { name: /^Drive/ })).toBeChecked();
    // The sheet is modal, so the tree behind it is only queryable once it closes.
    await fireEvent.press(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("header", { name: "Group B: Chris, Daniel, Sarah" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Group A: Joe" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Pokémon Center Shibuya: .* · by drive/)).toBeOnTheScreen());

    await fireEvent.changeText(screen.getByLabelText("Route name"), "Split afternoon");
    await fireEvent.press(screen.getByRole("button", { name: "Save tree route" }));
    await waitFor(() => expect(screen.getByText('Saved "Split afternoon".')).toBeOnTheScreen());
    expect(mockRouter.setParams).toHaveBeenCalledWith({ route: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("refuses an unknown route id", async () => {
    mockParams = { route: "55555555-5555-4555-8555-555555555599" };
    await wrap(<TreeScreen />);
    expect(await screen.findByText("Route not found")).toBeOnTheScreen();
  });
});

describe("Send my location", () => {
  it("reads the position once and hands an OpenStreetMap link to the share sheet", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction, activityType: null } as never);
    await wrap(<NavigateHub />);
    expect(await screen.findByRole("button", { name: /Shibuya afternoon, Tree route · 2 groups · 4 stops/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /Send my location/ }));
    const daniel = await screen.findByRole("checkbox", { name: "Daniel" });
    expect(daniel).toBeChecked();
    await fireEvent.press(daniel);
    await fireEvent.press(screen.getByRole("button", { name: "Share my location" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0]![0]).toEqual({ message: expect.stringMatching(/^Joe is here \(\d{1,2}:\d{2} [AP]M\): https:\/\/www\.openstreetmap\.org\/\?mlat=35\.69510&mlon=139\.70060#map=17\/35\.69510\/139\.70060$/) });
    expect(await screen.findByText("Shared with Chris, Sarah.")).toBeOnTheScreen();
  });
});
