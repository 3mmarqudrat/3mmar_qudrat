
import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Question, Section } from '../types';

// Configure PDF.js worker
// Fixed: Use version 4.0.379 to match importmap
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// Declare Tesseract globally
declare const Tesseract: any;

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ProcessItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    totalQuestions: number;
}

interface ProcessorConfig {
    questionBox: CropBox;
    answerBox: CropBox;
}

export const useQuantitativeProcessor = (
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => string,
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => void
) => {
    const [queue, setQueue] = useState<ProcessItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentConfig, setCurrentConfig] = useState<ProcessorConfig | null>(null);
    const processingRef = useRef(false);

    // --- Helper Functions (OCR & Extraction) ---

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
                resolve(canvas.toDataURL('image/jpeg', 0.9)); // Slightly lower quality for speed
            };
            img.onerror = () => resolve(imageSrc);
        });
    };

    const normalizeAnswer = (str: string): string | null => {
        if (!str) return null;
        const s = str.trim();
        if (['أ', 'ا', 'آ', 'إ', 'A', 'a'].some(c => s.includes(c))) return 'أ';
        if (['ب', 'B', 'b'].some(c => s.includes(c))) return 'ب';
        if (['ج', 'C', 'c', 'J'].some(c => s.includes(c))) return 'ج';
        if (['د', 'D', 'd'].some(c => s.includes(c))) return 'د';
        return null;
    };

    const extractAnswerFromText = (text: string): string | null => {
        if (!text) return null;
        const clean = text.replace(/[\s\u00A0\u200B\u200C\u200D\u200E\u200F_\-\.]/g, '');
        const markers = ['الصحيحة', 'الصحيحه', 'الاجابة', 'الإجابة', 'الأجابة', 'الجواب'];
        
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

        // Updated regex to include all forms of Alif (أ ا آ إ)
        if (lastIndex !== -1) {
            const targetPart = clean.substring(lastIndex + matchedMarkerLength);
            const match = targetPart.match(/([أاآإبجدABCD])/i);
            if (match) return normalizeAnswer(match[1]);
        }
        
        if (clean.length < 10) {
             const match = clean.match(/([أاآإبجدABCD])/i);
             if (match) return normalizeAnswer(match[1]);
        }
        return null;
    };

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

                if (vx >= (cropBox.x - padding) && vx <= (cropBox.x + cropBox.width + padding) &&
                    vy >= (cropBox.y - padding) && vy <= (cropBox.y + cropBox.height + padding)) {
                    foundItems.push({ str: item.str, x: vx, y: vy });
                }
            }
            foundItems.sort((a, b) => Math.abs(a.y - b.y) > 5 ? a.y - b.y : a.x - b.x);
            const rawText = foundItems.map(i => i.str).join('');
            return extractAnswerFromText(rawText);
        } catch (e) {
            return null;
        }
    };

    const detectAnswerFromImage = async (imageSrc: string): Promise<string | null> => {
        try {
            const processedImage = await preprocessImage(imageSrc);
            // Updated whitelist to include 'ا' (bare Alif) and 'آ' 'إ'
            const { data: { text } } = await Tesseract.recognize(
                processedImage, 'ara', 
                { logger: () => {}, tessedit_char_whitelist: 'أاآإبجدABCD0oالإجابةالصحيحةالجواب:.-', tessedit_pageseg_mode: '6' }
            );
            return extractAnswerFromText(text);
        } catch (e) { return null; }
    };

    const processSinglePage = async (pdf: any, pageIndex: number, config: ProcessorConfig): Promise<Omit<Question, 'id'> | null> => {
        try {
            const page = await pdf.getPage(pageIndex);
            // Re-render with scale 2.0 for coordinate match
            const highResViewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            
            canvas.width = highResViewport.width;
            canvas.height = highResViewport.height;
            await page.render({ canvasContext: ctx, viewport: highResViewport }).promise;

            const qData = ctx.getImageData(config.questionBox.x, config.questionBox.y, config.questionBox.width, config.questionBox.height);
            const qCanvas = document.createElement('canvas');
            qCanvas.width = config.questionBox.width;
            qCanvas.height = config.questionBox.height;
            qCanvas.getContext('2d')!.putImageData(qData, 0, 0);
            
            // Optimization: Reduce quality to 0.5 to keep document size manageable in Firestore
            const questionImage = qCanvas.toDataURL('image/jpeg', 0.5);

            const aData = ctx.getImageData(config.answerBox.x, config.answerBox.y, config.answerBox.width, config.answerBox.height);
            const aCanvas = document.createElement('canvas');
            aCanvas.width = config.answerBox.width;
            aCanvas.height = config.answerBox.height;
            aCanvas.getContext('2d')!.putImageData(aData, 0, 0);
            const answerImage = aCanvas.toDataURL('image/jpeg', 0.5);

            let detectedAnswer = await detectAnswerFromPdfText(page, config.answerBox);
            if (!detectedAnswer) {
                detectedAnswer = await detectAnswerFromImage(answerImage);
            }
            
            // Mark as '?' if unsure
            const finalAnswer = detectedAnswer || '?';

            return {
                questionText: 'اختر الإجابة الصحيحة',
                questionImage: questionImage,
                verificationImage: answerImage,
                options: ['أ', 'ب', 'ج', 'د'],
                correctAnswer: finalAnswer,
            };
        } catch (error) {
            console.error(`Page ${pageIndex} error`, error);
            return null;
        }
    };

    // --- Queue Management ---

    const addFilesToQueue = useCallback((files: File[], config: ProcessorConfig) => {
        const newItems: ProcessItem[] = files.map(f => ({
            id: `job_${Date.now()}_${Math.random()}`,
            file: f,
            status: 'pending',
            progress: 0,
            totalQuestions: 0
        }));
        setQueue(prev => [...prev, ...newItems]);
        setCurrentConfig(config);
    }, []);

    const processNextItem = useCallback(async () => {
        if (processingRef.current || !currentConfig) return;

        // Find the first pending item - using the current queue state
        const pendingItem = queue.find(i => i.status === 'pending');
        if (!pendingItem) return;

        processingRef.current = true;
        setIsProcessing(true);

        // Update status to processing
        setQueue(prev => prev.map(i => i.id === pendingItem.id ? { ...i, status: 'processing' } : i));

        try {
            const file = pendingItem.file;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            const rawName = file.name.replace(/\.pdf$/i, '');
            const testName = rawName.split('-')[0].trim();
            const testId = onAddTest('quantitative', testName, undefined, undefined, `تم الإنشاء من ملف: ${file.name}`);

            const pageIndices = Array.from({ length: pdf.numPages - 1 }, (_, i) => i + 2);
            let processedCount = 0;
            const questionsToAdd: Omit<Question, 'id'>[] = [];
            
            // Reduced CONCURRENCY to prevent freezing on large batches
            const CONCURRENCY = 3; 
            
            for (let i = 0; i < pageIndices.length; i += CONCURRENCY) {
                const chunk = pageIndices.slice(i, i + CONCURRENCY);
                const results = await Promise.all(
                    chunk.map(pageIndex => processSinglePage(pdf, pageIndex, currentConfig))
                );

                results.forEach(res => {
                    if (res) questionsToAdd.push(res);
                });

                processedCount += chunk.length;
                
                // Update progress safely
                setQueue(prev => prev.map(item => 
                    item.id === pendingItem.id 
                    ? { ...item, progress: Math.round((processedCount / pageIndices.length) * 100) }
                    : item
                ));
                
                // Small breathing room for UI
                await new Promise(r => setTimeout(r, 0));
            }

            if (questionsToAdd.length > 0) {
                onAddQuestionsToTest('quantitative', testId, questionsToAdd);
            }

            // Mark completed
            setQueue(prev => prev.map(item => 
                item.id === pendingItem.id 
                ? { ...item, status: 'completed', progress: 100, totalQuestions: questionsToAdd.length }
                : item
            ));

        } catch (error) {
            console.error("File processing error", error);
            setQueue(prev => prev.map(item => 
                item.id === pendingItem.id 
                ? { ...item, status: 'error', progress: 0 }
                : item
            ));
        } finally {
            processingRef.current = false;
            // The useEffect below will trigger the next item automatically.
        }
    }, [queue, currentConfig, onAddTest, onAddQuestionsToTest]);

    // Watch queue changes. If processing is free and there are pending items, start the next one.
    useEffect(() => {
        const hasPending = queue.some(i => i.status === 'pending');
        if (!processingRef.current && hasPending) {
            processNextItem();
        }
    }, [queue, processNextItem]);
    
    // Check if fully done
    useEffect(() => {
        const isStillWorking = queue.some(i => i.status === 'processing' || i.status === 'pending');
        setIsProcessing(isStillWorking);
    }, [queue]);

    const clearCompleted = () => {
        setQueue(prev => prev.filter(i => i.status !== 'completed'));
    };
    
    const cancelAll = () => {
        setQueue(prev => prev.filter(i => i.status === 'processing' || i.status === 'completed' || i.status === 'error'));
    };

    return {
        queue,
        isProcessing,
        addFilesToQueue,
        clearCompleted,
        cancelAll
    };
};
