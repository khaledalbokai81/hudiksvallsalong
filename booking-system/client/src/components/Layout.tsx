import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { getOperationalStatus } from "../api";
import { templateConfig } from "../template";
import type { OperationalControls } from "../types";
import { usePublicSettings } from "../hooks/usePublicSettings";
import { Navbar } from "./Navbar";

export function Layout() {
  const location = useLocation();
  const hasSalonFooter = location.pathname === "/manage-booking";
  const publicSettings = usePublicSettings();
  const [controls, setControls] = useState<OperationalControls | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadStatus() {
      try {
        const response = await getOperationalStatus();

        if (isActive) {
          setControls(response.operationalControls);
        }
      } catch {
        if (isActive) {
          setControls(null);
        }
      }
    }

    void loadStatus();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="salon-public-shell min-h-screen bg-cloud text-ink">
      <Navbar />
      {controls?.maintenanceBannerEnabled && controls.maintenanceBannerMessage && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm font-semibold text-amber-800">
          {controls.maintenanceBannerMessage}
        </div>
      )}
      <main>
        <Outlet />
      </main>
      {publicSettings.publicContact.emergencyMessage && (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-semibold text-amber-900">
          {publicSettings.publicContact.emergencyMessage}
        </div>
      )}
      {!hasSalonFooter && <footer className="border-t border-slate-200 bg-white px-5 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>{publicSettings.businessName || templateConfig.business.name}</span>
          <div className="flex flex-wrap gap-4 font-medium">
            {publicSettings.publicContact.phone && <a href={`tel:${publicSettings.publicContact.phone}`}>{publicSettings.publicContact.phone}</a>}
            {publicSettings.publicContact.email && <a href={`mailto:${publicSettings.publicContact.email}`}>{publicSettings.publicContact.email}</a>}
            {publicSettings.publicContact.address && <span className="whitespace-pre-line">{publicSettings.publicContact.address}</span>}
            {publicSettings.publicContact.facebookUrl && <a href={publicSettings.publicContact.facebookUrl} rel="noreferrer" target="_blank">Facebook</a>}
            {publicSettings.publicContact.instagramUrl && <a href={publicSettings.publicContact.instagramUrl} rel="noreferrer" target="_blank">Instagram</a>}
            {publicSettings.publicContact.linkedinUrl && <a href={publicSettings.publicContact.linkedinUrl} rel="noreferrer" target="_blank">LinkedIn</a>}
          </div>
          <nav className="flex gap-4">
            <Link className="hover:text-ink" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-ink" to="/cookies">
              Cookies
            </Link>
          </nav>
        </div>
      </footer>}
    </div>
  );
}
