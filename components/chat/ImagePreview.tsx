'use client';

import React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  dataUrl: string;
}

interface ImagePreviewProps {
  images: UploadedImage[];
  onRemove: (id: string) => void;
}

export const ImagePreview = React.memo(function ImagePreview({ images, onRemove }: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img) => (
        <div key={img.id} className="relative group">
          <Image
            src={img.preview}
            alt="Uploaded"
            width={64}
            height={64}
            className="w-16 h-16 object-cover rounded-lg border"
          />
          <button
            onClick={() => onRemove(img.id)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-background border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
});

export type { UploadedImage };
