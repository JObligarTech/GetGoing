import { useColorScheme } from "react-native";
import { dark, light, radius, type ColorTheme } from "@voya/tokens";

export type Theme = ColorTheme & { scheme: "light" | "dark"; radius: typeof radius; font: { regular: string; medium: string; semibold: string; bold: string; extrabold: string } };

const font = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
};

export function themeFor(scheme: "light" | "dark"): Theme {
  return { ...(scheme === "dark" ? dark : light), scheme, radius, font };
}

/** Follows the OS appearance (the mockups' "Theme follows system by default"). */
export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return themeFor(scheme);
}
