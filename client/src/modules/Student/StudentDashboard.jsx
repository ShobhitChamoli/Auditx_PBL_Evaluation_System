import React, { useState, useEffect, useContext } from 'react';
import axios from '../../config/axiosConfig';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Card, Button, Input, Badge, LoadingSpinner, StatCard, Modal } from '../../components/UI';
import AuthContext from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Github, Award, TrendingUp, Clock, CheckCircle, Upload, Users, Crown, User, Bell, AlertTriangle, X, Lightbulb } from 'lucide-react';
import SkillRadarChart from '../Analytics/SkillRadarChart';
import PerformanceComparison from '../Analytics/PerformanceComparison';
import GrowthTimeline from '../Analytics/GrowthTimeline';

const StudentDashboard = () => {
    const { user } = useContext(AuthContext);
    const [projects, setProjects] = useState([]); // Changed to array
    const [selectedProjectIndex, setSelectedProjectIndex] = useState(0); // Track which project to display
    const [benchmarks, setBenchmarks] = useState(null);
    const [submission, setSubmission] = useState({
        teamName: '', leaderName: '', members: '', repoLink: '', title: '', description: '', domain: 'Web', techStack: '',
        courseCode: '', subjectName: '', semester: '1', academicYear: new Date().getFullYear().toString()
    });
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState([]);

    const [notifications, setNotifications] = useState([]);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [showSubmissionForm, setShowSubmissionForm] = useState(false); // For submitting additional projects
    const [pdfParsing, setPdfParsing] = useState(false);
    const [pdfParsed, setPdfParsed] = useState(false);

    const extractTextFromPdf = (file) => {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = async (e) => {
                try {
                    const typedarray = new Uint8Array(e.target.result);
                    const pdfjsLib = window.pdfjsLib;
                    if (!pdfjsLib) {
                        return reject(new Error("PDF parsing library (pdf.js) is not loaded yet. Please wait a moment or reload the page."));
                    }
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                    
                    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(" ");
                        fullText += pageText + "\n";
                    }
                    resolve(fullText);
                } catch (err) {
                    reject(err);
                }
            };
            fileReader.onerror = () => reject(new Error("File reading failed"));
            fileReader.readAsArrayBuffer(file);
        });
    };

    const handlePdfUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPdfParsing(true);
        try {
            const text = await extractTextFromPdf(file);
            setSubmission(prev => ({ ...prev, pdfText: text }));
            setPdfParsed(true);
            alert("PDF Synopsis parsed and synced successfully! ✅ Ready to submit.");
        } catch (err) {
            console.error(err);
            alert("Failed to parse PDF: " + err.message);
        } finally {
            setPdfParsing(false);
        }
    };

    const handleUpdatePdf = async (projectId, e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPdfParsing(true);
        try {
            const text = await extractTextFromPdf(file);
            const token = localStorage.getItem('token');
            await axios.put(`/api/projects/${projectId}`, { pdfText: text }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Update local state
            setProjects(projects.map(p => p.id === projectId ? { ...p, pdfText: text } : p));
            alert("PDF Synopsis updated successfully! ✅ Your mentor's AI viva is now synced with this template.");
        } catch (err) {
            console.error(err);
            alert("Failed to update PDF: " + err.message);
        } finally {
            setPdfParsing(false);
        }
    };

    useEffect(() => {
        fetchProject();
        fetchCourses();
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(data);
        } catch (error) {
            console.error("Failed to fetch notifications");
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error("Failed to mark notification as read", error);
        }
    };

    const handleDeleteNotification = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this notification?")) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (error) {
            console.error("Failed to delete notification");
        }
    };

    const fetchCourses = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get('/api/auth/courses', { headers: { Authorization: `Bearer ${token}` } });
            setCourses(data);
        } catch (error) {
            console.error("Failed to fetch courses");
        }
    };

    const fetchProject = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get('/api/projects/me', { headers: { Authorization: `Bearer ${token}` } });
            // Backend now returns an array of projects
            if (Array.isArray(data) && data.length > 0) {
                setProjects(data); // Store all projects
                if (data[0].evaluation) fetchBenchmarks();
            } else {
                setProjects([]);
            }
        } catch (error) {
            console.log('No project found');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchBenchmarks = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get('/api/evaluations/benchmarks', { headers: { Authorization: `Bearer ${token}` } });
            setBenchmarks(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/projects', { ...submission, members: submission.members.split(',').map(m => m.trim()) }, { headers: { Authorization: `Bearer ${token}` } });
            fetchProject();
        } catch (error) {
            alert(error.response?.data?.message || 'Submission failed');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'courseCode') {
            const selectedCourse = courses.find(c => c.name === value);
            if (selectedCourse) {
                setSubmission(prev => ({
                    ...prev,
                    courseCode: value,
                    semester: selectedCourse.semester,
                    academicYear: selectedCourse.batch,
                    subjectName: selectedCourse.title || prev.subjectName
                }));
            } else {
                setSubmission(prev => ({ ...prev, [name]: value }));
            }
        } else {
            setSubmission(prev => ({ ...prev, [name]: value }));
        }
    };

    if (loading) return <LoadingSpinner size="lg" />;

    // Helper variable for the currently selected project
    const project = projects[selectedProjectIndex];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 fade-in">
            {/* Header */}
            <div className="mb-8 slide-up flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-20">
                <div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">Hello, {user.name} 👋</h1>
                    <p className="text-slate-500 font-medium">Welcome to your project dashboard</p>
                </div>
                {/* Notification Bell / Panel */}
                {/* Notification Bell / Panel */}
                <div className="relative z-50">
                    <Button
                        variant="outline"
                        className="relative"
                        onClick={() => setIsNotificationModalOpen(true)}
                    >
                        <Bell size={20} className={notifications.some(n => !n.read) ? "text-amber-500 fill-amber-500" : ""} />
                        {notifications.filter(n => !n.read).length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                            </span>
                        )}
                        <span className="ml-2">Notifications</span>
                    </Button>
                </div>
            </div>

            {/* Notification Modal */}
            <Modal isOpen={isNotificationModalOpen} onClose={() => setIsNotificationModalOpen(false)} title="Notifications">
                <div className="flex flex-col max-h-[60vh] overflow-y-auto space-y-3 p-1">
                    {notifications.length > 0 ? (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => !n.read && handleMarkAsRead(n.id)}
                                className={`relative p-4 rounded-xl border transition-all duration-200 group ${n.read
                                    ? 'bg-slate-50 border-slate-100'
                                    : 'bg-white border-blue-100 shadow-sm shadow-blue-50 cursor-pointer hover:shadow-md hover:border-blue-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2 pr-6">
                                    <h4 className={`font-bold text-base ${n.read ? 'text-slate-600' : 'text-slate-800'}`}>
                                        <div className="flex items-center gap-2">
                                            {n.type === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
                                            {n.title}
                                        </div>
                                        {!n.read && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 align-middle"></span>}
                                    </h4>
                                    <button
                                        onClick={(e) => handleDeleteNotification(n.id, e)}
                                        className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete notification"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <p className={`text-sm leading-relaxed mb-3 ${n.read ? 'text-slate-500' : 'text-slate-600'}`}>{n.message}</p>
                                <div className="flex justify-end items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                            <div className="bg-slate-50 p-4 rounded-full mb-3 ring-4 ring-slate-50">
                                <Lightbulb className="text-slate-300" size={32} />
                            </div>
                            <p className="font-medium">All caught up!</p>
                            <p className="text-xs text-slate-400 mt-1">No new notifications for you.</p>
                        </div>
                    )}
                </div>
            </Modal>

            {projects.length === 0 ? (
                <div className="max-w-4xl mx-auto slide-up">
                    <Card hover={false}>
                        <div className="text-center mb-8">
                            <Upload className="mx-auto mb-4 text-primary" size={48} />
                            <h2 className="text-3xl font-bold gradient-text mb-2">Submit Your Project</h2>
                            <p className="text-slate-500 font-medium">Fill in the details below to submit your project for evaluation</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input name="teamName" label="Team Name" placeholder="Enter team name" onChange={handleChange} required />
                                <Input name="leaderName" label="Team Leader" placeholder="Leader's name" onChange={handleChange} required />
                                <div className="md:col-span-2">
                                    <Input name="members" label="Team Members" placeholder="Member1, Member2, Member3" onChange={handleChange} />
                                </div>
                                <div className="md:col-span-2">
                                    <Input name="repoLink" label="GitHub Repository" placeholder="https://github.com/..." onChange={handleChange} icon={<Github size={18} />} required />
                                </div>
                                <div className="md:col-span-2">
                                    <Input name="title" label="Project Title" placeholder="Your amazing project" onChange={handleChange} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Project Description</label>
                                <textarea
                                    name="description"
                                    placeholder="Describe your project, its features, and what makes it unique..."
                                    className="glass-input h-32 w-full pt-2 resize-none"
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 mb-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Course / Batch</label>
                                    <div className="relative group">
                                        <select
                                            name="courseCode"
                                            onChange={handleChange}
                                            value={submission.courseCode}
                                            required
                                            className="glass-input appearance-none bg-no-repeat bg-right pr-6 w-full"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                                        >
                                            <option value="">Select Course...</option>
                                            {courses.map(c => (
                                                <option key={c.id} value={c.name}>{c.title ? `${c.title} (${c.name})` : `${c.name} (${c.batch})`}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <Input name="subjectName" label="Subject Name" placeholder="e.g. Software Engineering" onChange={handleChange} required />
                                <div className="space-y-1 mb-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Semester</label>
                                    <div className="relative group">
                                        <select
                                            name="semester"
                                            value={submission.semester}
                                            disabled
                                            className="glass-input appearance-none bg-no-repeat bg-right pr-6 bg-slate-100 text-slate-500 cursor-not-allowed w-full"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <Input name="academicYear" label="Academic Year" placeholder="e.g. 2025-2026" value={submission.academicYear} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed w-full" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input name="domain" label="Domain" placeholder="Web, AI, ML, Mobile..." onChange={handleChange} required />
                                <Input name="techStack" label="Tech Stack" placeholder="React, Node.js, MongoDB..." onChange={handleChange} required />
                            </div>
                            
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Project Report / Synopsis (PDF) - Optional</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handlePdfUpload}
                                        className="hidden"
                                        id="pdf-upload"
                                        disabled={pdfParsing}
                                    />
                                    <label
                                        htmlFor="pdf-upload"
                                        className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:bg-slate-50 ${
                                            pdfParsed ? 'text-emerald-600 border-emerald-300 bg-emerald-50/20' : 'text-slate-600'
                                        }`}
                                    >
                                        <Upload size={14} />
                                        {pdfParsing ? 'Parsing PDF...' : pdfParsed ? '✓ PDF Attached' : 'Choose PDF File'}
                                    </label>
                                    {pdfParsed && (
                                        <button
                                            type="button"
                                            onClick={() => { setSubmission(prev => ({ ...prev, pdfText: '' })); setPdfParsed(false); }}
                                            className="text-xs text-red-500 hover:underline font-semibold"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <p className="text-slate-400 text-[10px] mt-1">Extracts report details so the AI viva examiner generates questions specific to your synopsis template.</p>
                            </div>
                            <Button type="submit" className="w-full flex items-center justify-center gap-2">
                                <Upload size={18} />
                                Submit Project
                            </Button>
                        </form>
                    </Card>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Project Selector - Always show when projects exist */}
                    <Card hover={false} className="slide-up">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-slate-800">Your Projects ({projects.length})</h3>
                                {projects.length > 1 && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-semibold text-slate-600">View:</label>
                                        <select
                                            value={selectedProjectIndex}
                                            onChange={(e) => setSelectedProjectIndex(Number(e.target.value))}
                                            className="glass-input appearance-none bg-no-repeat bg-right pr-8 py-2"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                                        >
                                            {projects.map((proj, idx) => (
                                                <option key={idx} value={idx}>
                                                    {proj.title} - {proj.courseCode}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={() => setShowSubmissionForm(!showSubmissionForm)}
                                size="sm"
                                variant={showSubmissionForm ? "outline" : "primary"}
                            >
                                <Upload size={16} className="mr-2" />
                                {showSubmissionForm ? "Cancel" : "Submit Another Project"}
                            </Button>
                        </div>
                    </Card>

                    {/* Submission Form - Show when button clicked */}
                    {showSubmissionForm && (
                        <Card hover={false} className="slide-up">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold gradient-text mb-2">Submit New Project</h3>
                                <p className="text-slate-500 font-medium">Submit a project for a different course</p>
                            </div>
                            <form onSubmit={(e) => { handleSubmit(e); setShowSubmissionForm(false); }} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input name="teamName" label="Team Name" placeholder="Enter team name" onChange={handleChange} required />
                                    <Input name="leaderName" label="Team Leader" placeholder="Leader's name" onChange={handleChange} required />
                                    <div className="md:col-span-2">
                                        <Input name="members" label="Team Members" placeholder="Member1, Member2, Member3" onChange={handleChange} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input name="repoLink" label="GitHub Repository" placeholder="https://github.com/..." onChange={handleChange} icon={<Github size={18} />} required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input name="title" label="Project Title" placeholder="Your amazing project" onChange={handleChange} required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Project Description</label>
                                    <textarea
                                        name="description"
                                        placeholder="Describe your project, its features, and what makes it unique..."
                                        className="glass-input h-32 w-full pt-2 resize-none"
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1 mb-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Course / Batch</label>
                                        <div className="relative group">
                                            <select
                                                name="courseCode"
                                                onChange={handleChange}
                                                value={submission.courseCode}
                                                required
                                                className="glass-input appearance-none bg-no-repeat bg-right pr-6 w-full"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                                            >
                                                <option value="">Select Course...</option>
                                                {courses.filter(c => !projects.some(p => p.courseCode === c.name)).map(c => (
                                                    <option key={c.id} value={c.name}>{c.title ? `${c.title} (${c.name})` : `${c.name} (${c.batch})`}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <Input name="subjectName" label="Subject Name" placeholder="e.g. Software Engineering" onChange={handleChange} required />
                                    <div className="space-y-1 mb-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Semester</label>
                                        <div className="relative group">
                                            <select
                                                name="semester"
                                                value={submission.semester}
                                                disabled
                                                className="glass-input appearance-none bg-no-repeat bg-right pr-6 bg-slate-100 text-slate-500 cursor-not-allowed w-full"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <Input name="academicYear" label="Academic Year" placeholder="e.g. 2025-2026" value={submission.academicYear} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed w-full" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input name="domain" label="Domain" placeholder="Web, AI, ML, Mobile..." onChange={handleChange} required />
                                    <Input name="techStack" label="Tech Stack" placeholder="React, Node.js, MongoDB..." onChange={handleChange} required />
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Project Report / Synopsis (PDF) - Optional</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={handlePdfUpload}
                                            className="hidden"
                                            id="pdf-upload-new"
                                            disabled={pdfParsing}
                                        />
                                        <label
                                            htmlFor="pdf-upload-new"
                                            className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:bg-slate-50 ${
                                                pdfParsed ? 'text-emerald-600 border-emerald-300 bg-emerald-50/20' : 'text-slate-600'
                                            }`}
                                        >
                                            <Upload size={14} />
                                            {pdfParsing ? 'Parsing PDF...' : pdfParsed ? '✓ PDF Attached' : 'Choose PDF File'}
                                        </label>
                                        {pdfParsed && (
                                            <button
                                                type="button"
                                                onClick={() => { setSubmission(prev => ({ ...prev, pdfText: '' })); setPdfParsed(false); }}
                                                className="text-xs text-red-500 hover:underline font-semibold"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-[10px] mt-1">Extracts report details so the AI viva examiner generates questions specific to your synopsis template.</p>
                                </div>
                                <Button type="submit" className="w-full flex items-center justify-center gap-2">
                                    <Upload size={18} />
                                    Submit Project
                                </Button>
                            </form>
                        </Card>
                    )}

                    {/* Stats Row */}
                    {project?.evaluation && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 slide-up">
                            <StatCard title="Total Score" value={`${project.evaluation.total}/100`} icon={<Award />} />
                            <StatCard title="Code Quality" value={`${project.evaluation.marks.codeQuality}/20`} icon={<CheckCircle />} />
                            <StatCard title="Viva Score" value={`${project.evaluation.marks.viva}/25`} icon={<TrendingUp />} />
                            <StatCard title="Innovation" value={`${project.evaluation.marks.innovation}/20`} icon={<Award />} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Project Details */}
                        <Card hover={false} className="slide-up">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-3xl font-bold gradient-text mb-2">{project.title}</h2>
                                    <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                                        <span>{project.domain}</span>
                                        <span>•</span>
                                        <span>{project.teamName}</span>
                                    </div>
                                </div>
                                {project.evaluation ? (
                                    <Badge variant="success"><CheckCircle size={12} /> Evaluated</Badge>
                                ) : (
                                    <Badge variant="warning"><Clock size={12} /> Pending</Badge>
                                )}
                            </div>
                            <p className="text-slate-600 mb-6 leading-relaxed font-medium">{project.description}</p>

                            <div className="mb-8 p-6 bg-blue-50/30 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>
                                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-5 flex items-center gap-2 relative z-10">
                                    <Users size={16} className="text-blue-600" /> Team Roster
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                                    {/* Leader Card */}
                                    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-100 to-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                                                {project.leaderName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-1 border-2 border-white shadow-sm">
                                                <Crown size={10} className="fill-current" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-base font-bold text-slate-800 leading-tight mb-0.5">{project.leaderName}</div>
                                            <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wide">
                                                Team Leader
                                            </div>
                                        </div>
                                    </div>

                                    {/* Members */}
                                    {project.members && project.members.map((member, index) => (
                                        <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-100 to-white text-slate-500 flex items-center justify-center font-bold text-xl border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                                                {member.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-base font-bold text-slate-700 leading-tight mb-0.5">{member}</div>
                                                <div className="text-xs font-semibold text-slate-400">Team Member</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 text-sm font-semibold">Tech Stack:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {project.techStack.split(',').map((tech, index) => (
                                            <Badge key={index} variant="primary">{tech.trim()}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <a
                                    href={project.repoLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-primary hover:text-secondary transition-colors font-semibold"
                                >
                                    <Github size={18} /> View Repository
                                </a>
                            </div>
                        </Card>

                        {/* Assessment Result */}
                        {project.evaluation ? (
                            <Card hover={false} className="slide-up">
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                    <Award className="text-primary" /> Assessment Result
                                </h2>
                                <div className="flex items-center justify-around mb-8">
                                    <div className="w-40 h-40">
                                        <CircularProgressbar
                                            value={project.evaluation.total}
                                            text={`${project.evaluation.total}%`}
                                            styles={buildStyles({
                                                textSize: '20px',
                                                pathColor: project.evaluation.total >= 70 ? '#10b981' : project.evaluation.total >= 40 ? '#f59e0b' : '#ef4444',
                                                textColor: '#0f172a',
                                                trailColor: '#e2e8f0',
                                                pathTransitionDuration: 1.5,
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-8">
                                            <span className="text-slate-500 text-sm font-semibold">Code Quality:</span>
                                            <span className="font-bold text-slate-900 text-lg">{project.evaluation.marks.codeQuality}/20</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-8">
                                            <span className="text-slate-500 text-sm font-semibold">Logic:</span>
                                            <span className="font-bold text-slate-900 text-lg">{project.evaluation.marks.logic}/20</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-8">
                                            <span className="text-slate-500 text-sm font-semibold">Architecture:</span>
                                            <span className="font-bold text-slate-900 text-lg">{project.evaluation.marks.architecture}/15</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-8">
                                            <span className="text-slate-500 text-sm font-semibold">Viva:</span>
                                            <span className="font-bold text-slate-900 text-lg">{project.evaluation.marks.viva}/25</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-8">
                                            <span className="text-slate-500 text-sm font-semibold">Innovation:</span>
                                            <span className="font-bold text-slate-900 text-lg">{project.evaluation.marks.innovation}/20</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Benchmark */}
                                {benchmarks && (
                                    <div className="pt-6 border-t border-slate-200">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <TrendingUp className="text-primary" size={20} /> Performance Benchmark
                                        </h3>
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={[
                                                    { name: 'Your Score', score: project.evaluation.total },
                                                    { name: 'Class Average', score: benchmarks.average }
                                                ]}>
                                                    <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '12px', fontWeight: 600 }} />
                                                    <YAxis stroke="#64748b" style={{ fontSize: '12px', fontWeight: 600 }} />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: '#ffffff',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '12px',
                                                            color: '#0f172a',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                        }}
                                                    />
                                                    <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                                                        <Cell fill="#2563eb" />
                                                        <Cell fill="#64748b" />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <Card hover={false} className="slide-up border-t-4 border-t-amber-500">
                                <div className="text-center py-6">
                                    <Clock className="mx-auto mb-4 text-amber-500" size={48} />
                                    <h3 className="text-xl font-bold mb-2">Pending Evaluation</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto font-medium text-sm">Your mentor will review your project and conduct the viva session soon. You'll be notified once the evaluation is complete.</p>
                                </div>
                                <div className="border-t border-slate-100 pt-6 mt-2">
                                    <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                        <Upload size={16} className="text-blue-500" /> Insert PDF Synopsis / Report for AI Viva
                                    </h4>
                                    <p className="text-slate-400 text-xs mb-4">
                                        Upload your project synopsis or report PDF. The AI viva examiner will extract key details and generate questions directly from your template.
                                    </p>
                                    {project.pdfText ? (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex justify-between items-center">
                                            <div>
                                                <div className="text-emerald-800 font-bold text-xs">✓ PDF Synopsis Attached</div>
                                                <div className="text-emerald-600 text-[10px]">{project.pdfText.length} characters of synopsis context active.</div>
                                            </div>
                                            <div>
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    onChange={(e) => handleUpdatePdf(project.id, e)}
                                                    className="hidden"
                                                    id={`pdf-update-${project.id}`}
                                                    disabled={pdfParsing}
                                                />
                                                <label
                                                    htmlFor={`pdf-update-${project.id}`}
                                                    className="text-xs bg-white text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                                                >
                                                    {pdfParsing ? 'Parsing...' : 'Replace PDF'}
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center">
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={(e) => handleUpdatePdf(project.id, e)}
                                                className="hidden"
                                                id={`pdf-update-${project.id}`}
                                                disabled={pdfParsing}
                                            />
                                            <label
                                                htmlFor={`pdf-update-${project.id}`}
                                                className={`mx-auto inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm ${
                                                    pdfParsing ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                            >
                                                <Upload size={14} />
                                                {pdfParsing ? 'Parsing PDF...' : 'Upload PDF Synopsis'}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* New Advanced Analytics Section */}
                    {project.evaluation && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                            <SkillRadarChart evaluation={project.evaluation} />
                            <PerformanceComparison
                                yourScore={project.evaluation.total}
                                classAverage={benchmarks?.average || 70}
                            />
                            <GrowthTimeline project={project} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
