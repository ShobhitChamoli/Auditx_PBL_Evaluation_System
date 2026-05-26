import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Mic, ArrowRight, CheckCircle, X, Eye, EyeOff } from 'lucide-react';
import { Button, Card, Badge } from '../../components/UI';
import axios from '../../config/axiosConfig';

const VivaSession = ({ project, onComplete, onCancel }) => {
    const [questions, setQuestions] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showAnswer, setShowAnswer] = useState(false);
    const [marks, setMarks] = useState({ codeQuality: 0, logic: 0, architecture: 0, viva: 0, innovation: 0 });
    const [loading, setLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Initial AI generation if needed, or start with welcome
        if (questions.length === 0) {
            handleGenerateQuestions();
        }
    }, []);

    const handleGenerateQuestions = async () => {
        setIsThinking(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.post('/api/ai/generate-viva', 
                { projectId: project.id }, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 120000 // 2 minute timeout specifically for the LLM generation
                }
            );
            setQuestions(data.questions);
            if (data.suggestedScores) {
                setMarks(prev => ({ ...prev, ...data.suggestedScores }));
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'Failed to generate questions. Please verify your local AI server is active.');
        } finally {
            setIsThinking(false);
        }
    };

    const handleScoreChange = (category, value) => {
        setMarks(prev => ({ ...prev, [category]: parseInt(value) || 0 }));
    };

    const handleNext = () => {
        if (currentStep < questions.length - 1) {
            setCurrentStep(prev => prev + 1);
            setShowAnswer(false); // Reset answer visibility on question change
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const total = Object.values(marks).reduce((a, b) => a + Number(b), 0);

            await axios.post('/api/evaluations', {
                projectId: project.id,
                marks,
                feedback: 'Evaluated via Interactive Viva Session',
                qa: answers // Save Q&A transcript if backend supports it
            }, { headers: { Authorization: `Bearer ${token}` } });

            onComplete();
        } catch (err) {
            alert('Failed to submit evaluation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                        Live Viva Session
                    </h2>
                    <p className="text-sm text-slate-500">Evaluating: <span className="font-bold text-blue-600">{project.teamName}</span></p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                        <p className="text-xs font-bold uppercase text-slate-400">Current Score</p>
                        <p className="text-2xl font-black text-slate-800">{Object.values(marks).reduce((a, b) => a + Number(b), 0)}<span className="text-sm text-slate-400">/100</span></p>
                    </div>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleSubmit} loading={loading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle size={18} /> Finalize Grade
                    </Button>
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Close Session"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-12 min-h-0">
                {/* Left: AI Interviewer */}
                <div className="col-span-3 bg-slate-100 border-r border-slate-200 p-4 flex flex-col min-h-0">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <MessageSquare size={18} /> Difficulty Flow
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {isThinking && (
                            <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-200 animate-pulse flex gap-2 items-center text-sm text-slate-500">
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></span>
                                Generating Questions...
                            </div>
                        )}
                        {questions.map((q, i) => (
                            <div
                                key={i}
                                onClick={() => setCurrentStep(i)}
                                className={`p-4 rounded-xl cursor-pointer transition-all border ${currentStep === i
                                    ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                                    : 'bg-white text-slate-600 hover:bg-blue-50 border-slate-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1 flex-wrap gap-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${currentStep === i ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>Q{i + 1}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        q.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : 
                                        q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 
                                        'bg-green-100 text-green-700'
                                    }`}>
                                        {q.difficulty}
                                    </span>
                                </div>
                                {q.assignedTo && (
                                    <div className={`text-xs font-semibold mb-1 ${currentStep === i ? 'text-blue-100' : 'text-blue-600'}`}>
                                        👤 {q.assignedTo}
                                    </div>
                                )}
                                <p className={`text-sm font-medium line-clamp-2 ${currentStep === i ? 'text-white' : ''}`}>
                                    {q.question}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center: Interaction Area */}
                <div className="col-span-6 bg-white p-8 flex flex-col overflow-y-auto min-h-0 justify-center">
                    {error && (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-6 max-w-md mx-auto">
                            <div className="p-4 bg-red-50 text-red-500 rounded-full mb-4">
                                <X size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Generation Failed</h3>
                            <p className="text-sm text-slate-500 mb-6">{error}</p>
                            <Button onClick={handleGenerateQuestions} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                                Retry Question Generation
                            </Button>
                        </div>
                    )}

                    {isThinking && !error && (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-6 max-w-md mx-auto">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1">Generating Viva Questions...</h3>
                            <p className="text-sm text-slate-500">Ollama is analyzing the project codebase and building technical questions. This might take up to 45 seconds.</p>
                        </div>
                    )}

                    {questions.length === 0 && !isThinking && !error && (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-6 max-w-md mx-auto">
                            <div className="p-4 bg-blue-50 text-blue-500 rounded-full mb-4">
                                <MessageSquare size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">No Questions Loaded</h3>
                            <p className="text-sm text-slate-500 mb-6">Start generating dynamic tech stack questions for this project submission.</p>
                            <Button onClick={handleGenerateQuestions} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                                Generate Questions Now
                            </Button>
                        </div>
                    )}

                    {questions.length > 0 && !isThinking && !error && (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex-1 flex flex-col max-w-2xl mx-auto w-full"
                            >
                                <div className="mb-6">
                                    <div className="flex gap-2 mb-4 flex-wrap">
                                        <Badge variant="info">{questions[currentStep].category}</Badge>
                                        {questions[currentStep].assignedTo && (
                                            <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">
                                                👤 Assigned to: {questions[currentStep].assignedTo}
                                            </Badge>
                                        )}
                                        <Badge variant="secondary" className={`${
                                            questions[currentStep].difficulty === 'Hard' ? 'bg-red-50 text-red-700 border-red-200' :
                                            questions[currentStep].difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-green-50 text-green-700 border-green-200'
                                        }`}>
                                            Difficulty: {questions[currentStep].difficulty}
                                        </Badge>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                                        {questions[currentStep].question}
                                    </h2>
                                </div>

                                {/* Expected Answer Panel — Teacher Only */}
                                {questions[currentStep].answer && (
                                    <div className="mb-5">
                                        <button
                                            onClick={() => setShowAnswer(prev => !prev)}
                                            className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors w-full"
                                        >
                                            {showAnswer ? <EyeOff size={15} /> : <Eye size={15} />}
                                            {showAnswer ? 'Hide Expected Answer' : 'Show Expected Answer (Teacher View)'}
                                        </button>
                                        <AnimatePresence>
                                            {showAnswer && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">📋 Expected Answer</p>
                                                        <p className="text-sm text-emerald-900 leading-relaxed">{questions[currentStep].answer}</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Mentor Notes / Student's Answer</h4>
                                    <textarea
                                        className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-700 min-h-[80px] resize-none text-base"
                                        placeholder="Type student's key points here..."
                                        value={answers[currentStep] || ''}
                                        onChange={(e) => setAnswers({ ...answers, [currentStep]: e.target.value })}
                                    />
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                                        <button className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2 text-sm font-medium">
                                            <Mic size={16} /> Use Speech-to-Text (Beta)
                                        </button>
                                        <div className="text-xs text-slate-400">Auto-saving...</div>
                                    </div>
                                </div>

                                <div className="mt-auto flex justify-end">
                                    <Button onClick={handleNext} disabled={currentStep === questions.length - 1} className="gap-2">
                                        Next Question <ArrowRight size={18} />
                                    </Button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>

                {/* Right: Live Scoring */}
                <div className="col-span-3 bg-slate-50 border-l border-slate-200 p-6 overflow-y-auto min-h-0 flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <CheckCircle size={18} className="text-emerald-600" /> Live Grading
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                Viva Performance
                                <span className="text-blue-600">{marks.viva}/25</span>
                            </label>
                            <input
                                type="range"
                                min="0" max="25"
                                value={marks.viva}
                                onChange={(e) => handleScoreChange('viva', e.target.value)}
                                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                Code Quality
                                <span className="text-blue-600">{marks.codeQuality}/20</span>
                            </label>
                            <input
                                type="range"
                                min="0" max="20"
                                value={marks.codeQuality}
                                onChange={(e) => handleScoreChange('codeQuality', e.target.value)}
                                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                Logic & Impl.
                                <span className="text-blue-600">{marks.logic}/20</span>
                            </label>
                            <input
                                type="range"
                                min="0" max="20"
                                value={marks.logic}
                                onChange={(e) => handleScoreChange('logic', e.target.value)}
                                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                Architecture
                                <span className="text-blue-600">{marks.architecture}/15</span>
                            </label>
                            <input
                                type="range"
                                min="0" max="15"
                                value={marks.architecture}
                                onChange={(e) => handleScoreChange('architecture', e.target.value)}
                                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                Innovation
                                <span className="text-blue-600">{marks.innovation}/20</span>
                            </label>
                            <input
                                type="range"
                                min="0" max="20"
                                value={marks.innovation}
                                onChange={(e) => handleScoreChange('innovation', e.target.value)}
                                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div className="pt-6 border-t border-slate-200">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Grade</p>
                                <p className="text-4xl font-extrabold text-slate-800 mt-1">
                                    {Object.values(marks).reduce((a, b) => a + Number(b), 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VivaSession;
