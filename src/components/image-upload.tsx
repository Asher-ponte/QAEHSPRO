
"use client"

import { useState, type ChangeEvent, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
    onUploadComplete: (path: string) => void;
    initialPath?: string | null;
    onRemove?: () => void;
    uploadUrl?: string;
}

export function ImageUpload({ onUploadComplete, initialPath, onRemove, uploadUrl = '/api/upload' }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        // Use a key with the path to force React to re-render the image if the path changes
        // This is useful for the main logo uploader which always shows the same path
        setImagePreview(initialPath ? `${initialPath}?${new Date().getTime()}` : null);
    }, [initialPath]);
    
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Upload failed");
            }
            
            onUploadComplete(result.path);
            setImagePreview(`${result.path}?${new Date().getTime()}`);

            toast({
                title: "Upload Successful",
                description: "Your image has been uploaded.",
            });

        } catch (error) {
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
                            unoptimized // Important for seeing changes to the same file path
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
