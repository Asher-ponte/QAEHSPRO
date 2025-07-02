
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { format } from "date-fns"
import QRCode from "qrcode"

interface CertificateData {
  id: number;
  completion_date: string;
  certificateNumber: string | null;
  companyName: string;
  companyAddress: string | null;
  companyLogoPath: string | null;
  companyLogo2Path: string | null;
  user: { username: string };
  course: { title: string };
  signatories: { name: string; position: string | null; signatureImagePath: string }[];
}

export function Certificate({ data }: { data: CertificateData }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

    useEffect(() => {
        if (data.certificateNumber) {
            // Use a placeholder validation URL. A real implementation might point to a public validation page.
            const validationUrl = `${window.location.origin}/certificate/validate?number=${data.certificateNumber}`;
            QRCode.toDataURL(validationUrl, {
                errorCorrectionLevel: 'M',
                width: 128
            })
            .then(url => {
                setQrCodeDataUrl(url);
            })
            .catch(err => {
                console.error("Failed to generate QR code", err);
            });
        }
    }, [data.certificateNumber]);

    return (
        <div id="certificate-print-area" className="bg-background">
            <div id="certificate-to-download" className="max-w-4xl mx-auto p-8 border-4 border-primary rounded-lg shadow-lg bg-card text-card-foreground relative font-serif aspect-[210/297]">
                <div className="absolute inset-0 bg-repeat bg-center opacity-5" style={{backgroundImage: "url(/images/logo.png)"}}></div>

                <div className="relative z-10 flex flex-col h-full text-center">
                    {/* Main Content */}
                    <div className="flex-grow flex flex-col items-center space-y-2">
                         <div className="flex justify-center items-center gap-8 mb-2">
                            {data.companyLogoPath && (
                                <div className="relative h-16 w-32">
                                    <Image 
                                        src={data.companyLogoPath} 
                                        alt={`${data.companyName} Logo`} 
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            )}
                            {data.companyLogo2Path && (
                                 <div className="relative h-16 w-32">
                                    <Image 
                                        src={data.companyLogo2Path} 
                                        alt={`${data.companyName} Secondary Logo`} 
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold tracking-wider text-primary">{data.companyName}</h1>
                        
                        {data.companyAddress && (
                            <p className="text-xs text-muted-foreground">{data.companyAddress}</p>
                        )}

                        <h2 className="text-lg font-semibold text-muted-foreground tracking-widest uppercase pt-2">
                            Certificate of Completion
                        </h2>

                        <p className="text-sm pt-4">This certificate is proudly presented to</p>

                        <h1 className="text-3xl font-bold">
                            {data.user.username}
                        </h1>

                        <p className="text-sm max-w-2xl">
                            for successfully completing the course
                        </p>
                        <h3 className="text-xl font-semibold">
                           "{data.course.title}"
                        </h3>

                        <p className="text-sm">
                            on {format(new Date(data.completion_date), "MMMM d, yyyy")}
                        </p>
                    </div>

                    {/* Signatories and Footer */}
                    <div className="mt-auto pt-4">
                        <div className="flex flex-wrap justify-around items-end gap-x-8 gap-y-4 mb-4">
                            {data.signatories.map((s, i) => (
                                <div key={i} className="flex flex-col items-center min-w-[150px]">
                                    <div className="relative h-12 w-32 mb-1">
                                        <Image 
                                            src={s.signatureImagePath} 
                                            alt={`Signature of ${s.name}`} 
                                            fill
                                            className="object-contain invert-0 dark:invert"
                                        />
                                    </div>
                                    <div className="border-t border-foreground pt-1 w-full text-center">
                                        <p className="text-xs font-semibold whitespace-nowrap">{s.name}</p>
                                        {s.position && <p className="text-[10px] text-muted-foreground whitespace-nowrap">{s.position}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>

                         <div className="flex flex-col items-center mt-4">
                            {qrCodeDataUrl && (
                                <Image src={qrCodeDataUrl} alt="Certificate Validation QR Code" width={60} height={60} />
                            )}
                            {data.certificateNumber && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Certificate No: {data.certificateNumber}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
