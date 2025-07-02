
"use client"

import Image from "next/image"
import { format } from "date-fns"
import { Logo } from "@/components/logo"

interface CertificateData {
  id: number;
  completion_date: string;
  user: { username: string };
  course: { title: string };
  signatories: { name: string; signatureImagePath: string }[];
}

export function Certificate({ data }: { data: CertificateData }) {
    return (
        <div id="certificate-print-area" className="bg-background">
            <div className="max-w-4xl mx-auto p-8 border-4 border-primary rounded-lg shadow-lg bg-card text-card-foreground relative font-serif">
                <div className="absolute inset-0 bg-repeat bg-center opacity-5" style={{backgroundImage: "url(/images/logo.png)"}}></div>

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                    <Logo />

                    <h2 className="text-2xl font-semibold text-muted-foreground tracking-widest uppercase">
                        Certificate of Completion
                    </h2>

                    <p className="text-lg">This certificate is proudly presented to</p>

                    <h1 className="text-5xl font-bold text-primary">
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

                    <div className="flex flex-wrap justify-around w-full pt-12 mt-8 border-t">
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
                                <div className="w-48 border-t border-foreground pt-2">
                                    <p className="text-sm font-semibold">{s.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
