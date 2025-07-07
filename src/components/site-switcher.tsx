
"use client"

import { useEffect, useState } from "react"
import { ChevronsUpDown, Check, Building } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"
import type { Site } from "@/lib/sites"
import { Skeleton } from "./ui/skeleton"
import { useRouter } from "next/navigation"

export function SiteSwitcher() {
    const { site: currentSite, isLoading: isSessionLoading } = useSession();
    const [sites, setSites] = useState<Site[]>([]);
    const [open, setOpen] = useState(false)
    const [isSwitching, setIsSwitching] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        async function fetchSites() {
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) throw new Error("Failed to fetch sites");
                setSites(await res.json());
            } catch (error) {
                console.error(error);
            }
        }
        fetchSites();
    }, []);

    const handleSwitchSite = async (siteId: string) => {
        if (siteId === currentSite?.id || isSwitching) {
            setOpen(false);
            return;
        }
        setIsSwitching(true);
        try {
            const switchResponse = await fetch('/api/auth/switch-site', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId }),
            });

            if (!switchResponse.ok) {
                const errorData = await switchResponse.json();
                throw new Error(errorData.error || "Failed to switch branches.");
            }
            
            // On success, force a full page reload.
            // This is the most reliable way to ensure all state is re-evaluated with the new cookie.
            window.location.reload();

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not switch branches.",
            });
            setIsSwitching(false);
        }
    };
    
    if (isSessionLoading) {
        return <Skeleton className="h-10 w-full sm:w-[280px]" />;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full sm:w-auto sm:min-w-[280px] justify-between"
                    disabled={isSwitching}
                >
                    <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <span className="truncate">{currentSite ? currentSite.name : "Select a branch..."}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search branch..." />
                    <CommandList>
                        <CommandEmpty>No branch found.</CommandEmpty>
                        <CommandGroup>
                            {sites.map((site) => (
                                <CommandItem
                                    key={site.id}
                                    value={site.id}
                                    onSelect={(currentValue) => {
                                        handleSwitchSite(currentValue)
                                    }}
                                    disabled={isSwitching}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentSite?.id === site.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {site.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
