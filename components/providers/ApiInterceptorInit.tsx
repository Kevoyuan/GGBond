'use client';

import { useEffect } from 'react';
import { initApiInterceptor } from '@/lib/api-interceptor';

// Call at module evaluation time so we intercept as early as possible
if (typeof window !== 'undefined') {
    initApiInterceptor();
}

export function ApiInterceptorInit() {
    useEffect(() => {
        // Redundant but safe guard to guarantee execution
        initApiInterceptor();
    }, []);

    return null;
}
