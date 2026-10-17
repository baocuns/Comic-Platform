'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';

interface Props {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onClose: () => void;
}

export default function AvatarCropModal({ imageSrc, onCropComplete, onClose }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  const onCropDone = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    const canvas = document.createElement('canvas');
    const image = new Image();
    image.crossOrigin = 'anonymous';

    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.src = imageSrc;
    });

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
    );

    canvas.toBlob((blob) => {
      if (blob) onCropComplete(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />

      <div className={`relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-2xl transition-all duration-200 ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
        <div className="p-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Cắt ảnh đại diện</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Kéo và zoom để chọn vùng ảnh</p>
        </div>

        <div className="relative h-80 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropDone}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">🔍</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-amber-500"
          />
        </div>

        <div className="flex gap-3 p-4 pt-0">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:brightness-110 cursor-pointer"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
