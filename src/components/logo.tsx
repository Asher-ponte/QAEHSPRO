
"use client"

import Image from "next/image";
import { useEffect, useState } from "react";

export function Logo() {
  const [logoUrl, setLogoUrl] = useState("/images/logo.png");

  useEffect(() => {
    // Append a timestamp to the logo URL to bust the browser cache.
    // This ensures that when a new logo is uploaded, the browser fetches the new version.
    setLogoUrl(`/images/logo.png?t=${new Date().getTime()}`);
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
