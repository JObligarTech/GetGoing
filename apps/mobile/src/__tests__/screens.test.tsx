import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import Login from "../../app/(auth)/login";
import Home from "../../app/(tabs)/index";
import Plan from "../../app/plan/index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: ReactNode }) => children,
  Redirect: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
}));

/** Signs the demo user in before rendering children. */
function SignedIn({ children }: { children: ReactNode }) {
  const { user, ready, signIn } = useSession();
  useEffect(() => { if (ready && !user) void signIn("joe@example.com", "VoyaDemo-2027!"); }, [ready, user, signIn]);
  return user ? <>{children}</> : null;
}
// RNTL 14: render/fireEvent are async and must be awaited before `screen` is usable.
const wrap = (ui: ReactNode) => render(<SessionProvider><DataProvider><SignedIn>{ui}</SignedIn></DataProvider></SessionProvider>);

describe("Login (demo mode)", () => {
  it("has labelled fields and announces a wrong password as an alert", async () => {
    await render(<SessionProvider><DataProvider><Login /></DataProvider></SessionProvider>);
    const email = await screen.findByLabelText("Email");
    await fireEvent.changeText(email, "joe@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "nope-nope-1A");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });
});

describe("Home", () => {
  it("shows the trip context with accessible names like the mockup", async () => {
    await wrap(<Home />);
    expect(await screen.findByRole("button", { name: /Japan 2027, switch trip/ })).toBeOnTheScreen();
    expect(screen.getByText("12 days away")).toBeOnTheScreen();
    expect(screen.getByRole("image", { name: /Map of Tokyo with 5 pins/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Your stay: Hotel Gracery Shinjuku/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Fuglen Tokyo, Coffee · 9:00 AM/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeOnTheScreen();
  });
});

describe("Plan", () => {
  it("lists Day 1, exposes the day picker as radios, and fills the open slot", async () => {
    await wrap(<Plan />);
    expect(await screen.findByRole("header", { name: "Mon, Mar 15" })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: /Day 1,/ })).toBeChecked();
    const slot = screen.getByRole("button", { name: /13:00, Harajuku lunch, open slot, 2 saved nearby/ });
    await fireEvent.press(slot);
    const add = await screen.findByRole("button", { name: /Add Cafe Kitsuné, Coffee/ });
    await fireEvent.press(add);
    await waitFor(() => expect(screen.getByRole("button", { name: /1:00 PM, Cafe Kitsuné, Coffee/ })).toBeOnTheScreen());
    expect(screen.queryByRole("button", { name: /Harajuku lunch, open slot/ })).toBeNull();
  });
});
