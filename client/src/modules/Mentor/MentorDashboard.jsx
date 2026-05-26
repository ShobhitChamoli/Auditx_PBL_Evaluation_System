import React, { useState, useEffect } from 'react';
import axios from '../../config/axiosConfig';
import { Card, Button, Input, Select, Badge, LoadingSpinner, StatCard, Modal } from '../../components/UI';
import { Search, Github, MessageSquare, CheckCircle, Users, Sparkles, Award, TrendingUp, Edit2, Save, X, Layout, Filter, Play, Download, FileText, Table, Settings, Clock, Calendar, Plus, Send, AlertTriangle, Lightbulb } from 'lucide-react';
import BatchPerformanceHeatmap from '../Analytics/BatchPerformanceHeatmap';
import EvaluationProgressTracker from '../Analytics/EvaluationProgressTracker';
import * as XLSX from 'xlsx';
// import { generateReport } from '../../utils/generateReport'; // Disabled in favor of modal
import VivaSession from './VivaSession';

const MentorDashboard = () => {
    const [projects, setProjects] = useState([]);
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
    const [selectedProject, setSelectedProject] = useState(null);
    const [vivaMode, setVivaMode] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [config, setConfig] = useState({ compactMode: false, showAnimations: true }); // Toggle full screen viva mode
    const [marks, setMarks] = useState({ codeQuality: 0, logic: 0, architecture: 0, viva: 0, innovation: 0 });
    const [isEditing, setIsEditing] = useState(false);

    // Stats state
    const [stats, setStats] = useState({ total: 0, evaluated: 0, pending: 0 });

    // New Session State
    const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false); // New Report Modal State
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false); // New Notification Modal State
    const [reportTab, setReportTab] = useState('completed'); // 'completed' | 'pending'
    const [newSession, setNewSession] = useState({ title: '', date: '', time: '', place: '', type: 'Viva', studentCount: '' }); // Added new fields
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [notifications, setNotifications] = useState([]); // Notifications State

    useEffect(() => {
        fetchProjects();
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(res.data);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
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

    // Filter projects and update stats when projects, search, or activeTab changes
    useEffect(() => {
        if (!projects || projects.length === 0) {
            setFilteredProjects([]);
            setStats({ total: 0, evaluated: 0, pending: 0 });
            return;
        }

        const total = projects.length;
        const evaluated = projects.filter(p => p.evaluation).length;
        const pending = total - evaluated;
        setStats({ total, evaluated, pending });

        let filtered = projects;

        // Filter by tab
        if (activeTab === 'pending') {
            filtered = filtered.filter(p => !p.evaluation);
        } else { // activeTab === 'completed'
            filtered = filtered.filter(p => p.evaluation);
        }

        // Filter by search
        if (search) {
            const query = search.toLowerCase();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(query) ||
                p.teamName.toLowerCase().includes(query) ||
                p.domain.toLowerCase().includes(query)
            );
        }

        setFilteredProjects(filtered);
    }, [projects, search, activeTab]);

    const fetchProjects = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
            setProjects(data);
            // Stats are now calculated in the useEffect above
        } catch (error) {
            console.error('Failed to fetch projects');
        }
    };

    const handleSelectProject = (project) => {
        setSelectedProject(project);
        // Pre-fill marks if already evaluated
        if (project.evaluation) {
            setMarks(project.evaluation.marks);
            setIsEditing(false); // View mode by default for completed
        } else {
            setMarks({ codeQuality: 0, logic: 0, architecture: 0, viva: 0, innovation: 0 });
            setIsEditing(true); // Edit mode for new evaluations
        }
    };

    const handleVivaComplete = () => {
        setVivaMode(false);
        fetchProjects(); // Refresh data
        setSelectedProject(null); // Clear selection
    };

    const handleSubmitEval = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/evaluations', { projectId: selectedProject.id, marks, feedback: 'Evaluated by mentor' }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Evaluation Saved Successfully! ✅');

            // Update local state without refetching everything
            const updatedProjects = projects.map(p => {
                if (p.id === selectedProject.id) {
                    return { ...p, evaluation: { ...p.evaluation, marks, total: Object.values(marks).reduce((a, b) => a + Number(b), 0) } };
                }
                return p;
            });
            setProjects(updatedProjects);

            // If it was a pending project, it moves to completed, so clear selection or switch tab
            if (activeTab === 'pending') {
                setSelectedProject(null);
            } else {
                setIsEditing(false);
            }

            fetchProjects(); // Sync to be sure
        } catch (error) {
            alert('Failed to submit evaluation');
        }
    };

    const handleExport = () => {
        if (!filteredProjects || filteredProjects.length === 0) {
            alert('No projects to export.');
            return;
        }

        const dataToExport = filteredProjects.map(p => ({
            'Team Name': p.teamName,
            'Project Title': p.title,
            'Domain': p.domain,
            'Tech Stack': p.techStack,
            'Repo Link': p.repoLink,
            'Evaluation Status': p.evaluation ? 'Completed' : 'Pending',
            'Viva Marks': p.evaluation ? p.evaluation.marks.viva : 'N/A',
            'Code Quality Marks': p.evaluation ? p.evaluation.marks.codeQuality : 'N/A',
            'Logic Marks': p.evaluation ? p.evaluation.marks.logic : 'N/A',
            'Architecture Marks': p.evaluation ? p.evaluation.marks.architecture : 'N/A',
            'Innovation Marks': p.evaluation ? p.evaluation.marks.innovation : 'N/A',
            'Total Marks': p.evaluation ? Object.values(p.evaluation.marks).reduce((a, b) => a + Number(b), 0) : 'N/A',
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Projects");
        XLSX.writeFile(wb, "MentorDashboard_Projects.xlsx");
    };

    const handleSendReminder = async () => {
        const pendingProjects = projects.filter(p => !p.evaluation);
        if (pendingProjects.length === 0) {
            alert("No pending projects to remind.");
            return;
        }

        if (!confirm(`Send reminder to ${pendingProjects.length} pending teams?`)) return;

        try {
            const token = localStorage.getItem('token');
            const promises = pendingProjects.map(p =>
                axios.post('/api/notifications', {
                    userId: p.studentId, // Ensure your project object has studentId
                    title: "Action Required: Viva Pending",
                    message: `Hello ${p.leaderName}, your project "${p.title}" is pending evaluation. Please be ready.`,
                    type: "warning"
                }, { headers: { Authorization: `Bearer ${token}` } })
            );
            await Promise.all(promises);
            alert("Reminders sent successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to send reminders");
        }
    };

    const handleScheduleSession = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/evaluations/sessions', newSession, { headers: { Authorization: `Bearer ${token}` } });
            alert('Session Scheduled Successfully! Students have been notified.');
            setIsSessionModalOpen(false);
            setNewSession({ title: '', date: '', time: '', place: '', type: 'Viva', studentCount: '' });
        } catch (error) {
            alert('Failed to schedule session');
        }
    };

    if (vivaMode && selectedProject) {
        return <VivaSession project={selectedProject} onComplete={handleVivaComplete} onCancel={() => setVivaMode(false)} />;
    }

    return (
        <div className={`max-w-7xl mx-auto px-4 py-8 ${config.showAnimations ? 'fade-in' : ''}`}>
            {/* Header */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 slide-up">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Mentor Dashboard</h1>
                    <p className="text-slate-500 font-medium">Manage evaluations and conduct AI-assisted vivas.</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2">
                        <FileText size={18} /> Official Report
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
                        <Download size={18} /> Export Excel
                    </Button>
                    <Button variant="outline" onClick={() => setIsNotificationModalOpen(true)} className="text-sm relative">
                        <Lightbulb size={16} className={notifications.some(n => !n.read) ? "text-amber-500 fill-amber-500" : ""} />
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

            {/* Evaluation Control Center (New) */}
            <Card className="slide-up flex flex-col bg-slate-50/50 border-slate-200 mb-10">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                        <TrendingUp className="text-primary" size={20} /> Evaluation Control Center
                    </h2>
                    <Button size="sm" variant="outline" onClick={() => setIsSettingsModalOpen(true)} className="h-8 px-3 text-xs bg-white hover:bg-slate-50 flex items-center gap-1 shadow-sm">
                        <Settings size={14} /> Config
                    </Button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Completion Rate</div>
                        <div className="flex items-end justify-between">
                            <span className="text-3xl font-extrabold text-emerald-600">
                                {stats.total ? Math.round((stats.evaluated / stats.total) * 100) : 0}%
                            </span>
                            {stats.total > 0 && <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Active</div>}
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.total ? (stats.evaluated / stats.total) * 100 : 0}%` }}></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <div className="text-2xl font-bold text-slate-800">{stats.evaluated}</div>
                            <div className="text-xs text-slate-500 font-medium">Completed</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                            <div className="text-xs text-slate-500 font-medium">Pending</div>
                        </div>
                    </div>
                </div>

                {/* Alerts Section */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">System Alerts</h4>
                    <div className="space-y-3">
                        {stats.pending > 0 ? (
                            <div
                                onClick={() => setIsSummaryModalOpen(true)}
                                className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group"
                            >
                                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-0.5 group-hover:bg-amber-100 transition-colors">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-700 group-hover:text-amber-700 transition-colors">{stats.pending} Assignments Pending</div>
                                    <div className="text-xs text-slate-500">Students require evaluation. Click to view.</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-sm p-2">
                                <CheckCircle size={16} /> All systems operational.
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button onClick={() => setIsSessionModalOpen(true)} className="justify-center text-xs h-10 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"><Plus size={14} className="mr-2" /> Create Session</Button>
                    <Button onClick={() => setIsSummaryModalOpen(true)} variant="outline" className="justify-center text-xs h-10 hover:bg-slate-50"><Table size={14} className="mr-2" /> View Summary</Button>
                    <Button onClick={handleSendReminder} variant="outline" className="justify-center text-xs h-10 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"><Send size={14} className="mr-2" /> Send Reminder</Button>
                    <Button variant="outline" onClick={handleExport} className="justify-center text-xs h-10"><Download size={14} className="mr-2" /> Export Report</Button>
                </div>
            </Card>

            {/* Evaluation Summary Modal */}
            <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="Evaluation Summary" maxWidth="max-w-5xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 font-bold tracking-wider">Student Name</th>
                                <th className="px-6 py-3 font-bold tracking-wider">Project Title</th>
                                <th className="px-6 py-3 font-bold tracking-wider">Tech Stack</th>
                                <th className="px-6 py-3 font-bold tracking-wider text-center">Marks</th>
                                <th className="px-6 py-3 font-bold tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {projects.map((p, index) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700">
                                        {p.leaderName}
                                        <div className="text-xs text-slate-400 font-normal">Team Leader</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={p.title}>
                                        {p.title}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {p.techStack ? p.techStack.split(',').map((tech, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600 border-slate-200 whitespace-nowrap">
                                                    {tech.trim()}
                                                </Badge>
                                            )) : (
                                                <span className="text-slate-400 text-sm">N/A</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-800">
                                        {p.evaluation ? (
                                            <span>
                                                {Object.values(p.evaluation.marks).reduce((a, b) => a + Number(b), 0)}
                                                <span className="text-xs text-slate-400 font-normal">/100</span>
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {p.evaluation ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Completed
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Pending
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {projects.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400 italic">
                                        No projects assigned yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Modal>

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 slide-up bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => { setActiveTab('pending'); setSelectedProject(null); }}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Pending ({stats.pending})
                    </button>
                    <button
                        onClick={() => { setActiveTab('completed'); setSelectedProject(null); }}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Completed ({stats.evaluated})
                    </button>
                </div>

                <div className="relative w-full md:w-96">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <Search size={18} />
                    </div>
                    <input
                        className="glass-input pl-10"
                        placeholder="Search projects by title, team or domain..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Project List */}
                <div className={`lg:col-span-1 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar ${config.compactMode ? 'space-y-2' : 'space-y-4'}`}>
                    {filteredProjects.length === 0 ? (
                        <Card className="text-center py-12 border-dashed border-slate-200 bg-slate-50/50">
                            <p className="text-slate-400 font-medium">No {activeTab} projects found</p>
                        </Card>
                    ) : (
                        filteredProjects.map(p => (
                            <Card
                                key={p.id}
                                className={`cursor-pointer transition-all duration-200 group ${selectedProject?.id === p.id ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md' : 'hover:border-blue-300'}`}
                                onClick={() => handleSelectProject(p)}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className={`font-bold text-lg group-hover:text-blue-600 transition-colors ${selectedProject?.id === p.id ? 'text-blue-700' : 'text-slate-800'}`}>{p.teamName}</h3>
                                    {p.evaluation && <Badge variant="success" className="gap-1"><CheckCircle size={10} /> Done</Badge>}
                                </div>
                                <p className="text-slate-500 text-sm mb-4 line-clamp-2 font-medium">{p.title}</p>
                                <div className="flex gap-2 flex-wrap">
                                    <Badge variant="info">{p.domain}</Badge>
                                    <Badge variant="primary">{p.techStack?.split(',')[0]}</Badge>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Details & Evaluation Panel */}
                <div className="lg:col-span-2">
                    {selectedProject ? (
                        <div className='space-y-6 fade-in pb-12'>
                            {/* Project Details */}
                            <Card hover={false} className="border-t-4 border-t-blue-500">
                                <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
                                    <div>
                                        <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedProject.title}</h2>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                                            <span className="flex items-center gap-1.5"><Users size={16} className="text-blue-500" /> {selectedProject.teamName}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span>{selectedProject.domain}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="text-sm shadow-sm" onClick={() => window.open(selectedProject.repoLink, '_blank')}>
                                            <Github size={16} className="mr-2" /> Repository
                                        </Button>
                                        <Button variant="primary" className="text-sm shadow-sm flex items-center gap-2" onClick={() => setVivaMode(true)}>
                                            <Sparkles size={16} className="text-amber-300 fill-amber-300" /> Start AI Viva
                                        </Button>
                                        <button
                                            onClick={() => setSelectedProject(null)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Close Details"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-slate-600 mb-6 leading-relaxed bg-slate-50 p-5 rounded-xl border border-slate-100 font-medium">{selectedProject.description}</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Stack:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedProject.techStack.split(',').map((tech, i) => (
                                            <Badge key={i} variant="primary" className="text-sm px-3 py-1">{tech.trim()}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </Card>



                            {/* Evaluation Form (Visible if editing manually or already done) */}
                            <Card hover={false} className={`border-t-4 ${isEditing ? 'border-t-emerald-500 ring-4 ring-emerald-500/5' : 'border-t-slate-300'}`}>
                                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                                    <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                        <Award className="text-emerald-600" size={24} /> Scoring Rubric
                                    </h3>
                                    {selectedProject.evaluation && !isEditing && (
                                        <Button onClick={() => setIsEditing(true)} variant="outline" className="flex items-center gap-2 hover:border-blue-400 hover:text-blue-600">
                                            <Edit2 size={16} /> Update Scores
                                        </Button>
                                    )}
                                </div>

                                <form onSubmit={handleSubmitEval} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <Input label="Viva Performance (25)" type="number" min="0" max="25" disabled={!isEditing} value={marks.viva} onChange={(e) => setMarks({ ...marks, viva: Number(e.target.value) })} required />
                                        <Input label="Code Quality (20)" type="number" min="0" max="20" disabled={!isEditing} value={marks.codeQuality} onChange={(e) => setMarks({ ...marks, codeQuality: Number(e.target.value) })} required />
                                        <Input label="Logic & Implementation (20)" type="number" min="0" max="20" disabled={!isEditing} value={marks.logic} onChange={(e) => setMarks({ ...marks, logic: Number(e.target.value) })} required />
                                        <Input label="Architecture & Design (15)" type="number" min="0" max="15" disabled={!isEditing} value={marks.architecture} onChange={(e) => setMarks({ ...marks, architecture: Number(e.target.value) })} required />
                                        <Input label="Innovation & Creativity (20)" type="number" min="0" max="20" disabled={!isEditing} value={marks.innovation} onChange={(e) => setMarks({ ...marks, innovation: Number(e.target.value) })} required />
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">Total Grade</span>
                                            <span className="text-5xl font-extrabold text-slate-800 tracking-tight">
                                                {Object.values(marks).reduce((a, b) => a + Number(b), 0)}<span className="text-2xl text-slate-400 font-bold">/100</span>
                                            </span>
                                        </div>
                                        {isEditing && (
                                            <div className="flex gap-4 w-full md:w-auto">
                                                {selectedProject.evaluation && (
                                                    <Button type="button" variant="ghost" onClick={() => { setIsEditing(false); setMarks(selectedProject.evaluation.marks); }} className="flex-1 md:flex-initial">
                                                        Cancel
                                                    </Button>
                                                )}
                                                <Button type="submit" className="flex items-center gap-2 px-8 py-3 text-lg shadow-lg shadow-blue-200 hover:shadow-blue-300 flex-1 md:flex-initial justify-center">
                                                    <Save size={20} />
                                                    Submit Evaluation
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </form>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-[75vh] flex items-center justify-center bg-slate-50/30 rounded-3xl border border-dashed border-slate-200 mx-4">
                            <div className="text-center max-w-md">
                                <div className="bg-white p-6 rounded-full shadow-lg shadow-blue-100 inline-flex mb-6 animate-bounce-slow">
                                    <Sparkles className="text-blue-500" size={48} />
                                </div>
                                <h3 className="text-2xl font-bold mb-3 text-slate-800">Select a Project</h3>
                                <p className="text-slate-500 leading-relaxed">Choose a project from the sidebar to view details, conduct AI vivas, and submit evaluations.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Schedule Session Modal */}
            <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title="Schedule Viva Session">
                <form onSubmit={handleScheduleSession} className="space-y-4">
                    <Input
                        label="Session Title"
                        placeholder="e.g. Final Viva"
                        value={newSession.title}
                        onChange={e => setNewSession({ ...newSession, title: e.target.value })}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Date"
                            type="date"
                            value={newSession.date}
                            onChange={e => setNewSession({ ...newSession, date: e.target.value })}
                            required
                        />
                        <Input
                            label="Time"
                            type="time"
                            value={newSession.time}
                            onChange={e => setNewSession({ ...newSession, time: e.target.value })}
                            required
                        />
                    </div>
                    <Input
                        label="Place / Venue"
                        placeholder="e.g. Room 303 or Google Meet Link"
                        value={newSession.place}
                        onChange={e => setNewSession({ ...newSession, place: e.target.value })}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Number of Students"
                            type="number"
                            placeholder="e.g. 5"
                            min="1"
                            value={newSession.studentCount}
                            onChange={e => setNewSession({ ...newSession, studentCount: e.target.value })}
                        />
                        <Select
                            label="Type"
                            value={newSession.type}
                            onChange={e => setNewSession({ ...newSession, type: e.target.value })}
                        >
                            <option value="Viva">Viva</option>
                            <option value="Presentation">Presentation</option>
                        </Select>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-4">
                        This session will be visible to pending students. If you specify a number, they will be automatically invited.
                    </div>
                    <Button type="submit" className="w-full">Schedule Session</Button>
                </form>
            </Modal>

            {/* Config/Settings Modal */}
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Dashboard Configuration">
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                            <h4 className="font-bold text-slate-800">Compact View</h4>
                            <p className="text-sm text-slate-500">Reduce spacing in project lists</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.compactMode}
                                onChange={(e) => setConfig({ ...config, compactMode: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                            <h4 className="font-bold text-slate-800">Animations</h4>
                            <p className="text-sm text-slate-500">Enable UI transitions and effects</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.showAnimations}
                                onChange={(e) => setConfig({ ...config, showAnimations: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setIsSettingsModalOpen(false)}>Done</Button>
                    </div>
                </div>
            </Modal>

            {/* Official Report Modal */}
            <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Official Evaluation Report" maxWidth="max-w-5xl">
                <div className="p-4">
                    <div className="flex justify-between items-center mb-6 print:hidden">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setReportTab('completed')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Completed Evaluations
                            </button>
                            <button
                                onClick={() => setReportTab('pending')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportTab === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Pending Vivas
                            </button>
                        </div>
                        <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-2">
                            Print Report
                        </Button>
                    </div>

                    {/* Report Content */}
                    <div className="overflow-x-auto border rounded-xl border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-bold">Project / Team</th>
                                    <th className="px-6 py-3 font-bold">Domain</th>
                                    {reportTab === 'completed' ? (
                                        <>
                                            <th className="px-6 py-3 font-bold text-center">Scores (V/C/L/A/I)</th>
                                            <th className="px-6 py-3 font-bold text-center">Total</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-3 font-bold">Assigned Date</th>
                                            <th className="px-6 py-3 font-bold">Assigned Time</th>
                                        </>
                                    )}
                                    <th className="px-6 py-3 font-bold text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {projects
                                    .filter(p => reportTab === 'completed' ? p.evaluation : !p.evaluation)
                                    .map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{p.title}</div>
                                                <div className="text-xs text-slate-500">{p.teamName}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{p.domain}</td>
                                            {reportTab === 'completed' ? (
                                                <>
                                                    <td className="px-6 py-4 text-center text-xs text-slate-500 font-mono">
                                                        {p.evaluation?.marks?.viva}/{p.evaluation?.marks?.codeQuality}/{p.evaluation?.marks?.logic}/{p.evaluation?.marks?.architecture}/{p.evaluation?.marks?.innovation}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-emerald-600 text-lg">
                                                        {p.evaluation?.total}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 text-slate-700 font-medium">
                                                        {p.scheduledVivaDate ? new Date(p.scheduledVivaDate).toLocaleDateString() : <span className="text-slate-400 italic">Not Scheduled</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-700">
                                                        {p.scheduledVivaTime || '-'} {p.scheduledVivaPlace ? `(${p.scheduledVivaPlace})` : ''}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-6 py-4 text-right">
                                                <Badge variant={reportTab === 'completed' ? 'success' : 'warning'}>
                                                    {reportTab === 'completed' ? 'Evaluated' : 'Pending'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                {projects.filter(p => reportTab === 'completed' ? p.evaluation : !p.evaluation).length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic">
                                            No {reportTab} projects found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

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
                                        {n.title}
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
        </div >
    );
};

export default MentorDashboard;
