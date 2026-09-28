// Jest stand-in for expo-network: a settable online state that re-renders useNetworkState subscribers.
import { useEffect, useState } from "react";

type NetState = { isConnected: boolean; isInternetReachable: boolean; type: string };
const state: NetState = { isConnected: true, isInternetReachable: true, type: "WIFI" };
const listeners = new Set<(s: NetState) => void>();

export function __setOnline(online: boolean) { state.isConnected = online; state.isInternetReachable = online; listeners.forEach((l) => l({ ...state })); }
export function useNetworkState(): NetState {
  const [s, set] = useState<NetState>({ ...state });
  useEffect(() => { listeners.add(set); return () => { listeners.delete(set); }; }, []);
  return s;
}
export const getNetworkStateAsync = async () => ({ ...state });
export const addNetworkStateListener = (l: (s: NetState) => void) => { listeners.add(l); return { remove: () => listeners.delete(l) }; };
