import React, { useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel: 'M',
      }).catch((err: any) => {
        console.error('Error rendering QR code:', err);
      });
    }
  }, [value, size, darkColor, lightColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`rounded-lg shadow-xs ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
