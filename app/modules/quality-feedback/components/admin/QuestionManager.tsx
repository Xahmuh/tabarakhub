import React, { useState, useEffect } from 'react';
import { feedbackService } from '../../services/feedbackService';
import { Question, FeedbackSection } from '../../types/feedback.types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  GripVertical, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const QuestionManager: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Question>>({});
  const [isSaving, setIsSaving] = useState(false);

  const sections: FeedbackSection[] = ['Operations', 'Purchasing', 'HR', 'IT', 'Overall'];

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await feedbackService.fetchAllQuestions();
      setQuestions(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditForm(q);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editForm.text_en || !editForm.text_ar || !editForm.section || !editForm.field_key) {
      setError('All fields are required');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        const newQ = await feedbackService.createQuestion(editForm as Omit<Question, 'id'>);
        setQuestions([...questions, newQ]);
      } else if (editingId) {
        const updated = await feedbackService.updateQuestion(editingId, editForm);
        setQuestions(questions.map(q => q.id === editingId ? updated : q));
      }
      setEditingId(null);
      setEditForm({});
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (q: Question) => {
    try {
      const updated = await feedbackService.updateQuestion(q.id, { is_active: !q.is_active });
      setQuestions(questions.map(item => item.id === q.id ? updated : item));
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm('Are you sure? This will not delete historical data but will remove the question from the form.')) return;
    
    try {
      await feedbackService.deleteQuestion(id);
      setQuestions(questions.filter(q => q.id !== id));
    } catch (err) {
      setError('Failed to delete question');
    }
  };

  const addNew = () => {
    setEditingId('new');
    setEditForm({
      section: 'Operations',
      text_en: '',
      text_ar: '',
      field_key: '',
      order_index: questions.length,
      is_active: true
    });
  };

  const moveQuestion = async (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === id);
    if (index < 0) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newQuestions = [...questions];
    const [moved] = newQuestions.splice(index, 1);
    newQuestions.splice(newIndex, 0, moved);

    // Optimistic update
    setQuestions(newQuestions);

    // Save all orders (simple approach)
    try {
      await Promise.all(newQuestions.map((q, i) => 
        feedbackService.updateQuestion(q.id, { order_index: i })
      ));
    } catch (err) {
      setError('Failed to save sort order');
      fetchQuestions(); // Revert
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
        <p className="text-slate-500 font-medium">Loading Questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Question Management</h2>
          <p className="text-slate-500 font-medium">Configure the fields and sections of the feedback form</p>
        </div>
        <button
          onClick={addNew}
          disabled={!!editingId}
          className="px-4 py-2 bg-brand text-white font-bold rounded-xl hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg shadow-brand/20"
        >
          <Plus className="w-5 h-5" />
          <span>Add Question</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-bold text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 w-12"></th>
              <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Section</th>
              <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Field Key (DB)</th>
              <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Question Text (EN/AR)</th>
              <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {questions.map((q, idx) => (
              <tr key={q.id} className={`hover:bg-slate-50/50 transition-colors ${editingId === q.id ? 'bg-brand/5' : ''}`}>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveQuestion(q.id, 'up')} disabled={idx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-0"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveQuestion(q.id, 'down')} disabled={idx === questions.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-0"><ChevronDown className="w-4 h-4" /></button>
                  </div>
                </td>
                <td className="p-4">
                  {editingId === q.id ? (
                    <select
                      value={editForm.section}
                      onChange={e => setEditForm({...editForm, section: e.target.value as FeedbackSection})}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                    >
                      {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">{q.section}</span>
                  )}
                </td>
                <td className="p-4">
                  {editingId === q.id ? (
                    <input
                      type="text"
                      value={editForm.field_key}
                      onChange={e => setEditForm({...editForm, field_key: e.target.value})}
                      placeholder="e.g., op_1"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  ) : (
                    <code className="text-xs font-mono text-brand font-bold bg-brand/5 px-2 py-1 rounded">{q.field_key}</code>
                  )}
                </td>
                <td className="p-4 space-y-1">
                  {editingId === q.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.text_en}
                        onChange={e => setEditForm({...editForm, text_en: e.target.value})}
                        placeholder="English text"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                      />
                      <input
                        type="text"
                        value={editForm.text_ar}
                        onChange={e => setEditForm({...editForm, text_ar: e.target.value})}
                        placeholder="Arabic text"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand text-right"
                      />
                    </div>
                  ) : (
                    <div className="max-w-md">
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{q.text_en}</p>
                      <p className="text-xs text-slate-500 font-arabic line-clamp-1 text-right" dir="rtl">{q.text_ar}</p>
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => toggleStatus(q)}
                    className={`flex items-center gap-1 text-xs font-bold ${q.is_active ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    {q.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{q.is_active ? 'Active' : 'Hidden'}</span>
                  </button>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {editingId === q.id ? (
                      <>
                        <button onClick={handleSave} disabled={isSaving} className="p-2 bg-brand text-white rounded-lg hover:bg-brand-600 transition-colors">
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                        <button onClick={cancelEdit} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(q)} className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteQuestion(q.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {editingId === 'new' && (
              <tr className="bg-brand/5">
                <td className="p-4"></td>
                <td className="p-4">
                  <select
                    value={editForm.section}
                    onChange={e => setEditForm({...editForm, section: e.target.value as FeedbackSection})}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                  >
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-4">
                  <input
                    type="text"
                    value={editForm.field_key}
                    onChange={e => setEditForm({...editForm, field_key: e.target.value})}
                    placeholder="e.g., hr_4"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                  />
                </td>
                <td className="p-4 space-y-2">
                  <input
                    type="text"
                    value={editForm.text_en}
                    onChange={e => setEditForm({...editForm, text_en: e.target.value})}
                    placeholder="English question text"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                  />
                  <input
                    type="text"
                    value={editForm.text_ar}
                    onChange={e => setEditForm({...editForm, text_ar: e.target.value})}
                    placeholder="النص العربي للسؤال"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand text-right"
                  />
                </td>
                <td className="p-4">
                  <span className="text-xs font-bold text-slate-400 italic">Draft</span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={handleSave} disabled={isSaving} className="p-2 bg-brand text-white rounded-lg hover:bg-brand-600 transition-colors">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    <button onClick={cancelEdit} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {questions.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400 font-medium italic">
                  No questions found. Click "Add Question" to create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
