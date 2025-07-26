
"use client"

import Image from "next/image";
import { useEffect, useState } from "react";

export function Logo() {
  const [logoUrl, setLogoUrl] = useState("/images/logo.png");

  useEffect(() => {
    async function fetchMainLogo() {
        try {
            // The main app logo is stored in the settings of the 'main' site.
            const res = await fetch(`/api/admin/settings?siteId=main`);
            if (res.ok) {
                const settings = await res.json();
                if (settings.companyLogoPath) {
                    setLogoUrl(settings.companyLogoPath);
                }
            }
        } catch (error) {
            console.error("Failed to fetch main logo, using default.", error);
        }
    }
    fetchMainLogo();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Image 
        src={logoUrl}
        alt="QAEHS PRO ACADEMY Logo" 
        width={50} 
        height={50} 
        className="rounded-lg"
        unoptimized
      />
      <span className="text-2xl font-bold font-headline text-primary">
        QAEHS PRO ACADEMY
      </span>
    </div>
  );
}
