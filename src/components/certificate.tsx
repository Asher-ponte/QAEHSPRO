
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { format } from "date-fns"
import QRCode from "qrcode"
import { useSession } from "@/hooks/use-session"

interface CertificateData {
  id: number;
  completion_date: string;
  certificateNumber: string | null;
  companyName: string;
  companyAddress: string | null;
  companyLogoPath: string | null;
  companyLogo2Path: string | null;
  user: { username: string; fullName: string | null };
  course: { title: string; venue: string | null } | null;
  signatories: { name: string; position: string | null; signatureImagePath: string }[];
  type: 'completion' | 'recognition';
  reason: string | null;
}

export function Certificate({ data }: { data: CertificateData }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const { site } = useSession();

    useEffect(() => {
        if (data.certificateNumber && site?.id) {
            const validationUrl = `${window.location.origin}/certificate/validate?number=${data.certificateNumber}&siteId=${site.id}`;
            QRCode.toDataURL(validationUrl, {
                errorCorrectionLevel: 'M',
                width: 128,
                margin: 1,
            })
            .then(url => {
                setQrCodeDataUrl(url);
            })
            .catch(err => {
                console.error("Failed to generate QR code", err);
            });
        }
    }, [data.certificateNumber, site?.id]);

    return (
        <div id="certificate-print-area" className="w-full overflow-x-auto">
            <div id="certificate-to-download" className="w-[1123px] mx-auto p-4 border-4 border-primary rounded-lg shadow-lg bg-card text-card-foreground relative font-serif aspect-[297/210]">
                <div className="absolute inset-0 bg-repeat bg-center opacity-5" style={{backgroundImage: "url(/images/logo.png)"}}></div>

                <div className="relative z-10 flex flex-col h-full text-center">
                    {/* Header */}
                    <header className="mb-2">
                        <div className="flex justify-center items-center gap-x-8 gap-y-4 mb-2">
                           {data.companyLogoPath && (
                                <div className="relative h-24 w-52">
                                    <Image 
                                        src={data.companyLogoPath} 
                                        alt={`${data.companyName} Logo`} 
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            )}
                            {data.companyLogo2Path && (
                                 <div className="relative h-24 w-52">
                                    <Image 
                                        src={data.companyLogo2Path} 
                                        alt={`${data.companyName} Secondary Logo`} 
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            )}
                        </div>
                        <h1 className="text-5xl font-bold tracking-wider text-primary">{data.companyName}</h1>
                         {data.companyAddress && (
                            <p className="text-lg text-muted-foreground mt-1">{data.companyAddress}</p>
                        )}
                    </header>

                    {/* Main Content */}
                    <main className="py-2">
                        <p className="text-xl">This certificate is proudly presented to</p>
                        <div className="my-4">
                           <h1 className="text-7xl font-bold text-black dark:text-white">
                                {data.user.fullName || data.user.username}
                            </h1>
                        </div>
                        
                        {data.type === 'completion' && data.course && (
                            <>
                                <p className="text-xl">for successfully completing the course</p>
                                <h3 className="text-4xl font-semibold my-2">"{data.course.title}"</h3>
                                <p className="text-xl mt-2">on {format(new Date(data.completion_date), "MMMM d, yyyy")}</p>
                                {data.course.venue && (
                                    <p className="text-lg mt-1 text-muted-foreground">at {data.course.venue}</p>
                                )}
                            </>
                        )}
                        
                        {data.type === 'recognition' && (
                             <>
                                <p className="text-xl">in recognition of</p>
                                <h3 className="text-4xl font-semibold my-2">"{data.reason}"</h3>
                                <p className="text-xl mt-2">Awarded on {format(new Date(data.completion_date), "MMMM d, yyyy")}</p>
                            </>
                        )}
                    </main>

                    {/* This div will grow to push the footer to the bottom */}
                    <div className="flex-grow" />

                    {/* Footer */}
                    <footer className="flex justify-between items-end gap-x-8 gap-y-4">
                        <div className="flex flex-col items-center text-center">
                            {qrCodeDataUrl && (
                                <Image src={qrCodeDataUrl} alt="Certificate Validation QR Code" width={80} height={80} />
                            )}
                            {data.certificateNumber && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Certificate No: {data.certificateNumber}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-center items-end gap-x-8 gap-y-2">
                            {data.signatories.map((s, i) => (
                                <div key={i} className="flex flex-col items-center min-w-[180px] text-center">
                                    <div className="relative h-14 w-36 mb-1">
                                        <Image 
                                            src={s.signatureImagePath} 
                                            alt={`Signature of ${s.name}`} 
                                            fill
                                            className="object-contain invert-0 dark:invert"
                                        />
                                    </div>
                                    <div className="border-t border-foreground pt-1 w-full">
                                        <p className="text-base font-semibold whitespace-nowrap">{s.name}</p>
                                        {s.position && <p className="text-sm text-muted-foreground whitespace-nowrap">{s.position}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    )
}
