
"use client"

import Image from "next/image";

export function Logo() {
  // Use a static path to the logo in the public folder.
  // The user will need to create `public/images/logo.png`.
  const logoUrl = "/images/logo.png";

  return (
    <div className="flex items-center gap-2">
       <Image 
          src={logoUrl}
          alt="QAEHS PRO ACADEMY Logo" 
          width={50} 
          height={50} 
          className="rounded-lg object-contain"
          priority // Prioritize loading the logo
          // Add a simple key with a timestamp to help bust the cache if the logo is replaced.
          key={Date.now()}
      />
      <span className="text-2xl font-bold font-headline text-primary">
        QAEHS PRO ACADEMY
      </span>
    </div>
  );
}
