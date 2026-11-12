import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeViewProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({
  value,
  size = 120,
  className = '',
  darkColor = '#0F172A',
  lightColor = '#FFFFFF',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (value) {
      // Use 3x size multiplier for crystal clear print & high-DPI export
      QRCode.toDataURL(value, {
        width: Math.max(size * 3, 240),
        margin: 1,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setDataUrl(url))
        .catch((err: any) => {
          console.error('Error rendering QR code:', err);
        });
    }
  }, [value, size, darkColor, lightColor]);

  if (!dataUrl) {
    return (
      <div
        className={`bg-white rounded-lg flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR-${value}`}
      className={`rounded-lg shadow-xs object-contain print:inline-block ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        backgroundColor: lightColor,
        colorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      } as React.CSSProperties}
    />
  );
};

