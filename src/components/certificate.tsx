
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
  companyLogoPath: string | null;
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
            <div className="max-w-4xl mx-auto p-8 border-4 border-primary rounded-lg shadow-lg bg-card text-card-foreground relative font-serif">
                <div className="absolute inset-0 bg-repeat bg-center opacity-5" style={{backgroundImage: "url(/images/logo.png)"}}></div>

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                    {data.companyLogoPath && (
                         <div className="relative h-24 w-auto max-w-xs mb-4">
                            <Image 
                                src={data.companyLogoPath} 
                                alt={`${data.companyName} Logo`} 
                                width={150} 
                                height={96}
                                className="object-contain"
                            />
                        </div>
                    )}

                    <h1 className="text-4xl font-bold tracking-wider text-primary">{data.companyName}</h1>
                    
                    <h2 className="text-2xl font-semibold text-muted-foreground tracking-widest uppercase">
                        Certificate of Completion
                    </h2>

                    <p className="text-lg">This certificate is proudly presented to</p>

                    <h1 className="text-5xl font-bold">
                        {data.user.username}
                    </h1>

                    <p className="text-lg max-w-2xl">
                        for successfully completing the course
                    </p>
                    <h3 className="text-3xl font-semibold">
                       "{data.course.title}"
                    </h3>

                    <p className="text-lg">
                        on {format(new Date(data.completion_date), "MMMM d, yyyy")}
                    </p>

                    <div className="flex flex-col sm:flex-row justify-between items-end w-full pt-12 mt-8 border-t">
                        <div className="flex flex-col items-start text-left min-w-[150px] mt-4">
                            {qrCodeDataUrl && (
                                <Image src={qrCodeDataUrl} alt="Certificate Validation QR Code" width={100} height={100} />
                            )}
                            {data.certificateNumber && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Certificate No: {data.certificateNumber}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
                            {data.signatories.map((s, i) => (
                                <div key={i} className="flex flex-col items-center min-w-[200px] mt-4">
                                    <div className="relative h-16 w-48 mb-2">
                                        <Image 
                                            src={s.signatureImagePath} 
                                            alt={`Signature of ${s.name}`} 
                                            fill
                                            className="object-contain invert-0 dark:invert"
                                        />
                                    </div>
                                    <div className="border-t border-foreground pt-2 text-center">
                                        <p className="text-sm font-semibold whitespace-nowrap">{s.name}</p>
                                        {s.position && <p className="text-xs text-muted-foreground whitespace-nowrap">{s.position}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
