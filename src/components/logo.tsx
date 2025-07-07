
import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image 
        src="/uploads/logo.png" 
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
