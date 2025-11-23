
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRightIcon, UploadCloudIcon, CropIcon, TrashIcon, CheckCircleIcon, SaveIcon, ImageIcon, MousePointerIcon, EyeIcon, XCircleIcon, SettingsIcon, FileTextIcon, ZoomInIcon, ZoomOutIcon, PlayIcon } from './Icons';
import { Question, Test, AppData, Section } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

// Declare Tesseract globally as it is loaded via CDN script
declare const Tesseract: any;

interface QuantitativeManagementViewProps {
    onBack: () => void;
    onStartTest: (test: Test, returnTo?: string) => void;
    // New props to use the main app state/actions
    data: AppData;
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => string;
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => void;
    onDeleteTest: (section: Section, testId: string, bankKey?: string, categoryKey?: string) => void;
}

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

type ViewMode = 'upload' | 'calibrate' | 'details';
type CropMode = 'none' | 'question' | 'answer';

const STORAGE_KEY_CROP_CONFIG = 'quantitative_crop_config';

export const QuantitativeManagementView: React.FC<QuantitativeManagementViewProps> = ({ onBack, onStartTest, data, onAddTest, onAddQuestionsToTest, onDeleteTest }) => {
    
    // Persistent Config State
    const [cropConfig, setCropConfig] = useState<{ questionBox: CropBox | null, answerBox: CropBox | null }>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_CROP_CONFIG);
        return saved ? JSON.parse(saved) : { questionBox: null, answerBox: null };
    });

    // View State
    const [viewMode, setViewMode] = useState<ViewMode>('upload');
    const [zoom, setZoom] = useState<number>(100); // Percentage
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    
    // Upload/Process State
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState<string>('');
    const [processProgress, setProcessProgress] = useState(0);

    // Calibration State
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [currentCropMode, setCurrentCropMode] = useState<CropMode>('none');
    
    // Canvas Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

    // --- Persistence ---
    const saveCropConfig = (config: typeof cropConfig) => {
        setCropConfig(config);
        localStorage.setItem(STORAGE_KEY_CROP_CONFIG, JSON.stringify(config));
    };

    // --- Calibration Logic ---
    const handleReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setReferenceFile(file);
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            // Use page 2 (index 2 in 1-based pdf.js) as standard reference if available
            const pageIndex = pdf.numPages > 1 ? 2 : 1;
            const page = await pdf.getPage(pageIndex);
            // Use Scale 2.0 for higher resolution/clarity
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            if (context) {
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                setReferenceImage(canvas.toDataURL('image/jpeg'));
            }
        }
    };

    const drawCanvas = (ctx: CanvasRenderingContext2D | null, img: HTMLImageElement) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Draw Question Box
        if (cropConfig.questionBox) {
            ctx.strokeStyle = '#38bdf8'; // Primary
            ctx.lineWidth = 4;
            ctx.strokeRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.fillRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 30px Arial';
            ctx.fillText('منطقة السؤال', cropConfig.questionBox.x, cropConfig.questionBox.y - 10);
        }
        
        // Draw Answer Box
        if (cropConfig.answerBox) {
            ctx.strokeStyle = '#34d399'; // Success
            ctx.lineWidth = 4;
            ctx.strokeRect(cropConfig.answerBox.x, cropConfig.answerBox.y, cropConfig.answerBox.width, cropConfig.answerBox.height);
            ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
            ctx.fillRect(cropConfig.answerBox.x, cropConfig.answerBox.y, cropConfig.answerBox.width, cropConfig.answerBox.height);
            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 30px Arial';
            ctx.fillText('منطقة الإجابة', cropConfig.answerBox.x, cropConfig.answerBox.y - 10);
        }
    };

    useEffect(() => {
        if (viewMode === 'calibrate' && referenceImage && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = referenceImage;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                drawCanvas(ctx, img);
            };
        }
    }, [viewMode, referenceImage, cropConfig]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (currentCropMode === 'none') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        setStartPos({
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        });
        setIsDrawing(true);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !startPos || currentCropMode === 'none') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;
        
        const ctx = canvasRef.current!.getContext('2d');
        const img = new Image();
        img.src = referenceImage!;
        drawCanvas(ctx, img); 

        const width = currentX - startPos.x;
        const height = currentY - startPos.y;
        
        ctx!.strokeStyle = currentCropMode === 'question' ? '#38bdf8' : '#34d399';
        ctx!.lineWidth = 2;
        ctx!.setLineDash([5, 5]);
        ctx!.strokeRect(startPos.x, startPos.y, width, height);
        ctx!.setLineDash([]);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !startPos || currentCropMode === 'none') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        const width = Math.abs(currentX - startPos.x);
        const height = Math.abs(currentY - startPos.y);
        const x = Math.min(currentX, startPos.x);
        const y = Math.min(currentY, startPos.y);

        if (width > 20 && height > 20) {
            const newBox = { x, y, width, height };
            const newConfig = { ...cropConfig };
            if (currentCropMode === 'question') {
                newConfig.questionBox = newBox;
            } else {
                newConfig.answerBox = newBox;
            }
            saveCropConfig(newConfig);
        }
        
        setIsDrawing(false);
        setStartPos(null);
        setCurrentCropMode('none');
    };

    // --- Bulk Processing Logic ---
    
    const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Append new files instead of replacing
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };
    
    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Helper to preprocess image for OCR (Thresholding)
    const preprocessImage = (imageSrc: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = imageSrc;
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(imageSrc); return; }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Apply Thresholding (Binarization)
                const threshold = 140; 
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    const val = gray < threshold ? 0 : 255;
                    data[i] = val;
                    data[i + 1] = val;
                    data[i + 2] = val;
                }
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 1.0));
            };
            img.onerror = () => resolve(imageSrc);
        });
    };

    const normalizeAnswer = (str: string): string | null => {
        if (!str) return null;
        const s = str.trim();
        if (['أ', 'ا', 'A', 'a'].some(c => s.includes(c))) return 'أ';
        if (['ب', 'B', 'b'].some(c => s.includes(c))) return 'ب';
        if (['ج', 'C', 'c', 'J'].some(c => s.includes(c))) return 'ج';
        if (['د', 'D', 'd'].some(c => s.includes(c))) return 'د';
        return null;
    };

    // Core extraction logic: Split by label, take remainder.
    const extractAnswerFromText = (text: string): string | null => {
        if (!text) return null;
        
        // 1. Clean text to remove spaces/invisible chars, ensuring contiguous string
        const clean = text.replace(/[\s\u00A0\u200B\u200C\u200D\u200E\u200F_\-\.]/g, '');

        // 2. List of markers to identify the label part.
        const markers = [
            'الصحيحة', 'الصحيحه',
            'الاجابة', 'الإجابة', 'الأجابة',
            'الجواب'
        ];
        
        // 3. Find the LAST occurrence of any marker. 
        let lastIndex = -1;
        let matchedMarkerLength = 0;
        
        for (const m of markers) {
            const idx = clean.lastIndexOf(m);
            if (idx > -1) {
                if (idx > lastIndex) {
                    lastIndex = idx;
                    matchedMarkerLength = m.length;
                } else if (idx === lastIndex && m.length > matchedMarkerLength) {
                    matchedMarkerLength = m.length;
                }
            }
        }

        if (lastIndex !== -1) {
            // 4. Cut everything up to the end of the marker.
            const targetPart = clean.substring(lastIndex + matchedMarkerLength);
            
            // 5. Find the first answer letter in the remainder.
            const match = targetPart.match(/([أبجدABCD])/i);
            if (match) {
                const candidate = normalizeAnswer(match[1]);
                return candidate;
            }
        }
        
        // 6. Fallback: If text didn't have a clear marker but is very short (just the letter), take it.
        if (clean.length < 10) {
             const match = clean.match(/([أبجدABCD])/i);
             if (match) return normalizeAnswer(match[1]);
        }

        return null;
    }

    // Extract text directly from PDF layer with strict filtering
    const detectAnswerFromPdfText = async (page: any, cropBox: CropBox): Promise<string | null> => {
        try {
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 2.0 }); 

            const foundItems: { str: string, x: number, y: number }[] = [];
            const padding = 15;

            for (const item of textContent.items) {
                if (!item.str || !item.str.trim()) continue;

                const pdfX = item.transform[4];
                const pdfY = item.transform[5];
                const [vx, vy] = viewport.convertToViewportPoint(pdfX, pdfY);

                if (
                    vx >= (cropBox.x - padding) && 
                    vx <= (cropBox.x + cropBox.width + padding) &&
                    vy >= (cropBox.y - padding) && 
                    vy <= (cropBox.y + cropBox.height + padding)
                ) {
                    foundItems.push({ str: item.str, x: vx, y: vy });
                }
            }

            // Sort items: Top-to-bottom (Y), then Right-to-Left (X) for Arabic
            foundItems.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 5) {
                    return a.y - b.y; 
                }
                return a.x - b.x;
            });

            const rawText = foundItems.map(i => i.str).join('');
            return extractAnswerFromText(rawText);

        } catch (e) {
            console.error("Error extracting PDF text:", e);
            return null;
        }
    };

    const detectAnswerFromImage = async (imageSrc: string): Promise<string> => {
        try {
            const processedImage = await preprocessImage(imageSrc);
            const { data: { text } } = await Tesseract.recognize(
                processedImage,
                'ara', 
                { 
                    logger: () => {},
                    tessedit_char_whitelist: 'أبجدABCD0oالإجابةالصحيحةالجواب:.-',
                    tessedit_pageseg_mode: '6' 
                }
            );
            
            const ans = extractAnswerFromText(text);
            return ans || 'أ'; // Ultimate fallback
        } catch (e) {
            console.error("OCR Error:", e);
            return 'أ';
        }
    };

    // Helper function to process a single page
    const processSinglePage = async (pdf: any, pageIndex: number): Promise<Omit<Question, 'id'> | null> => {
        try {
            const page = await pdf.getPage(pageIndex);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            if (!ctx) return null;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Crop Question
            const qData = ctx.getImageData(cropConfig.questionBox!.x, cropConfig.questionBox!.y, cropConfig.questionBox!.width, cropConfig.questionBox!.height);
            const qCanvas = document.createElement('canvas');
            qCanvas.width = cropConfig.questionBox!.width;
            qCanvas.height = cropConfig.questionBox!.height;
            qCanvas.getContext('2d')!.putImageData(qData, 0, 0);
            const questionImage = qCanvas.toDataURL('image/jpeg', 0.8);

            // Crop Answer Verification (Image)
            const aData = ctx.getImageData(cropConfig.answerBox!.x, cropConfig.answerBox!.y, cropConfig.answerBox!.width, cropConfig.answerBox!.height);
            const aCanvas = document.createElement('canvas');
            aCanvas.width = cropConfig.answerBox!.width;
            aCanvas.height = cropConfig.answerBox!.height;
            aCanvas.getContext('2d')!.putImageData(aData, 0, 0);
            const answerImage = aCanvas.toDataURL('image/jpeg', 0.8);

            // 1. Attempt Direct PDF Text Extraction (Most Accurate & Fast)
            let detectedAnswer = await detectAnswerFromPdfText(page, cropConfig.answerBox!);

            // 2. Fallback to OCR (Slow, use only if needed)
            if (!detectedAnswer) {
                // console.log(`Fallback to OCR for page ${pageIndex}...`);
                detectedAnswer = await detectAnswerFromImage(answerImage);
            }

            return {
                questionText: 'اختر الإجابة الصحيحة',
                questionImage: questionImage,
                verificationImage: answerImage,
                options: ['أ', 'ب', 'ج', 'د'],
                correctAnswer: detectedAnswer || 'أ',
            };
        } catch (error) {
            console.error(`Error processing page ${pageIndex}:`, error);
            return null;
        }
    };

    const processAndSaveTests = async () => {
        if (!cropConfig.questionBox || !cropConfig.answerBox) {
            alert('يرجى تحديد مناطق القص أولاً في الإعدادات.');
            return;
        }
        if (files.length === 0) return;

        setIsProcessing(true);
        setProcessStatus('جاري التحضير...');
        setProcessProgress(0);

        // Pre-calculate total work for progress bar
        let totalPagesToProcess = 0;
        const filePageCounts = new Map<string, number>();

        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                const pagesInFile = pdf.numPages > 1 ? pdf.numPages - 1 : 0; // Skip cover page
                filePageCounts.set(file.name, pagesInFile);
                totalPagesToProcess += pagesInFile;
            } catch (e) {
                console.error("Error reading PDF metadata:", e);
            }
        }

        let globalProcessedCount = 0;
        const CONCURRENCY_LIMIT = 5; // Process 5 pages at a time to speed up without crashing

        try {
            for (const file of files) {
                const rawName = file.name.replace(/\.pdf$/i, '');
                const testName = rawName.split('-')[0].trim();
                const totalPages = filePageCounts.get(file.name) || 0;

                setProcessStatus(`جاري معالجة: ${testName} (${totalPages} صفحة)...`);

                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                
                // Generate array of page numbers to process (skipping page 1)
                const pageIndices = Array.from({ length: pdf.numPages - 1 }, (_, i) => i + 2);
                
                const questionsToAdd: Omit<Question, 'id'>[] = [];

                // Process in chunks for concurrency
                for (let i = 0; i < pageIndices.length; i += CONCURRENCY_LIMIT) {
                    const chunk = pageIndices.slice(i, i + CONCURRENCY_LIMIT);
                    
                    // Run batch in parallel
                    const results = await Promise.all(
                        chunk.map(pageIndex => processSinglePage(pdf, pageIndex))
                    );

                    // Collect valid results
                    results.forEach(res => {
                        if (res) questionsToAdd.push(res);
                    });

                    // Update progress
                    globalProcessedCount += chunk.length;
                    // Debounce progress updates slightly to save rendering time
                    if (globalProcessedCount % 5 === 0 || globalProcessedCount === totalPagesToProcess) {
                        setProcessProgress(Math.round((globalProcessedCount / totalPagesToProcess) * 100));
                    }
                }

                if (questionsToAdd.length > 0) {
                    const testId = onAddTest('quantitative', testName, undefined, undefined, `تم الإنشاء من ملف: ${file.name}`);
                    onAddQuestionsToTest('quantitative', testId, questionsToAdd);
                }
            }
            
            setProcessStatus('تمت العملية بنجاح!');
            setProcessProgress(100);
            setTimeout(() => {
                setFiles([]); 
                setProcessStatus('');
                setProcessProgress(0);
                setIsProcessing(false);
            }, 2000);

        } catch (error) {
            console.error(error);
            setProcessStatus('حدث خطأ أثناء المعالجة.');
            setIsProcessing(false);
        }
    };

    const handleTestSelect = (test: Test) => {
        setSelectedTest(test);
        setViewMode('details');
    };

    // --- Main Render ---
    
    if (viewMode === 'calibrate') {
        return (
            <div className="bg-bg min-h-screen flex flex-col">
                <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={() => setViewMode('upload')} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                            <ArrowRightIcon className="w-6 h-6 text-text-muted"/>
                        </button>
                        <h1 className="text-xl font-bold text-text mx-4">ضبط مناطق القص</h1>
                    </div>
                    <button onClick={() => setViewMode('upload')} className="px-4 py-2 bg-primary text-white rounded-md font-bold">
                        حفظ وإنهاء
                    </button>
                </header>
                <main className="flex-grow p-4 flex flex-col h-[calc(100vh-80px)]">
                     <div className="flex flex-wrap gap-4 mb-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                             <label className="block p-4 border-2 border-dashed border-zinc-600 rounded-lg text-center cursor-pointer hover:bg-zinc-800 transition-colors">
                                <UploadCloudIcon className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                                <span className="text-sm font-bold">رفع ملف PDF مرجعي</span>
                                <input type="file" accept="application/pdf" onChange={handleReferenceFileChange} className="hidden" />
                            </label>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border">
                            <button onClick={() => setZoom(z => Math.max(20, z - 20))} className="p-2 rounded hover:bg-zinc-700" title="تصغير">
                                <ZoomOutIcon className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-mono min-w-[3rem] text-center">{zoom}%</span>
                            <button onClick={() => setZoom(z => Math.min(300, z + 20))} className="p-2 rounded hover:bg-zinc-700" title="تكبير">
                                <ZoomInIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border">
                             <button 
                                onClick={() => setCurrentCropMode('question')} 
                                disabled={!referenceImage}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold transition-colors ${currentCropMode === 'question' ? 'bg-primary text-white' : cropConfig.questionBox ? 'bg-primary/20 text-primary' : 'bg-zinc-700'}`}
                            >
                                <CropIcon className="w-5 h-5" />
                                {cropConfig.questionBox ? 'تعديل مربع السؤال' : 'تحديد مربع السؤال'}
                            </button>
                            <button 
                                onClick={() => setCurrentCropMode('answer')} 
                                disabled={!referenceImage}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold transition-colors ${currentCropMode === 'answer' ? 'bg-success text-white' : cropConfig.answerBox ? 'bg-success/20 text-success' : 'bg-zinc-700'}`}
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                {cropConfig.answerBox ? 'تعديل مربع الإجابة' : 'تحديد مربع الإجابة'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-grow relative overflow-auto border border-border rounded-lg bg-zinc-900 flex justify-center items-start p-4">
                        {referenceImage ? (
                            <div style={{ width: `${zoom}%`, transition: 'width 0.2s ease-out' }}>
                                <canvas 
                                    ref={canvasRef} 
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    className="cursor-crosshair shadow-2xl block mx-auto"
                                    style={{ width: '100%', height: 'auto' }}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full w-full text-text-muted">
                                <p>يرجى رفع ملف للبدء في تحديد المناطق</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    const Sidebar = () => (
        <aside className="w-1/4 p-4 border-l border-border overflow-y-auto bg-surface/30 hidden md:block">
            <h3 className="font-bold text-text-muted mb-4">الاختبارات الحالية</h3>
            <div className="space-y-2">
                {data.tests.quantitative.length > 0 ? (
                    [...data.tests.quantitative]
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                    .map(test => (
                        <div 
                            key={test.id} 
                            onClick={() => handleTestSelect(test)}
                            className={`bg-zinc-800 p-3 rounded-md text-sm flex justify-between items-center group cursor-pointer hover:bg-zinc-700 transition-colors ${selectedTest?.id === test.id ? 'border border-primary' : ''}`}
                        >
                            <span className="truncate pl-2 font-bold">{test.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); if(confirm('حذف الاختبار؟')) { onDeleteTest('quantitative', test.id); if(selectedTest?.id === test.id) setSelectedTest(null); } }} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-zinc-600 p-1 rounded">
                                <TrashIcon className="w-4 h-4"/>
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-text-muted">لا توجد اختبارات.</p>
                )}
            </div>
        </aside>
    );

    return (
        <div className="bg-bg min-h-screen flex flex-col">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                            <ArrowRightIcon className="w-6 h-6 text-text-muted"/>
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-text mx-auto pr-4">إدارة القسم الكمي</h1>
                    </div>
                    <div className="flex gap-2">
                         {viewMode === 'details' && (
                             <button 
                                onClick={() => { setSelectedTest(null); setViewMode('upload'); }} 
                                className="px-4 py-2 bg-zinc-700 text-slate-200 rounded-md hover:bg-zinc-600 transition-colors font-bold text-sm"
                            >
                                + إضافة اختبار
                            </button>
                        )}
                        <button 
                            onClick={() => setViewMode('calibrate')} 
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-slate-200 rounded-md hover:bg-zinc-600 transition-colors font-bold text-sm"
                        >
                            <SettingsIcon className="w-4 h-4" />
                            <span>ضبط مناطق القص</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-row h-[calc(100vh-80px)] overflow-hidden">
                <Sidebar />

                <main className="flex-grow p-6 flex flex-col items-center justify-start overflow-y-auto relative">
                    {viewMode === 'details' && selectedTest ? (
                        <div className="max-w-4xl w-full space-y-6 pb-10">
                            <div className="flex items-center justify-between bg-surface p-6 rounded-xl border border-border">
                                <div>
                                    <h2 className="text-3xl font-bold text-primary">{selectedTest.name}</h2>
                                    <p className="text-text-muted mt-1">{selectedTest.questions.length} سؤال</p>
                                    {selectedTest.sourceText && <p className="text-xs text-text-muted mt-2">{selectedTest.sourceText}</p>}
                                </div>
                                <button 
                                    onClick={() => onStartTest(selectedTest, 'quantitativeManagement')}
                                    className="px-8 py-3 bg-accent text-white font-bold rounded-lg hover:opacity-90 transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-accent/20"
                                >
                                    <PlayIcon className="w-6 h-6" />
                                    بدء الاختبار
                                </button>
                            </div>

                            <div className="space-y-4">
                                {selectedTest.questions.map((q, idx) => (
                                    <div key={idx} className="bg-surface p-4 rounded-lg border border-border">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-bold text-lg text-text-muted">سؤال {idx + 1}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-text-muted">الإجابة الصحيحة:</span>
                                                <span className="font-bold text-success border border-success/50 px-2 rounded text-lg">{q.correctAnswer}</span>
                                            </div>
                                        </div>
                                        
                                        {q.questionImage ? (
                                            <div className="mb-4 bg-white/5 rounded-lg p-2 inline-block">
                                                <img src={q.questionImage} alt={`Question ${idx+1}`} className="max-w-full h-auto rounded" />
                                            </div>
                                        ) : (
                                            <p className="text-text mb-4">{q.questionText}</p>
                                        )}
                                        
                                        {/* Show verification image inline automatically - ALWAYS VISIBLE */}
                                        {q.verificationImage && (
                                            <div className="mt-2 p-2 bg-zinc-900/50 rounded border border-zinc-700 inline-block">
                                                <p className="text-xs text-text-muted mb-1">صورة الإجابة من الملف:</p>
                                                <img src={q.verificationImage} alt="Answer Source" className="h-24 object-contain bg-white rounded" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-2xl w-full space-y-8 pt-12">
                            {/* Config Status */}
                            <div className={`p-4 rounded-lg border flex items-center justify-between ${cropConfig.questionBox && cropConfig.answerBox ? 'bg-green-900/20 border-green-800' : 'bg-yellow-900/20 border-yellow-800'}`}>
                                <div className="flex items-center gap-3">
                                    {cropConfig.questionBox && cropConfig.answerBox ? <CheckCircleIcon className="text-green-400"/> : <XCircleIcon className="text-yellow-400"/>}
                                    <div>
                                        <h3 className="font-bold">حالة الإعدادات</h3>
                                        <p className="text-sm text-text-muted">
                                            {cropConfig.questionBox && cropConfig.answerBox 
                                                ? 'تم تحديد مناطق القص. سيتم استخراج الإجابة تلقائياً.' 
                                                : 'يرجى ضبط مناطق القص (السؤال والإجابة) قبل البدء.'}
                                        </p>
                                    </div>
                                </div>
                                {(!cropConfig.questionBox || !cropConfig.answerBox) && (
                                    <button onClick={() => setViewMode('calibrate')} className="text-sm bg-yellow-700 px-3 py-1 rounded text-white font-bold">ضبط الآن</button>
                                )}
                            </div>

                            {/* Upload Area */}
                            <div className="bg-surface p-10 rounded-xl border border-border text-center dashed-border-2 border-dashed border-zinc-600 transition-all hover:border-primary">
                                <UploadCloudIcon className="w-20 h-20 mx-auto text-primary mb-6" />
                                <h2 className="text-2xl font-bold mb-2">إضافة ملفات اختبارات (PDF)</h2>
                                <p className="text-text-muted mb-6">
                                    يمكنك تحديد <strong>أكثر من ملف</strong> دفعة واحدة.<br/>
                                    سيتم إنشاء اختبار منفصل لكل ملف PDF يتم رفعه.
                                </p>
                                
                                {files.length > 0 ? (
                                    <div className="mb-6 space-y-2 bg-zinc-900/50 p-4 rounded-lg max-h-60 overflow-y-auto text-right">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-zinc-700">
                                            <span className="text-xs font-bold text-text-muted">{files.length} ملفات جاهزة للمعالجة</span>
                                            <button onClick={() => setFiles([])} className="text-xs text-red-400 hover:underline">مسح الكل</button>
                                        </div>
                                        {files.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded group">
                                                <div className="flex items-center gap-2 text-sm truncate">
                                                    <FileTextIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                                                    <span className="truncate">{f.name}</span>
                                                </div>
                                                <button onClick={() => removeFile(i)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 p-1 rounded">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <label className="inline-block px-8 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg cursor-pointer font-bold transition-colors shadow-lg">
                                        تحديد ملفات PDF
                                        <input 
                                            type="file" 
                                            accept="application/pdf" 
                                            multiple 
                                            onChange={handleFilesChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}

                                {files.length > 0 && (
                                    <div className="mt-6 flex flex-col items-center gap-3">
                                        <div className="flex gap-4">
                                             <label className="px-6 py-2 bg-zinc-700 text-slate-300 font-bold rounded-md hover:bg-zinc-600 cursor-pointer border border-zinc-600">
                                                + إضافة المزيد
                                                <input 
                                                    type="file" 
                                                    accept="application/pdf" 
                                                    multiple 
                                                    onChange={handleFilesChange}
                                                    className="hidden"
                                                />
                                            </label>
                                            <button 
                                                onClick={processAndSaveTests} 
                                                disabled={isProcessing || !cropConfig.questionBox}
                                                className="px-8 py-2 bg-accent text-white font-bold rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-accent/20"
                                            >
                                                {isProcessing ? 'جارٍ المعالجة (سريع)...' : `إنشاء ${files.length} اختبارات`}
                                                <SaveIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Progress */}
                            {isProcessing && (
                                <div className="bg-surface p-4 rounded-lg border border-border">
                                    <div className="flex justify-between mb-2 text-sm font-bold">
                                        <span>{processStatus}</span>
                                        <span>{processProgress}%</span>
                                    </div>
                                    <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden">
                                        <div className="bg-accent h-4 rounded-full transition-all duration-300" style={{ width: `${processProgress}%` }}></div>
                                    </div>
                                </div>
                            )}
                            
                            {processStatus === 'تمت العملية بنجاح!' && (
                                <div className="bg-green-900/30 border border-green-600 text-green-400 p-4 rounded-lg text-center font-bold animate-bounce">
                                    تم إنشاء جميع الاختبارات بنجاح!
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
