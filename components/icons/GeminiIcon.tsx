import React from 'react';

export const GeminiIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <defs>
            <linearGradient id="gemini-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4AA9FF" />
                <stop offset="50%" stopColor="#8AB4F8" />
                <stop offset="100%" stopColor="#C58AF9" />
            </linearGradient>
        </defs>
        <path
            d="M12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24Z"
            fill="url(#gemini-gradient)"
        />
    </svg>
);
