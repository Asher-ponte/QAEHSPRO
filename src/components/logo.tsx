
"use client"

import Image from "next/image";
import { useEffect, useState } from "react";
import { storage } from "@/lib/firebase";
import { ref, getDownloadURL } from "firebase/storage";

export function Logo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogoUrl = async () => {
      setIsLoading(true);
      try {
        // The App Branding logo is uploaded to a fixed path.
        const logoRef = ref(storage, 'logos/logo.png');
        const url = await getDownloadURL(logoRef);
        setLogoUrl(url);
      } catch (error) {
        // If the logo doesn't exist in storage (e.g., never uploaded), fallback to the local one.
        console.warn("App branding logo not found in Firebase Storage, using default.");
        setLogoUrl("/images/logo.png"); // Fallback to local asset
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogoUrl();
  }, []);

  return (
    <div className="flex items-center gap-2">
       {isLoading ? (
            <div className="h-[50px] w-[50px] bg-muted rounded-lg animate-pulse"></div>
       ) : logoUrl ? (
         <Image 
            src={logoUrl}
            alt="QAEHS PRO ACADEMY Logo" 
            width={50} 
            height={50} 
            className="rounded-lg object-contain"
            priority // Prioritize loading the logo
        />
       ) : null}
      <span className="text-2xl font-bold font-headline text-primary">
        QAEHS PRO ACADEMY
      </span>
    </div>
  );
}
