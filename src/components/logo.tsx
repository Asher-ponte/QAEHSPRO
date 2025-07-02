import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image 
        src="/images/logo.png" 
        alt="QAEHS PRO Logo" 
        width={32} 
        height={32} 
        className="rounded-lg"
        unoptimized
      />
      <span className="text-xl font-bold font-headline text-primary">
        QAEHS PRO
      </span>
    </div>
  );
}
