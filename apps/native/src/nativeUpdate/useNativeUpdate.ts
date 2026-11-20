/** 앱 시작과 백그라운드에서 포그라운드로 돌아올 때 최소 앱 버전을 확인하는 훅. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  resolveNativeUpdateRequirement,
  type NativeUpdateRequirement
} from "./nativeUpdatePolicy";

type NativeUpdateStatus = "checking" | "ready" | "required";

export function useNativeUpdate() {
  const checkSequenceRef = useRef(0);
  const [status, setStatus] = useState<NativeUpdateStatus>("checking");
  const [requirement, setRequirement] =
    useState<NativeUpdateRequirement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkForNativeUpdate = useCallback(async (isInitialCheck = false) => {
    const sequence = checkSequenceRef.current + 1;
    checkSequenceRef.current = sequence;

    if (!isInitialCheck) {
      setIsRefreshing(true);
    }

    let nextRequirement: NativeUpdateRequirement | null = null;

    try {
      nextRequirement = await resolveNativeUpdateRequirement();
    } catch (error) {
      console.warn("[native-update] failed to resolve requirement", error);
    }

    if (checkSequenceRef.current !== sequence) {
      return;
    }

    setRequirement(nextRequirement);
    setStatus(nextRequirement ? "required" : "ready");
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void checkForNativeUpdate(true);

    return () => {
      checkSequenceRef.current += 1;
    };
  }, [checkForNativeUpdate]);

  useEffect(() => {
    let previousAppState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const returnedToApp =
        nextAppState === "active" &&
        (previousAppState === "background" || previousAppState === "inactive");

      previousAppState = nextAppState;

      if (returnedToApp) {
        void checkForNativeUpdate();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkForNativeUpdate]);

  return {
    checkForNativeUpdate,
    isRefreshing,
    requirement,
    status
  };
}
