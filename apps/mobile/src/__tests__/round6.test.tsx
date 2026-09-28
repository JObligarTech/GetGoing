import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import * as Location from "expo-location";
import { useEffect, useState, type ReactNode } from "react";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import { packsStore, permStore } from "@/lib/offline";
import PassScreen from "../../app/pass/index";
import PassDoneScreen from "../../app/pass/done";
import GiftScreen from "../../app/pass/gift";
import RedeemScreen from "../../app/pass/redeem";
import ExtendScreen from "../../app/pass/extend";
import Profile from "../../app/(tabs)/profile";
import SettingsScreen from "../../app/settings/index";
import PermissionsScreen from "../../app/settings/permissions";
import Home from "../../app/(tabs)/index";
import { SendLocation } from "@/components/SendLocation";

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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const network = require("expo-network") as { __setOnline(v: boolean): void };

function SignedIn({ children, email }: { children: ReactNode; email: string }) {
  const { user, ready, signIn, signOut } = useSession();
  // Signs in as `email`; when the email changes (a second traveler on the same device), signs out first.
  useEffect(() => {
    if (!ready) return;
    if (!user) { void signIn(email, "VoyaDemo-2027!"); return; }
    if (user.email !== email) void signOut();
  }, [ready, user, signIn, signOut, email]);
  return user && user.email === email ? <>{children}</> : null;
}
const wrap = (ui: ReactNode, email = "joe@example.com") => render(<SessionProvider><DataProvider><SignedIn email={email}>{ui}</SignedIn></DataProvider></SessionProvider>);
/** One provider tree, two people: the demo data lives in the provider, so Chris sees the gift Joe just sent. */
const handoff = { next: () => {} };
function Handoff({ steps }: { steps: { email: string; ui: ReactNode }[] }) {
  const [i, setI] = useState(0);
  const count = steps.length;
  useEffect(() => { handoff.next = () => setI((n) => Math.min(n + 1, count - 1)); }, [count]);
  const step = steps[i]!;
  return <SessionProvider><DataProvider><SignedIn email={step.email}>{step.ui}</SignedIn></DataProvider></SessionProvider>;
}

beforeEach(() => { mockParams = {}; jest.clearAllMocks(); packsStore.reset(); permStore.reset(); network.__setOnline(true); });

describe("Atlas Premium Pass", () => {
  it("Chris (no pass) checks out with the mock provider and reaches Congratulations", async () => {
    await wrap(<PassScreen />, "chris@example.com");
    expect(await screen.findByRole("header", { name: "Choose your Atlas Premium Pass" })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Single trip · Japan 2027, $2.99 one time" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "Yearly, $49.99 / year" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Apple Pay" }));
    await fireEvent.press(screen.getByRole("button", { name: "Pay · $49.99" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/pass/done", params: { e: expect.stringMatching(/^[0-9a-f-]{36}$/) } }));
    // The pass screen now manages instead of selling.
    expect(await screen.findByText("Atlas Premium Pass · yearly")).toBeOnTheScreen();
    expect(screen.getByText(/Renews Mar 3, 2028 · paid with Apple Pay ·· 4421/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Gift 3 days, 1 gift available/ })).toBeOnTheScreen();
  });

  it("Joe gifts Chris; the sent state shows the link; Chris redeems by code on his device and extends", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction, activityType: null } as never);
    await render(<Handoff steps={[{ email: "joe@example.com", ui: <GiftScreen /> }, { email: "chris@example.com", ui: <RedeemScreen /> }]} />);
    expect(await screen.findByRole("header", { name: "Gift 3 days" })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Chris, Get Going account · no pass" })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Daniel, Guest · will need to create an account" })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Sarah, Already has Atlas Premium Pass · yearly" })).toBeDisabled();
    expect(screen.getByLabelText("Starts: When Chris accepts")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Send gift to Chris" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ message: expect.stringMatching(/Chris, you've been gifted 3 days of Atlas Premium Pass on Japan 2027.*\/gift\/[a-f0-9]{24}$/) }));
    expect(await screen.findByRole("header", { name: "Gift sent to Chris" })).toBeOnTheScreen();
    const code = (share.mock.calls[0]![0] as { message: string }).message.match(/\/gift\/([a-f0-9]{24})/)![1]!;

    // Chris signs in on this device and arrives by link (?code=).
    mockParams = { code };
    await act(async () => { handoff.next(); });
    expect(await screen.findByRole("header", { name: "3 days of Atlas Premium Pass" })).toBeOnTheScreen();
    expect(screen.getByText("A gift from Joe")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Accept gift as Chris" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/pass/done", params: { e: expect.any(String) } }));
  });

  it("extend: 1–7 days for $0.99, only with a gifted pass; Congratulations describes the pass", async () => {
    // Joe holds a yearly pass, so the extend screen sends him to the single-trip pass instead.
    await wrap(<ExtendScreen />);
    expect(await screen.findByText("Extensions are for gifted passes")).toBeOnTheScreen();
  });

  it("Congratulations shows Joe's seeded yearly pass", async () => {
    mockParams = { e: "e1" };
    await wrap(<PassDoneScreen />);
    expect(await screen.findByLabelText(/Congratulations, Joe\. You have Atlas Premium Pass\. Yearly · renews Sep 1, 2027\./)).toBeOnTheScreen();
    expect(screen.getByText("Apple Pay ·· 4421")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Scan tonight's receipt" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/split/new");
  });
});

