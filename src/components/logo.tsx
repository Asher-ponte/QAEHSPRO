
"use client"

import Image from "next/image";
import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

async function fetchMainLogoUrl(): Promise<string | null> {
    try {
        const res = await fetch(`/api/admin/settings?siteId=main`, { cache: 'no-store' });
        if (!res.ok) {
            console.error("Failed to fetch main site settings for logo.");
            return null;
        }
        const settings = await res.json();
        // The App Branding logo is uploaded to a static path, but companyLogoPath is for the branch logo.
        // We should use a static path for the app brand logo. The upload component should enforce this.
        // Let's use the `companyLogoPath` from the main site as the designated app brand logo for now.
        return settings.companyLogoPath || null;
    } catch (error) {
        console.error("Error fetching main logo URL:", error);
        return null;
    }
}


export function Logo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    // This component should always display the MAIN app logo.
    // The "AppBrandingCard" saves the logo to `logos/logo.png`.
    // However, to make this dynamic and reflect what's set in settings,
    // we should fetch the `companyLogoPath` from the `main` site.
    
    async function getLogo() {
        try {
            const res = await fetch(`/api/admin/settings?siteId=main`);
            if (res.ok) {
                const data = await res.json();
                // The main logo for the entire app is stored in the 'main' site's companyLogoPath setting.
                if (data.companyLogoPath) {
                    // Add a cache-busting parameter
                    setLogoUrl(`${data.companyLogoPath}?t=${new Date().getTime()}`);
                } else {
                    setLogoUrl("/images/logo.png"); // Fallback to default
                }
            } else {
                 setLogoUrl("/images/logo.png"); // Fallback on API error
            }
        } catch (error) {
            console.error("Failed to fetch main logo, using fallback.", error);
            setLogoUrl("/images/logo.png"); // Fallback on network error
        }
    }
    
    getLogo();

  }, []);

  return (
    <div className="flex items-center gap-2">
       {logoUrl && (
         <Image 
            src={logoUrl}
            alt="Skills Ascend Logo" 
            width={50} 
            height={50} 
            className="rounded-lg object-contain"
            unoptimized // Necessary for cache busting with query param
        />
       )}
      <span className="text-2xl font-bold font-headline text-primary">
        Skills Ascend
      </span>
    </div>
  );
}
