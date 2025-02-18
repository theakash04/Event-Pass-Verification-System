"use client"
import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import axios from 'axios';

interface result {
    entryCount: string,
    name: string,
    rollNumber: string,
    purpose: string
}


const QRScanner = () => {
    const [result, setResult] = useState<result | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const scannerRef = React.useRef<Html5Qrcode | null>(null);


    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        // Initialize scanner
        scannerRef.current = new Html5Qrcode("reader");

        // Start camera when component mounts
        startCamera();

        // Cleanup when component unmounts
        return () => {
            if (scannerRef.current && scanning) {
                scannerRef.current.stop().catch(err => console.error('Error stopping scanner:', err));
            }
        };
    }, []);

    const startCamera = async () => {
        try {
            if (!scannerRef.current) return;

            const qrCodeSuccessCallback = async (decodedText: string) => {
                await handleScan(decodedText);
            };

            const config = {
                fps: 60,
                qrbox: { width: 350, height: 350 },
                aspectRatio: 1.0
            };

            await scannerRef.current.start(
                { facingMode: "environment" },
                config,
                qrCodeSuccessCallback,
                undefined
            );

            setScanning(true);
            setError(null);
        } catch (err) {
            setError('Failed to access camera. Please ensure you have granted camera permissions.');
        }
    };

    const handleScan = async (qrCode: string) => {
        try {
            // Stop scanning after successful detection
            if (scannerRef.current) {
                await scannerRef.current.stop();
                setScanning(false);
            }

            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/verify-entry`,
                { serial: qrCode.toString() },
            );

            setResult(response.data);
            setShowResult(true);

        } catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message || 'Failed to process QR code. Please try again.');
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
        }
    };

    const handleCloseResult = () => {
        setShowResult(false);
        // Restart scanning after closing result
        startCamera();
    };

    return (
        <div className="relative min-h-screen flex flex-col">
            {/* HEADER */}
            <header className="bg-secondary p-4 text-center">
                <h1 className="text-2xl font-bold">
                    Aurora25-PassScanner
                </h1>
            </header>

            {/* main content */}
            <div key="qr-scanner" className="flex flex-col items-center gap-4 p-4 justify-center h-full">
                <div className="relative w-full max-w-md rounded-lg overflow-hidden bg-background border border-muted-foreground">
                    {/* Scanner container */}
                    <div
                        id="reader"
                        className="w-full"
                        style={{ minHeight: '300px' }}
                    />

                    {scanning && (
                        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded w-max text-center">
                            Scanning for QR Code...
                        </div>
                    )}
                </div>

                {error && (
                    <div className='flex flex-col item-center justify-center gap-5'>
                        <div className="text-destructive-foreground text-lg my-2 font-bold text-center">
                            {error}
                        </div>
                        <Button variant={"secondary"} onClick={() => {
                            setError(null)
                            startCamera()
                        }}>
                            Retry
                        </Button>
                    </div>
                )
                }

                <Dialog open={showResult} onOpenChange={handleCloseResult}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Scan Result</DialogTitle>
                        </DialogHeader>
                        <div className='w-full items-center flex flex-col justify-center gap-6'>
                            <div className="p-4 text-md flex flex-col items-center justify-center">
                                <p>{`Name: ${result?.name}`}</p>
                                <p>{`Roll: ${result?.rollNumber}`}</p>
                                <p>{`Entry Count: ${result?.entryCount}`}</p>
                                <p className='text-green-400 pt-5 text-lg'>{result?.purpose} verified successfully</p>
                            </div>
                            <Button onClick={handleCloseResult} className='w-max'>
                                Scan Another Code
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div >
            <footer className='absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded w-max text-center'>
                By CSS | @theakash04
            </footer>

        </div>
    );
};

export default QRScanner;