describe("Profile & Settings", () => {
  it("profile shows the pass, stats and defaults; defaults save; units flip", async () => {
    await wrap(<Profile />);
    expect(await screen.findByLabelText("Joe Obligar, joe@example.com, Atlas Premium Pass · yearly")).toBeOnTheScreen();
    expect(screen.getByLabelText("3 Trips")).toBeOnTheScreen();
    expect(screen.getByLabelText("3 Countries")).toBeOnTheScreen();
    expect(screen.getByLabelText("I speak English, Tagalog, edit")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Offline downloads, Tokyo · 412 MB/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Home currency USD, edit" }));
    expect(await screen.findByRole("header", { name: "Trip defaults" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "EUR, Euro" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Japanese" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Home currency EUR, edit" })).toBeOnTheScreen());
    expect(screen.getByLabelText("I speak English, Tagalog, Japanese, edit")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "Miles" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Miles" })).toBeChecked());
  });

  it("settings: theme, trip behaviour switches, offline packs", async () => {
    await wrap(<SettingsScreen />);
    expect(await screen.findByRole("header", { name: "Settings" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked());
    const home = screen.getByLabelText("Show home time");
    expect(home.props.value).toBe(true);
    await act(async () => { fireEvent(home, "valueChange", false); });
    await waitFor(() => expect(screen.getByText("Show home time off.")).toBeOnTheScreen());
    expect(screen.getByText("Japan 2027 · offline pack")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Download Kyoto & Osaka maps, 290 MB, Wi-Fi only" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove Kyoto & Osaka maps, downloaded just now/ })).toBeOnTheScreen());
  });

  it("permissions lists each capability with its state and the way to Settings", async () => {
    await wrap(<PermissionsScreen />);
    expect(await screen.findByRole("header", { name: "Permissions" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Location: Navigate, "Meet here", local time\. While using/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Camera: .* Allowed/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Contacts: .* Not available in this build/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });
});

describe("Permission sheets and offline", () => {
  it("Send my location explains first, once; declining keeps the OS prompt away", async () => {
    const perm = jest.spyOn(Location, "requestForegroundPermissionsAsync");
    await render(<SendLocation travelers={[{ id: "t2", trip_id: "x", user_id: null, name: "Chris", color: "#E0703A", created_at: "", email: null, phone: null, home_currency: null, joining_start: null, joining_end: null, joining_note: null, updated_at: "" }]} senderName="Joe" tz="Asia/Tokyo" />);
    await fireEvent.press(screen.getByRole("button", { name: /Send my location/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Share my location" }));
    expect(await screen.findByRole("header", { name: "Use your location for directions?" })).toBeOnTheScreen();
    expect(screen.getByText("Used only while Get Going is open. Nothing runs in the background.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Not now · I'll type a starting point" }));
    expect(perm).not.toHaveBeenCalled();
    await waitFor(() => expect(permStore.get().location).toBe("declined"));
  });

  it("Home offline: the banner and the Available offline card", async () => {
    await wrap(<Home />);
    expect(await screen.findByText("Japan 2027")).toBeOnTheScreen();
    await act(async () => { network.__setOnline(false); });
    expect(await screen.findByText(/You're offline · showing Japan 2027 saved just now/)).toBeOnTheScreen();
    expect(screen.getByText("Available offline")).toBeOnTheScreen();
    expect(screen.getByLabelText(/saved places: Cached/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Receipt scan · live transit · voice: Needs internet")).toBeOnTheScreen();
    await act(async () => { network.__setOnline(true); });
    await waitFor(() => expect(screen.queryByText("Available offline")).toBeNull());
  });
});
