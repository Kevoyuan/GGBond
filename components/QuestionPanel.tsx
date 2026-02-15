
'use client';

import React, { useState } from 'react';
import {
    HelpCircle,
    Check,
    X,
    ChevronRight,
    Send,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Question {
    question: string;
    header: string;
    type?: 'choice' | 'text' | 'yesno';
    options?: { label: string; description?: string }[];
    multiSelect?: boolean;
    placeholder?: string;
}

interface QuestionPanelProps {
    questions: Question[];
    title: string;
    correlationId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit: (answers: any[]) => void;
    onCancel: () => void;
}

export function QuestionPanel({ questions, title, correlationId, onSubmit, onCancel }: QuestionPanelProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [answers, setAnswers] = useState<any[]>(questions.map(q => q.multiSelect ? [] : ''));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAnswerChange = (index: number, value: any) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleToggleOption = (qIndex: number, optionLabel: string) => {
        const current = answers[qIndex] as string[];
        const newSelection = current.includes(optionLabel)
            ? current.filter(l => l !== optionLabel)
            : [...current, optionLabel];
        handleAnswerChange(qIndex, newSelection);
    };

    const isComplete = () => {
        return questions.every((q, i) => {
            if (q.type === 'yesno') return typeof answers[i] === 'boolean';
            if (q.type === 'choice') return answers[i] !== '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (q.multiSelect) return (answers[i] as any[]).length > 0;
            return answers[i] !== '';
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-background rounded-xl border border-primary/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-4 py-3 border-b bg-primary/5 border-primary/10 flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{title || 'User Inquiry'}</h3>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {questions.map((q, i) => (
                        <div key={i} className="space-y-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{q.header || `Question ${i + 1}`}</span>
                                <p className="text-sm font-medium text-foreground">{q.question}</p>
                            </div>

                            {/* Text Input */}
                            {(q.type === 'text' || !q.type) && (
                                <input
                                    type="text"
                                    className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    placeholder={q.placeholder || "Your answer..."}
                                    value={answers[i]}
                                    onChange={(e) => handleAnswerChange(i, e.target.value)}
                                />
                            )}

                            {/* Choice / MultiSelect */}
                            {q.type === 'choice' && q.options && (
                                <div className="grid grid-cols-1 gap-2">
                                    {q.options.map((opt, optIdx) => (
                                        <button
                                            key={optIdx}
                                            onClick={() => q.multiSelect ? handleToggleOption(i, opt.label) : handleAnswerChange(i, opt.label)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                                                (q.multiSelect ? (answers[i] as string[]).includes(opt.label) : answers[i] === opt.label)
                                                    ? "bg-primary/10 border-primary/50 text-primary"
                                                    : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded flex items-center justify-center shrink-0 border",
                                                (q.multiSelect ? (answers[i] as string[]).includes(opt.label) : answers[i] === opt.label)
                                                    ? "bg-primary border-primary text-white"
                                                    : "bg-background border-border"
                                            )}>
                                                {(q.multiSelect ? (answers[i] as string[]).includes(opt.label) : answers[i] === opt.label) && <Check className="w-3 h-3" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{opt.label}</span>
                                                {opt.description && <span className="text-[10px] opacity-70">{opt.description}</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Yes / No */}
                            {q.type === 'yesno' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAnswerChange(i, true)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all",
                                            answers[i] === true
                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                                                : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground"
                                        )}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => handleAnswerChange(i, false)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all",
                                            answers[i] === false
                                                ? "bg-rose-500/10 border-rose-500/50 text-rose-600 dark:text-rose-400"
                                                : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground"
                                        )}
                                    >
                                        <X className="w-4 h-4" />
                                        No
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-muted/5 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!isComplete()}
                        onClick={() => onSubmit(answers)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm shadow-sm flex items-center gap-2",
                            isComplete() ? "bg-primary hover:bg-primary/90" : "bg-muted-foreground/30 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-4 h-4" />
                        Submit Answers
                    </button>
                </div>
            </div>
        </div>
    );
}
