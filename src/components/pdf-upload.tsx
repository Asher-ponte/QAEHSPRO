
"use client"

import { useState, type ChangeEvent, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, FileText, Search } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { StorageBrowser } from "./storage-browser";

interface PdfUploadProps {
    onUploadComplete: (path: string) => void;
    initialPath?: string | null;
    onRemove?: () => void;
}

export function PdfUpload({ onUploadComplete, initialPath, onRemove }: PdfUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [filePath, setFilePath] = useState<string | null>(null);
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        setFilePath(initialPath || null);
    }, [initialPath]);
    
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `Upload/${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
        const storageRef = ref(storage, fileName);

        try {
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            onUploadComplete(downloadURL);
            setFilePath(downloadURL);

            toast({
                title: "Upload Successful",
                description: "Your PDF has been uploaded.",
            });

        } catch (error) {
             console.error("Firebase PDF upload error:", error);
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    
    const handleRemoveFile = () => {
        setFilePath(null);
        if (onRemove) {
            onRemove();
        }
    }

    const handleFileSelectFromBrowser = (url: string) => {
        onUploadComplete(url);
        setFilePath(url);
    }

    const getFileName = (path: string | null) => {
        if (!path) return 'No file uploaded.';
        try {
            // Decode URL and get the part after the last '/'
            const url = new URL(path);
            const pathParts = url.pathname.split('/');
            const encodedFileName = pathParts[pathParts.length - 1];
            // Remove the unique prefix for display
            const originalFileName = decodeURIComponent(encodedFileName).split('-').slice(2).join('-');
            return originalFileName || 'File';
        } catch (e) {
            return 'File';
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="w-full h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 relative overflow-hidden p-2">
                {isUploading ? (
                     <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Uploading...</p>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm font-medium truncate" title={getFileName(filePath)}>{getFileName(filePath)}</p>
                    </div>
                )}
                 {filePath && !isUploading && (
                    <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        onClick={handleRemoveFile}
                        className="absolute top-2 right-2 z-10 h-6 w-6"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove PDF</span>
                    </Button>
                 )}
            </div>
            <Input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={isUploading}
                ref={fileInputRef}
                className="hidden"
            />
             <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" className="w-full" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                   <Upload className="mr-2 h-4 w-4" />
                   <span>{filePath ? 'Change' : 'Upload'}</span>
                </Button>
                 <Button type="button" variant="outline" size="sm" className="w-full" disabled={isUploading} onClick={() => setIsBrowserOpen(true)}>
                   <Search className="mr-2 h-4 w-4" />
                   <span>Browse</span>
                </Button>
            </div>
             <StorageBrowser 
                open={isBrowserOpen}
                onOpenChange={setIsBrowserOpen}
                onFileSelect={handleFileSelectFromBrowser}
                fileType="pdf"
            />
        </div>
    );
}
