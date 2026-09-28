import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import Tools from "../../app/(tabs)/tools";
import TranslateScreen from "../../app/translate/index";
import ConversationScreen from "../../app/translate/conversation";
import CameraScreen from "../../app/translate/camera";
import DriverScreen from "../../app/translate/driver";
import CurrencyScreen from "../../app/currency";

const HOTEL = "44444444-4444-4444-8444-444444444441";
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

describe("Tools hub", () => {
  it("links Translate and Currency with the trip's language and currencies", async () => {
    await wrap(<Tools />);
    await fireEvent.press(await screen.findByRole("button", { name: /Translate, 日本語 ready · text, voice, camera/ }));
    expect(mockRouter.push).toHaveBeenCalledWith("/translate");
    await fireEvent.press(screen.getByRole("button", { name: /Currency, USD ⇄ JPY/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith("/currency");
  });
});

describe("Translate", () => {
  it("suggests the trip language, translates typed text, speaks, copies, saves and removes a phrase, swaps", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await wrap(<TranslateScreen />);
    expect(await screen.findByRole("header", { name: "Translate" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "From: English" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "To: Japanese" })).toBeOnTheScreen();
    expect(screen.getByText("Suggested for Japan")).toBeOnTheScreen();
    for (const p of ["Where is the station?", "No peanuts, please", "Table for four"]) expect(screen.getByRole("button", { name: p })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Text to translate"), "Where is the entrance?");
    await fireEvent.press(screen.getByRole("button", { name: "Translate" }));
    expect(await screen.findByText("入口はどこですか？")).toBeOnTheScreen();
    expect(screen.getByText("Iriguchi wa doko desu ka?")).toBeOnTheScreen();
    expect(screen.getByText("22 / 500")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Speak" }));
    expect(Speech.speak).toHaveBeenCalledWith("入口はどこですか？", expect.objectContaining({ language: "ja-JP" }));
    await fireEvent.press(screen.getByRole("button", { name: "Copy" }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("入口はどこですか？");

    await fireEvent.press(screen.getByRole("button", { name: "Save phrase" }));
    await waitFor(() => expect(screen.getByText('Saved "Where is the entrance?" to Japan 2027.')).toBeOnTheScreen());
    expect(announce).toHaveBeenCalledWith('Saved "Where is the entrance?" to Japan 2027.');
    expect(screen.getByRole("button", { name: "Where is the entrance?" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Remove from saved" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Where is the entrance?" })).toBeNull());

    // A saved chip loads its translation without a provider call; swap moves it into the source box.
    await fireEvent.press(screen.getByRole("button", { name: "Table for four" }));
    expect(await screen.findByText("4人です")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Swap languages" }));
    expect(screen.getByRole("button", { name: "From: Japanese" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Text to translate")).toHaveProp("value", "4人です");
    expect(await screen.findByText("Table for four", { exact: true })).toBeOnTheScreen();

    // "From your trip" rows deep-link and prefill.
    await fireEvent.press(screen.getByRole("button", { name: /My hotel address/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/translate/driver", params: { place: HOTEL } });
    // The mic is honest about Expo Go.
    await fireEvent.press(screen.getByRole("button", { name: "Speak in Japanese" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Allow microphone" })); // round 6: the mic sheet explains first, once per device
    expect(await screen.findByRole("alert")).toHaveTextContent(/Voice input needs a speech-recognition module/);
  });

  it("flags text outside the offline phrasebook instead of inventing a translation", async () => {
    await wrap(<TranslateScreen />);
    await fireEvent.changeText(await screen.findByLabelText("Text to translate"), "Purple monkey dishwasher");
    await fireEvent.press(screen.getByRole("button", { name: "Translate" }));
    expect(await screen.findByText(/Demo mode: this phrase isn't in the offline phrasebook/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Save phrase" })).toBeDisabled();
  });
});

describe("Conversation", () => {
  it("labels their half in 日本語, translates typed turns both ways and speaks them", async () => {
    await wrap(<ConversationScreen />);
    expect(await screen.findByLabelText("Japanese side, facing the other person")).toBeOnTheScreen();
    expect(screen.getAllByText("タップして話す").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "話す (Japanese)" })).toBeOnTheScreen();
    expect(screen.getByText("English ⇄ 日本語")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Type instead"), "Where is the station?");
    await fireEvent.press(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findAllByText("駅はどこですか？")).length).toBeGreaterThan(0);
    expect(Speech.speak).toHaveBeenCalledWith("駅はどこですか？", expect.objectContaining({ language: "ja-JP" }));
    // Auto-detect: Japanese input is their turn and comes back in English.
    await fireEvent.changeText(screen.getByLabelText("Type instead"), "ありがとうございます");
    await fireEvent.press(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findAllByText("Thank you")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Japanese: ありがとうございます, translated as Thank you/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe("Camera", () => {
  it("reads a photo into overlay chips with prices in both currencies, lists the text, and keeps Split off", async () => {
    await wrap(<CameraScreen />);
    expect(await screen.findByRole("header", { name: "Camera" })).toBeOnTheScreen();
    expect(screen.getByText("日本語 → English")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Send to Split" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    expect(await screen.findByText("Found 6 lines. 4 have prices.")).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^Yuzu Shio Ramen, ¥1,200 ≈ \$8\.02, originally 柚子塩らーめん/)).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Contains wheat, soy and egg, originally/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "Text" }));
    expect(screen.getByLabelText(/^Tsukemen \(dipping noodles\), ¥1,350 ≈ \$9\.02\. Originally つけ麺/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/low confidence$/)).toBeOnTheScreen();
    // The sample menu needs no camera at all.
    await fireEvent.press(screen.getByRole("button", { name: "Try a sample menu" }));
    expect(await screen.findByLabelText(/^Extra chashu, ¥300/)).toBeOnTheScreen();
  });

  it("explains a denied camera permission", async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "denied", granted: false });
    await wrap(<CameraScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Take photo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Camera permission was denied/);
  });
});

describe("Show to driver", () => {
  it("shows the hotel's local name and address with the phrase, speaks it and links the map", async () => {
    mockParams = { place: HOTEL };
    await wrap(<DriverScreen />);
    const card = await screen.findByLabelText(/^Card for the driver: ここまでお願いします\. ホテルグレイスリー新宿\. 〒160-8466/);
    expect(card).toBeOnTheScreen();
    expect(screen.getByText("Hotel Gracery Shinjuku")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Speak" }));
    expect(Speech.speak).toHaveBeenCalledWith(expect.stringContaining("ホテルグレイスリー新宿"), expect.objectContaining({ language: "ja-JP" }));
    await fireEvent.press(screen.getByRole("button", { name: "Enlarge" }));
    expect(screen.getByRole("button", { name: "Smaller" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Show map" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/navigate/route", params: { to: HOTEL, mode: "drive" } });
  });
  it("does not leak an unknown place", async () => {
    mockParams = { place: "44444444-4444-4444-8444-444444444499" };
    await wrap(<DriverScreen />);
    expect(await screen.findByText("Place not found")).toBeOnTheScreen();
  });
});

describe("Currency", () => {
  it("converts with the mock rate, quick amounts, keypad, tip, swap and trip currency chips", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await wrap(<CurrencyScreen />);
    expect(await screen.findByRole("header", { name: "Currency" })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText(/^¥14,970\. 1 USD = 149\.70 JPY, Updated 2 min ago/)).toBeOnTheScreen());
    expect(screen.getByText("USD · Home")).toBeOnTheScreen();
    expect(screen.getByText("JPY · Japan · local")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Ramen bowl: ¥1,200, about \$8\.02/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "$20.00" }));
    expect(screen.getByLabelText(/^¥2,994\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "5" }));
    expect(screen.getByLabelText("Amount in US Dollar")).toHaveProp("value", "205");
    await fireEvent.press(screen.getByRole("button", { name: "Backspace" }));
    await fireEvent.press(screen.getByRole("button", { name: "Decimal point" }));
    await fireEvent.press(screen.getByRole("button", { name: "5" }));
    expect(screen.getByLabelText(/^¥3,069\./)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Add a tip" }));
    await fireEvent.press(screen.getByRole("button", { name: "15%" }));
    expect(screen.getByText("+ 15% tip = $23.58")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^¥3,530\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Remove adjustment" }));

    await fireEvent.press(screen.getByRole("button", { name: "Swap currencies" }));
    expect(announce).toHaveBeenCalledWith("Now converting JPY to USD.");
    expect(screen.getByLabelText("Amount in Japanese Yen")).toHaveProp("value", "3069");
    await waitFor(() => expect(screen.getByLabelText(/^\$20\.50\. 1 JPY = 0\.0067 USD/)).toBeOnTheScreen());

    const krw = screen.getByRole("radio", { name: "KRW · Seoul layover" });
    await fireEvent.press(krw);
    expect(screen.getByRole("radio", { name: "KRW · Seoul layover" })).toBeChecked();
    await waitFor(() => expect(screen.getByLabelText(/^₩[\d,]+\. 1 JPY = 8\.9646 KRW/)).toBeOnTheScreen());
  });

  it("adds and removes a trip currency, and saves an amount on the device", async () => {
    await wrap(<CurrencyScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Add currency" }));
    await fireEvent.press(screen.getByRole("radio", { name: "EUR, Euro" }));
    await fireEvent.changeText(screen.getByLabelText("Note (optional)"), "Paris stopover");
    await fireEvent.press(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "EUR · Paris stopover" })).toBeChecked());
    await waitFor(() => expect(screen.getByLabelText(/^€92\.00\./)).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole("button", { name: "Remove EUR" }));
    await waitFor(() => expect(screen.queryByRole("radio", { name: "EUR · Paris stopover" })).toBeNull());
    expect(screen.getByRole("radio", { name: "JPY" })).toBeChecked();

    await waitFor(() => expect(screen.getByLabelText(/^¥14,970\./)).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole("button", { name: "Save this amount" }));
    expect(await screen.findByText("Saved $100.00 = ¥14,970 on this device.")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Saved on this device" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Remove saved $100.00" }));
    await waitFor(() => expect(screen.queryByRole("header", { name: "Saved on this device" })).toBeNull());
  });
});
