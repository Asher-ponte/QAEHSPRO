
"use client"

import Image from "next/image";
import { useEffect, useState } from "react";

export function Logo() {
  const [logoUrl, setLogoUrl] = useState<string>("/images/logo.png");

  useEffect(() => {
    // Add a cache-busting query parameter to the static URL
    // to ensure the browser fetches the latest version after an upload.
    setLogoUrl(`/images/logo.png?t=${new Date().getTime()}`);
  }, []);

  return (
    <div className="flex items-center gap-2">
       {logoUrl && (
         <Image 
            src={logoUrl}
            alt="QAEHS PRO ACADEMY Logo" 
            width={50} 
            height={50} 
            className="rounded-lg object-contain"
            unoptimized // Necessary for cache busting with query param
        />
       )}
      <span className="text-2xl font-bold font-headline text-primary">
        QAEHS PRO ACADEMY
      </span>
    </div>
  );
}
