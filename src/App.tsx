import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Calendar,
  Flag,
  Clock,
  AlertCircle,
  Loader2,
  GraduationCap,
  ListTodo,
  CheckSquare,
  X,
  Search,
} from 'lucide-react';
import { supabase, type Task, type TaskInsert } from '@/lib/supabase';

type Priority = 'low' | 'medium' | 'high';
type StatusFilter = 'all' | 'pending' | 'completed';
type PriorityFilter = 'all' | Priority;

const priorityConfig: Record<
  Priority,
  { label: string; badge: string; dot: string; icon: string }
> = {
  low: {
    label: 'Low',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: 'text-emerald-500',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    icon: 'text-amber-500',
  },
  high: {
    label: 'High',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    icon: 'text-rose-500',
  },
};

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  if (diffMs < 0) return `Overdue · ${formatted}`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days · ${formatted}`;
  return formatted;
}

function isOverdue(dateStr: string | null, completed: boolean): boolean {
  if (!dateStr || completed) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function toDatetimeLocal(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  // form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError('Could not load your tasks. Please try again.');
    } else {
      setTasks(data as Task[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDeadline('');
    setPriority('medium');
    setFormError(null);
    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (task: Task) => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setDeadline(toDatetimeLocal(task.deadline));
    setPriority(task.priority);
    setEditingId(task.id);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Task title is required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload: TaskInsert = {
      title: title.trim(),
      description: description.trim() || null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      priority,
    };

    let result;
    if (editingId) {
      result = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('tasks')
        .insert(payload)
        .select()
        .single();
    }

    setSubmitting(false);

    if (result.error) {
      setFormError('Could not save the task. Please try again.');
      return;
    }

    if (editingId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingId ? (result.data as Task) : t))
      );
    } else {
      setTasks((prev) => [result.data as Task, ...prev]);
    }

    closeForm();
  };

  const toggleComplete = async (task: Task) => {
    setTogglingId(task.id);
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    setTogglingId(null);

    if (error) {
      setError('Could not update the task status.');
      return;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) {
      setError('Could not delete the task.');
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const matchesSearch = (t: Task) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false)
    );
  };

  const matchesPriority = (t: Task) =>
    priorityFilter === 'all' || t.priority === priorityFilter;

  const filteredTasks = tasks.filter(
    (t) => matchesSearch(t) && matchesPriority(t)
  );

  const pendingTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const overdueCount = tasks
    .filter((t) => !t.completed)
    .filter((t) => isOverdue(t.deadline, t.completed)).length;

  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || priorityFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  const showPending = statusFilter === 'all' || statusFilter === 'pending';
  const showCompleted = statusFilter === 'all' || statusFilter === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md bg-white/90">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                StudyTrack
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Your student task manager
              </p>
            </div>
          </div>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard
            icon={<ListTodo className="w-5 h-5" />}
            label="Pending"
            value={pendingTasks.length}
            accent="text-blue-600 bg-blue-50"
          />
          <StatCard
            icon={<CheckSquare className="w-5 h-5" />}
            label="Completed"
            value={completedTasks.length}
            accent="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Overdue"
            value={overdueCount}
            accent="text-rose-600 bg-rose-50"
          />
        </div>

        {/* Search & Filters */}
        {tasks.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks by title or description..."
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <FilterPill
                label="All"
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              />
              <FilterPill
                label="Pending"
                active={statusFilter === 'pending'}
                onClick={() => setStatusFilter('pending')}
              />
              <FilterPill
                label="Completed"
                active={statusFilter === 'completed'}
                onClick={() => setStatusFilter('completed')}
              />

              <div className="w-px h-5 bg-slate-200 mx-1" />

              <FilterPill
                label="All Priorities"
                active={priorityFilter === 'all'}
                onClick={() => setPriorityFilter('all')}
              />
              {(Object.keys(priorityConfig) as Priority[]).map((p) => (
                <FilterPill
                  key={p}
                  label={priorityConfig[p].label}
                  active={priorityFilter === p}
                  onClick={() => setPriorityFilter(p)}
                  dotClass={priorityConfig[p].dot}
                />
              ))}

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3 fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading your tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState onAdd={openAddForm} />
        ) : filteredTasks.length === 0 && hasFilters ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              No matching tasks
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Try adjusting your search or filters.
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Section */}
            {showPending && (
              <section className={!showCompleted ? 'lg:col-span-2' : ''}>
                <SectionHeader
                  icon={<Clock className="w-5 h-5" />}
                  title="Pending"
                  count={pendingTasks.length}
                  accent="text-blue-600"
                />
                <div className="space-y-3">
                  {pendingTasks.length === 0 ? (
                    <EmptySection message="No pending tasks. You're all caught up!" />
                  ) : (
                    pendingTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleComplete}
                        onDelete={deleteTask}
                        onEdit={openEditForm}
                        toggling={togglingId === task.id}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Completed Section */}
            {showCompleted && (
              <section className={!showPending ? 'lg:col-span-2' : ''}>
                <SectionHeader
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  title="Completed"
                  count={completedTasks.length}
                  accent="text-emerald-600"
                />
                <div className="space-y-3">
                  {completedTasks.length === 0 ? (
                    <EmptySection message="Completed tasks will show up here." />
                  ) : (
                    completedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleComplete}
                        onDelete={deleteTask}
                        onEdit={openEditForm}
                        toggling={togglingId === task.id}
                      />
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Task' : 'New Task'}
              </h2>
              <button
                onClick={closeForm}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Finish chemistry lab report"
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details (optional)"
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(priorityConfig) as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                        priority === p
                          ? `${priorityConfig[p].badge} ring-2 ring-offset-1 ring-current`
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      {priorityConfig[p].label}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2 fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <p className="text-sm text-rose-700">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg transition-all shadow-md shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${accent}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`${accent}`}>{icon}</div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
      {message}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  dotClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dotClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {dotClass && (
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      )}
      {label}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 sm:py-24">
      <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
        <ListTodo className="w-10 h-10 text-blue-500" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1.5">
        No tasks yet
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
        Stay on top of your assignments, projects, and study sessions. Create
        your first task to get started.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-5 py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20"
      >
        <Plus className="w-4 h-4" />
        Create Your First Task
      </button>
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  onDelete,
  onEdit,
  toggling,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  toggling: boolean;
}) {
  const overdue = isOverdue(task.deadline, task.completed);
  const pc = priorityConfig[task.priority];

  return (
    <div
      className={`group bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        task.completed
          ? 'border-slate-200 opacity-75'
          : overdue
            ? 'border-rose-200'
            : 'border-slate-200'
      }`}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          disabled={toggling}
          className={`flex-shrink-0 mt-0.5 transition-all active:scale-90 ${
            task.completed
              ? 'text-emerald-600'
              : 'text-slate-300 hover:text-emerald-500'
          }`}
        >
          {toggling ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : task.completed ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-sm font-semibold leading-snug ${
                task.completed ? 'text-slate-400 line-through' : 'text-slate-900'
              }`}
            >
              {task.title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="flex-shrink-0 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-0.5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {task.description && (
            <p
              className={`text-xs mt-1 line-clamp-2 ${
                task.completed ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${pc.badge}`}
            >
              <Flag className="w-3 h-3" />
              {pc.label}
            </span>

            {task.deadline && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                  overdue
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDeadline(task.deadline)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
