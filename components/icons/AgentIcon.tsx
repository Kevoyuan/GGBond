import React from 'react';

export const AgentIcon = React.memo(({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Hexagon Outline */}
        <path
            d="M12 2L20.6603 7V17L12 22L3.33975 17V7L12 2Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Centered Spark (Monochrome) */}
        <path
            d="M12 16C12 13.7909 13.7909 12 16 12C13.7909 12 12 10.2091 12 8C12 10.2091 10.2091 12 8 12C10.2091 12 12 13.7909 12 16Z"
            fill="currentColor"
        />
    </svg>
));

AgentIcon.displayName = 'AgentIcon';
