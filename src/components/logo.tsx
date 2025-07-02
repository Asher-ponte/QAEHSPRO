import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image 
        src="/images/logo.png" 
        alt="QAEHS PRO Logo" 
        width={40} 
        height={40} 
        className="rounded-lg"
        unoptimized
      />
      <span className="text-2xl font-bold font-headline text-primary">
        QAEHS PRO
      </span>
    </div>
  );
}
