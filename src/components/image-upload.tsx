
"use client"

import { useState, type ChangeEvent, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface ImageUploadProps {
    onUploadComplete: (path: string) => void;
    initialPath?: string | null;
    onRemove?: () => void;
    uploadPath?: string; // e.g. "logos/"
}

export function ImageUpload({ onUploadComplete, initialPath, onRemove, uploadPath = 'Upload/' }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        setImagePreview(initialPath ? `${initialPath}` : null);
    }, [initialPath]);
    
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${uploadPath}${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
        const storageRef = ref(storage, fileName);

        try {
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            onUploadComplete(downloadURL);
            setImagePreview(downloadURL);

            toast({
                title: "Upload Successful",
                description: "Your image has been uploaded.",
            });

        } catch (error) {
            console.error("Firebase upload error:", error);
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
    
    const handleRemoveImage = () => {
        setImagePreview(null);
        if (onRemove) {
            onRemove();
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 relative overflow-hidden">
                {isUploading ? (
                     <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Uploading...</p>
                    </div>
                ) : imagePreview ? (
                    <>
                        <Image
                            src={imagePreview}
                            alt="Image preview"
                            fill
                            className="object-contain"
                        />
                         {onRemove && (
                            <Button 
                                type="button" 
                                variant="destructive" 
                                size="icon" 
                                onClick={handleRemoveImage}
                                className="absolute top-2 right-2 z-10"
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove Image</span>
                            </Button>
                         )}
                    </>
                ) : (
                    <div className="text-center text-muted-foreground p-4">
                        <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">No image uploaded.</p>
                    </div>
                )}
            </div>
            <Input
                id="image-upload" // This id doesn't need to be dynamic if the label doesn't use it
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                onChange={handleFileChange}
                disabled={isUploading}
                ref={fileInputRef}
                className="hidden"
            />
            <Button type="button" variant="outline" size="sm" className="w-full" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
               <Upload className="mr-2 h-4 w-4" />
               <span>{imagePreview ? 'Change Image' : 'Upload Image'}</span>
            </Button>
        </div>
    );
}
