import React from 'react';

export const RunIcon = React.memo(({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Hexagon Outline (Subtle monochrome) */}
        <path
            d="M12 2L20.6603 7V17L12 22L3.33975 17V7L12 2Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
        />
        {/* Main Spark (Monochrome) */}
        <path
            d="M12 18C12 14.6863 14.6863 12 18 12C14.6863 12 12 9.31371 12 6C12 9.31371 9.31371 12 6 12C9.31371 12 12 14.6863 12 18Z"
            fill="currentColor"
        />
        {/* Activity indicator (Monochrome) */}
        <path
            d="M19 6C19 4.89543 19.8954 4 21 4C19.8954 4 19 3.10457 19 2C19 3.10457 18.1046 4 17 4C18.1046 4 19 4.89543 19 6Z"
            fill="currentColor"
            opacity="0.6"
        />
    </svg>
));

RunIcon.displayName = 'RunIcon';
