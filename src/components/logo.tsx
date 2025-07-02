
export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary text-primary-foreground p-2 rounded-lg">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 48 48"
            className="h-6 w-6"
        >
            <g 
                fill="none" 
                stroke="currentColor" 
                strokeLinejoin="round" 
                strokeWidth="4"
            >
                <path 
                    strokeLinecap="round" 
                    d="M12 20a12 12 0 1 1 24 0v16a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6Z"
                />
                <path d="M29.5 20a5.5 5.5 0 1 1-11 0a5.5 5.5 0 0 1 11 0Z"/>
                <path 
                    strokeLinecap="round" 
                    d="m24 14.5l-.01-3m0 17v-3m5.4-8.9l2.12-2.12m-12.72 9.9l2.12-2.12m8.48 0l2.12 2.12m-12.72-9.9l2.12 2.12m-4.24 3h3m11 0h3"
                />
            </g>
        </svg>
      </div>
      <span className="text-xl font-bold font-headline text-primary">
        QAEHS PRO
      </span>
    </div>
  );
}
