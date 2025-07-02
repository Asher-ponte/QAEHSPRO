
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Download, Award } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

import { Button } from "@/components/ui/button"
import { Certificate } from "@/components/certificate"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

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

function CertificateSkeleton() {
    return (
        <div className="max-w-4xl mx-auto p-8 border rounded-lg shadow-lg">
            <div className="space-y-8">
                <div className="flex justify-center">
                    <Skeleton className="h-20 w-48" />
                </div>
                <div className="text-center space-y-4">
                    <Skeleton className="h-6 w-1/3 mx-auto" />
                    <Skeleton className="h-12 w-3/4 mx-auto" />
                    <Skeleton className="h-6 w-1/2 mx-auto" />
                </div>
                <div className="flex justify-around pt-8">
                    <div className="text-center">
                        <Skeleton className="h-12 w-32 mb-2" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="text-center">
                        <Skeleton className="h-12 w-32 mb-2" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function CertificatePage() {
  const [data, setData] = useState<CertificateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const params = useParams<{ id: string }>()
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!params.id) return;

    const fetchCertificate = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/profile/certificates/${params.id}`);
            if (!res.ok) throw new Error("Failed to fetch certificate data.");
            const certData = await res.json();
            setData(certData);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not load certificate.",
            });
            router.push('/profile/certificates');
        } finally {
            setIsLoading(false);
        }
    };
    fetchCertificate();
  }, [params.id, router, toast]);

  const handleDownload = async () => {
    if (!data || isDownloading) return;
    setIsDownloading(true);

    const certificateElement = document.getElementById('certificate-to-download');
    if (!certificateElement) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not find certificate element to download.",
        });
        setIsDownloading(false);
        return;
    }

    try {
        const canvas = await html2canvas(certificateElement, {
            scale: 2, // Increase scale for better quality
            useCORS: true,
            backgroundColor: null,
        });
        const imgData = canvas.toDataURL('image/png');

        // Create a portrait A4 PDF
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(imgData);
        const imgWidth = imgProps.width;
        const imgHeight = imgProps.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

        const w = imgWidth * ratio;
        const h = imgHeight * ratio;
        
        const x = (pdfWidth - w) / 2;
        const y = (pdfHeight - h) / 2;
        
        pdf.addImage(imgData, 'PNG', x, y, w, h);
        pdf.save(`certificate-${data.certificateNumber || data.id}.pdf`);

    } catch (error) {
        console.error("Failed to download certificate:", error);
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: "An error occurred while generating the PDF.",
        });
    } finally {
        setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/profile/certificates"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold font-headline">Certificate of Completion</h1>
            </div>
        </div>
        <Button onClick={handleDownload} disabled={isLoading || isDownloading}>
            {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Download className="mr-2 h-4 w-4" />
            )}
            Download Certificate
        </Button>
      </div>

      {isLoading && <CertificateSkeleton />}
      {!isLoading && data && (
        <Certificate data={data} />
      )}
       {!isLoading && !data && (
        <div className="text-center py-12">
            <p>Could not load certificate data.</p>
        </div>
       )}
    </div>
  )
}
