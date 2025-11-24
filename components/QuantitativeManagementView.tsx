
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRightIcon, UploadCloudIcon, CropIcon, TrashIcon, CheckCircleIcon, SaveIcon, ImageIcon, MousePointerIcon, EyeIcon, XCircleIcon, SettingsIcon, FileTextIcon, ZoomInIcon, ZoomOutIcon, PlayIcon } from './Icons';
import { Question, Test, AppData, Section } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
// Fixed: Use version 3.11.174 to match importmap
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface QuantitativeManagementViewProps {
    onBack: () => void;
    onStartTest: (test: Test, returnTo?: string) => void;
    data: AppData;
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => string;
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => void;
    onDeleteTest: (section: Section, testId: string, bankKey?: string, categoryKey?: string) => void;
    onDeleteTests: (section: Section, testIds: string[], bankKey?: string, categoryKey?: string) => void;
    onUpdateQuestionAnswer: (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => void;

    // New Props for Global Processing
    processorQueue: any[]; // Typing as any to avoid import circles, but ideally ProcessItem[]
    isProcessorWorking: boolean;
    onAddFilesToQueue: (files: File[], config: any) => void;
    onClearCompleted: () => void;
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

export const QuantitativeManagementView: React.FC<QuantitativeManagementViewProps> = ({ 
    onBack, 
    onStartTest, 
    data, 
    onDeleteTest,
    onDeleteTests,
    onUpdateQuestionAnswer,
    processorQueue,
    isProcessorWorking,
    onAddFilesToQueue,
    onClearCompleted
}) => {
    
    // Persistent Config State
    const [cropConfig, setCropConfig] = useState<{ questionBox: CropBox | null, answerBox: CropBox | null }>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_CROP_CONFIG);
        return saved ? JSON.parse(saved) : { questionBox: null, answerBox: null };
    });

    // View State
    const [viewMode, setViewMode] = useState<ViewMode>('upload');
    const [zoom, setZoom] = useState<number>(100); 
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Local File Staging (Before adding to queue)
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

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
            try {
                setReferenceFile(file);
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                
                // If PDF has more than 1 page, use page 2 (often representative), else page 1
                const pageIndex = pdf.numPages > 1 ? 2 : 1;
                const page = await pdf.getPage(pageIndex);
                
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                if (context) {
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    setReferenceImage(canvas.toDataURL('image/jpeg'));
                }
            } catch (error: any) {
                console.error("Error processing reference PDF:", error);
                alert(`حدث خطأ أثناء معالجة الملف: ${error.message || 'تأكد من أن الملف PDF صالح'}`);
                setReferenceFile(null);
                setReferenceImage(null);
            }
        }
    };

    const drawCanvas = (ctx: CanvasRenderingContext2D | null, img: HTMLImageElement) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(img, 0, 0);
        
        if (cropConfig.questionBox) {
            ctx.strokeStyle = '#38bdf8'; 
            ctx.lineWidth = 4;
            ctx.strokeRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.fillRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 30px Arial';
            ctx.fillText('منطقة السؤال', cropConfig.questionBox.x, cropConfig.questionBox.y - 10);
        }
        if (cropConfig.answerBox) {
            ctx.strokeStyle = '#34d399'; 
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

    // --- Queue Integration Logic ---
    
    const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setStagedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };
    
    const removeStagedFile = (index: number) => {
        setStagedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startProcessing = () => {
        if (!cropConfig.questionBox || !cropConfig.answerBox) {
            alert('يرجى تحديد مناطق القص أولاً في الإعدادات.');
            return;
        }
        if (stagedFiles.length === 0) return;

        // Push to global queue
        onAddFilesToQueue(stagedFiles, cropConfig);
        setStagedFiles([]); // Clear local stage
    };

    const handleTestSelect = (test: Test) => {
        setSelectedTest(test);
        setViewMode('details');
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === data.tests.quantitative.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.tests.quantitative.map(t => t.id)));
        }
    };

    const deleteSelected = () => {
        if (confirm(`هل أنت متأكد من حذف ${selectedIds.size} اختبار؟`)) {
            onDeleteTests('quantitative', Array.from(selectedIds));
            setSelectedIds(new Set());
            if (selectedTest && selectedIds.has(selectedTest.id)) {
                setSelectedTest(null);
            }
        }
    };
    
    // --- Sorting Logic ---
    const getTestNumber = (name: string) => {
        // Normalize Arabic numerals to English (٠-٩ -> 0-9)
        const normalized = name.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
        const match = normalized.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    const Sidebar = () => {
        // Sort tests numerically
        const sortedTests = [...data.tests.quantitative].sort((a, b) => {
            const numA = getTestNumber(a.name);
            const numB = getTestNumber(b.name);
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
        });

        return (
            <aside className="w-1/4 p-4 border-l border-border overflow-y-auto bg-surface/30 hidden md:block">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-text-muted">الاختبارات الحالية</h3>
                     {selectedIds.size > 0 && (
                         <button onClick={deleteSelected} className="text-red-400 hover:text-red-300 text-xs font-bold">حذف المحدد ({selectedIds.size})</button>
                     )}
                </div>
                 <div className="mb-2 flex items-center gap-2 px-3">
                    <input 
                        type="checkbox" 
                        checked={data.tests.quantitative.length > 0 && selectedIds.size === data.tests.quantitative.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 focus:ring-primary cursor-pointer"
                    />
                    <span className="text-xs text-text-muted select-none cursor-pointer" onClick={toggleSelectAll}>تحديد الكل</span>
                </div>
                <div className="space-y-2">
                    {sortedTests.length > 0 ? (
                        sortedTests.map(test => (
                            <div 
                                key={test.id} 
                                onClick={() => handleTestSelect(test)}
                                className={`bg-zinc-800 p-3 rounded-md text-sm flex justify-between items-center group cursor-pointer hover:bg-zinc-700 transition-colors ${selectedTest?.id === test.id ? 'border border-primary' : ''}`}
                            >
                                 <div className="flex items-center gap-2 overflow-hidden">
                                    <input 
                                        type="checkbox"
                                        checked={selectedIds.has(test.id)}
                                        onChange={(e) => { e.stopPropagation(); toggleSelection(test.id); }}
                                        className="w-4 h-4 rounded bg-zinc-600 border-zinc-500 focus:ring-primary flex-shrink-0 cursor-pointer"
                                    />
                                    <span className="truncate font-bold pl-1">{test.name}</span>
                                </div>
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
    };
    
    // --- Render Queue Status ---
    const renderQueue = () => {
        if (processorQueue.length === 0) return null;
        
        return (
            <div className="mt-6 bg-surface p-4 rounded-lg border border-border w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">قائمة المعالجة</h3>
                    <button onClick={onClearCompleted} className="text-xs text-primary hover:underline">مسح المكتمل</button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                    {processorQueue.map((item) => (
                        <div key={item.id} className="bg-zinc-800 p-3 rounded flex flex-col gap-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="truncate max-w-[70%]">{item.file.name}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                    item.status === 'completed' ? 'bg-green-900 text-green-300' :
                                    item.status === 'processing' ? 'bg-blue-900 text-blue-300 animate-pulse' :
                                    item.status === 'error' ? 'bg-red-900 text-red-300' :
                                    'bg-zinc-700 text-zinc-400'
                                }`}>
                                    {item.status === 'completed' ? 'مكتمل' :
                                     item.status === 'processing' ? 'جارٍ المعالجة...' :
                                     item.status === 'error' ? 'خطأ' : 'في الانتظار'}
                                </span>
                            </div>
                            {item.status === 'processing' && (
                                <div className="w-full bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

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
                                    <div key={idx} className={`bg-surface p-4 rounded-lg border ${q.correctAnswer === '?' ? 'border-red-500' : 'border-border'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-bold text-lg text-text-muted">سؤال {idx + 1}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-text-muted">الإجابة الصحيحة:</span>
                                                 {/* Answer Dropdown */}
                                                <select
                                                    value={q.correctAnswer}
                                                    onChange={(e) => onUpdateQuestionAnswer('quantitative', selectedTest.id, q.id, e.target.value)}
                                                    className={`px-3 py-1 rounded-md text-sm font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface ${
                                                        q.correctAnswer === '?' 
                                                        ? 'bg-red-900/30 border-red-500 text-red-300 focus:ring-red-500' 
                                                        : 'bg-green-900/30 border-green-500 text-green-300 focus:ring-green-500'
                                                    }`}
                                                >
                                                    <option value="?">غير واضحة</option>
                                                    <option value="أ">أ</option>
                                                    <option value="ب">ب</option>
                                                    <option value="ج">ج</option>
                                                    <option value="د">د</option>
                                                </select>
                                            </div>
                                        </div>
                                        {q.correctAnswer === '?' && (
                                            <div className="mb-2 p-2 bg-red-900/30 border border-red-700/50 rounded text-red-200 text-sm flex items-center gap-2">
                                                <XCircleIcon className="w-4 h-4" />
                                                <span>هذا السؤال إجابته غير واضحة. يرجى التحقق من صورة الإجابة أدناه وتعديلها.</span>
                                            </div>
                                        )}
                                        {q.questionImage && (
                                            <div className="mb-4 bg-white/5 rounded-lg p-2 inline-block">
                                                <img src={q.questionImage} alt={`Question ${idx+1}`} className="max-w-full h-auto rounded" />
                                            </div>
                                        )}
                                        {q.verificationImage && (
                                            <div className={`mt-2 p-2 bg-zinc-900/50 rounded border inline-block ${q.correctAnswer === '?' ? 'border-red-500 shadow-lg shadow-red-900/20' : 'border-zinc-700'}`}>
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
                                    سيستمر العمل في الخلفية حتى إذا غادرت الصفحة.
                                </p>
                                
                                {stagedFiles.length > 0 ? (
                                    <div className="mb-6 space-y-2 bg-zinc-900/50 p-4 rounded-lg max-h-60 overflow-y-auto text-right">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-zinc-700">
                                            <span className="text-xs font-bold text-text-muted">{stagedFiles.length} ملفات جاهزة للمعالجة</span>
                                            <button onClick={() => setStagedFiles([])} className="text-xs text-red-400 hover:underline">مسح الكل</button>
                                        </div>
                                        {stagedFiles.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded group">
                                                <div className="flex items-center gap-2 text-sm truncate">
                                                    <FileTextIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                                                    <span className="truncate">{f.name}</span>
                                                </div>
                                                <button onClick={() => removeStagedFile(i)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 p-1 rounded">
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

                                {stagedFiles.length > 0 && (
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
                                                onClick={startProcessing} 
                                                disabled={isProcessorWorking || !cropConfig.questionBox}
                                                className="px-8 py-2 bg-accent text-white font-bold rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-accent/20"
                                            >
                                                {isProcessorWorking ? 'جارٍ الإضافة للقائمة...' : `إضافة ${stagedFiles.length} للقائمة وبدء المعالجة`}
                                                <SaveIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Render Global Queue Status */}
                            {renderQueue()}
                            
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
