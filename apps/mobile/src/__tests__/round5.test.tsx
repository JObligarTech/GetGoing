import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AccessibilityInfo, Share } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import PeopleScreen from "../../app/people";
import SplitHub from "../../app/split/index";
import ScanReceiptScreen from "../../app/split/new";
import BillScreen from "../../app/split/[id]";

const AFURI_BILL = "99999999-9999-4999-8999-999999999991";
const AFURI_PLACE = "44444444-4444-4444-8444-444444444445";
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

describe("People", () => {
  it("lists everyone with how they show up, the groups, adds a guest, invites by link, removes", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction, activityType: null } as never);
    await wrap(<PeopleScreen />);
    expect(await screen.findByRole("header", { name: "People · 4" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Joe Obligar, You · Organizer · All 14 nights · Home USD, Atlas Premium Pass")).toBeOnTheScreen();
    expect(screen.getByLabelText("Daniel, Guest · Tokyo only, Mar 15–20 · Home CAD")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Group A: Joe, Sarah\. Used in Shibuya afternoon route/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Add traveler" }));
    await fireEvent.changeText(screen.getByLabelText("Name"), "Maya Chen");
    await fireEvent.changeText(screen.getByLabelText("Home currency (optional)"), "sgd");
    await fireEvent.press(screen.getByRole("radio", { name: "Some days" }));
    await fireEvent.changeText(screen.getByLabelText("From"), "2027-03-20");
    await fireEvent.changeText(screen.getByLabelText("To"), "2027-03-24");
    await fireEvent.changeText(screen.getByLabelText("Where (optional)"), "Kyoto only");
    await fireEvent.press(screen.getByRole("button", { name: "Add to Japan 2027" }));
    await waitFor(() => expect(screen.getByRole("header", { name: "People · 5" })).toBeOnTheScreen());
    expect(screen.getByLabelText("Maya Chen, Guest · Kyoto only, Mar 20–24 · Home SGD")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Invite Maya Chen" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ message: expect.stringMatching(/Joe added you to "Japan 2027" on Voya.*\/join\/[a-f0-9]{36}/s) }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Share invite link again for Maya Chen" })).toBeOnTheScreen());

    await fireEvent.press(screen.getByRole("button", { name: "Edit Maya Chen" }));
    await fireEvent.press(screen.getByRole("button", { name: "Remove Maya Chen" }));
    await waitFor(() => expect(screen.getByRole("header", { name: "People · 4" })).toBeOnTheScreen());
    expect(screen.queryByRole("button", { name: "Edit Joe Obligar" })).toBeNull(); // you can't edit or remove yourself here
  });
});

describe("Split hub", () => {
  it("shows the pass, tonight's dinner prefilled and the open bill", async () => {
    await wrap(<SplitHub />);
    expect(await screen.findByRole("header", { name: "Split" })).toBeOnTheScreen();
    expect(screen.getByText(/Yearly · \d+ days left/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /Scan a receipt, Afuri Ramen Harajuku · tonight's dinner · JPY · 4 people from your trip/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/split/new", params: { place: AFURI_PLACE } });
    await fireEvent.press(screen.getByRole("button", { name: "Afuri Ramen Harajuku, ¥6,655, 4 people, open" }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/split/[id]", params: { id: AFURI_BILL } });
    expect(screen.getByText("Time Out Market")).toBeOnTheScreen();
  });
});

describe("Scan", () => {
  it("reads the sample receipt into a draft bill and opens it", async () => {
    mockParams = { place: AFURI_PLACE };
    await wrap(<ScanReceiptScreen />);
    expect(await screen.findByRole("header", { name: "Scan receipt" })).toBeOnTheScreen();
    expect(screen.getByText("Afuri Ramen Harajuku")).toBeOnTheScreen();
    expect(screen.getByText("4 people from your trip")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Snap" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Continue" })); // round 6: the camera sheet explains first, once per device
    await waitFor(() => expect(ImagePicker.launchCameraAsync).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("1 page ready")).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole("button", { name: "Read the receipt" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/split/[id]", params: { id: expect.stringMatching(/^[0-9a-f-]{36}$/) } }));
  });
});

describe("Bill", () => {
  it("results match the maths with each person's home currency; close and reopen", async () => {
    mockParams = { id: AFURI_BILL, step: "3" };
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await wrap(<BillScreen />);
    expect(await screen.findByRole("header", { name: "Afuri Ramen Harajuku" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Bill total ¥6,655, about \$44\.46/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Joe: ¥2,431, about \$16\.24, paid/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Chris: ¥1,824, about \$12\.18, claimed/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Daniel: ¥774, about CA\$7\.0\d, link opened/)).toBeOnTheScreen();
    expect(screen.getByText("Collects ¥3,924 from 3 people")).toBeOnTheScreen();
    expect(screen.getByText(/¥300 is still unassigned \(Coke\)/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Close bill" }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith("Bill closed. Everyone's share is final."));
    expect(await screen.findByRole("button", { name: "Reopen bill" })).toBeOnTheScreen();
  });

  it("assigns with avatar checkboxes, splits the rest evenly, sends a claim link, adds an item by hand", async () => {
    mockParams = { id: AFURI_BILL, step: "2" };
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction, activityType: null } as never);
    await wrap(<BillScreen />);
    expect(await screen.findByText("Step 2 of 3 · Who had what")).toBeOnTheScreen();
    expect(screen.getByLabelText("Assigned ¥5,750, ¥300 left")).toBeOnTheScreen();
    const cokeWho = screen.getByLabelText("Who had Coke");
    await fireEvent.press(within(cokeWho).getByRole("checkbox", { name: "Daniel" }));
    expect(screen.getByLabelText("Assigned ¥6,050, ¥0 left")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: /^Chris/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Send link" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ message: expect.stringMatching(/Chris, pick what you ordered at Afuri Ramen Harajuku: .*\/s\/[a-z0-9]{32}/) }));
    await fireEvent.press(screen.getByRole("tab", { name: "Items" }));
    await fireEvent.press(screen.getByRole("button", { name: "Add missing line" }));
    await fireEvent.changeText(screen.getByLabelText("Item"), "Edamame");
    await fireEvent.changeText(screen.getByLabelText("Price (JPY)"), "450");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Joe" }));
    await fireEvent.press(screen.getByRole("button", { name: "Add · Joe" }));
    await waitFor(() => expect(screen.getByText("Added Edamame · ¥450 · Joe.")).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Total ¥7,105/)).toBeOnTheScreen();
  });
});
