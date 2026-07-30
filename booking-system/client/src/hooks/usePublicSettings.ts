import { useEffect, useState } from "react";
import { getPublicSettings } from "../api";
import { templateConfig } from "../template";
import type { PublicSettings } from "../types";

const fallbackSettings: PublicSettings = {
  businessName: templateConfig.business.name,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  publicContact: {},
  legal: {},
  bookingRules: {
    minimumNoticeHours: 0,
    bookingWindowDays: 90,
    cancellationNoticeHours: 0,
    rescheduleNoticeHours: 0,
    requirePhone: true,
    requireNotes: false,
    confirmationMode: "request"
  }
};

let cachedSettings: PublicSettings | undefined;

export function usePublicSettings() {
  const [settings, setSettings] = useState(cachedSettings || fallbackSettings);

  useEffect(() => {
    let active = true;
    void getPublicSettings()
      .then((response) => {
        cachedSettings = response.settings;
        if (active) setSettings(response.settings);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return settings;
}
