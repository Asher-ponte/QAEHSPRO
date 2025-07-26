
"use client"

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ImageIcon, Search } from "lucide-react";
import { Input } from "./ui/input";

interface StorageFile {
    name: string;
    url: string;
}

interface StorageBrowserProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onFileSelect: (url: string) => void;
    fileType: 'image' | 'pdf';
}

export function StorageBrowser({ open, onOpenChange, onFileSelect, fileType }: StorageBrowserProps) {
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        if (open) {
            const fetchFiles = async () => {
                setIsLoading(true);
                try {
                    const res = await fetch('/api/storage/files');
                    if (!res.ok) throw new Error("Failed to fetch stored files.");
                    setFiles(await res.json());
                } catch (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: error instanceof Error ? error.message : "Could not load files.",
                    });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchFiles();
        }
    }, [open, toast]);

    const filteredFiles = files
        .filter(file => {
            const lowerCaseName = file.name.toLowerCase();
            const extension = lowerCaseName.split('.').pop();
            const typeMatch = fileType === 'image' 
                ? ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension!)
                : extension === 'pdf';
            const searchMatch = lowerCaseName.includes(searchTerm.toLowerCase());
            return typeMatch && searchMatch;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    
    const handleSelect = (url: string) => {
        onFileSelect(url);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Browse Storage</DialogTitle>
                    <DialogDescription>
                        Select an existing {fileType} to reuse it.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search files..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <ScrollArea className="flex-1 -mx-6 px-6">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {isLoading ? (
                           Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="w-full aspect-square" />)
                        ) : filteredFiles.length > 0 ? (
                           filteredFiles.map(file => (
                                <button key={file.url} onClick={() => handleSelect(file.url)} className="relative aspect-square w-full group border rounded-md overflow-hidden flex flex-col items-center justify-center text-center p-2 hover:bg-accent hover:text-accent-foreground transition-colors">
                                    {fileType === 'image' ? (
                                        <Image src={file.url} alt={file.name} fill className="object-contain" sizes="200px" />
                                    ) : (
                                        <FileText className="h-16 w-16" />
                                    )}
                                     <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                                        {file.name}
                                    </div>
                                </button>
                           ))
                        ) : (
                            <div className="col-span-full text-center text-muted-foreground py-16">
                                No matching files found in storage.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
