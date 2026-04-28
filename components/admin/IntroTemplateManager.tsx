'use client';

import { useState, useEffect } from 'react';
import type { SignupIntroTemplate } from '@/types/signup-intro';
import Modal from '@/components/Modal';
import { interpolateTemplate } from '@/lib/template-interpolation';

type IntroTemplateManagerProps = {
  open: boolean;
  onClose: () => void;
  onTemplatesChanged: () => void;
};

type FormMode = 'list' | 'create' | 'edit';

type TemplateFormData = {
  name: string;
  content: string;
  contentEn: string;
  isFree: boolean;
};

const REQUIRED_PAID_VARIABLES = ['{{payment_currency}}', '{{payment_amount}}'];

export default function IntroTemplateManager({
  open,
  onClose,
  onTemplatesChanged,
}: IntroTemplateManagerProps) {
  const [templates, setTemplates] = useState<SignupIntroTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FormMode>('list');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    content: '',
    contentEn: '',
    isFree: false,
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch templates when modal opens
  useEffect(() => {
    if (!open) return;
    fetchTemplates();
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/intro-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch intro templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setFormData({
      name: '',
      content: '',
      contentEn: '',
      isFree: false,
    });
    setValidationErrors([]);
    setEditingTemplate(null);
  };

  const resetForm = () => {
    clearForm();
    setMode('list');
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Template name is required');
    }

    if (!formData.content.trim()) {
      errors.push('Chinese content is required');
    }

    if (!formData.contentEn.trim()) {
      errors.push('English content is required');
    }

    // If this is a paid template, check for required variables
    if (!formData.isFree) {
      const missingInContent = REQUIRED_PAID_VARIABLES.filter(
        variable => !formData.content.includes(variable)
      );
      const missingInContentEn = REQUIRED_PAID_VARIABLES.filter(
        variable => !formData.contentEn.includes(variable)
      );

      if (missingInContent.length > 0) {
        errors.push(`Chinese content must include: ${missingInContent.join(', ')}`);
      }

      if (missingInContentEn.length > 0) {
        errors.push(`English content must include: ${missingInContentEn.join(', ')}`);
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleCreate = () => {
    setMode('create');
    clearForm();
  };

  const handleEdit = (template: SignupIntroTemplate) => {
    setMode('edit');
    setEditingTemplate(template.name);
    setFormData({
      name: template.name,
      content: template.content,
      contentEn: template.contentEn,
      isFree: template.isFree,
    });
    setValidationErrors([]);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const url = mode === 'create'
        ? '/api/admin/intro-templates'
        : `/api/admin/intro-templates/${editingTemplate}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save template');
      }

      await fetchTemplates();
      onTemplatesChanged();
      resetForm();
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Failed to save template']);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/intro-templates/${name}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      await fetchTemplates();
      onTemplatesChanged();
      setDeleteConfirm(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    setDeleteConfirm(null);
    onClose();
  };

  // Sample interpolation for preview
  const sampleEvent = {
    event_title: '讀書會活動',
    event_title_en: 'Book Club Event',
    venue_name: '台北咖啡廳',
    venue_name_en: 'Taipei Cafe',
    venue_address: '台北市信義區信義路100號',
    payment_amount: '300',
    payment_currency: 'TWD',
    event_date_zh: '2026年5月15日',
    event_date_en: 'May 15, 2026',
  };

  const interpolatePreview = (content: string, locale: 'zh' | 'en'): string => {
    return interpolateTemplate(content, {
      event_title: locale === 'zh' ? sampleEvent.event_title : sampleEvent.event_title_en,
      venue_name: locale === 'zh' ? sampleEvent.venue_name : sampleEvent.venue_name_en,
      venue_address: sampleEvent.venue_address,
      payment_amount: sampleEvent.payment_amount,
      payment_currency: sampleEvent.payment_currency,
      event_date: locale === 'zh' ? sampleEvent.event_date_zh : sampleEvent.event_date_en,
    });
  };

  return (
    <Modal open={open} onClose={handleClose} title="Manage Signup Intro Templates">
      {loading ? (
        <div className="py-8 text-center text-white/60">Loading templates...</div>
      ) : mode === 'list' ? (
        <div>
          {/* List View */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center rounded-full bg-brand-pink px-5 py-2 font-semibold text-brand-navy transition hover:brightness-110"
            >
              + Create New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <p className="py-4 text-center text-white/60">No templates found. Create one to get started.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.name}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Type: {template.isFree ? 'Free Event' : 'Paid Event'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(template)}
                        className="rounded-lg bg-white/10 px-3 py-1 text-sm font-medium text-white hover:bg-white/15"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(template.name)}
                        className="rounded-lg bg-red-500/20 px-3 py-1 text-sm font-medium text-red-100 hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-brand-navy p-6">
                <h3 className="text-xl font-semibold text-white">Confirm Delete</h3>
                <p className="mt-4 text-white/70">
                  Are you sure you want to delete template <span className="font-semibold text-white">{deleteConfirm}</span>?
                  This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="rounded-full border border-white/15 px-5 py-2 font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={deleting}
                    className="rounded-full bg-red-500 px-5 py-2 font-semibold text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Create/Edit Form */}
          <div className="space-y-4">
            {validationErrors.length > 0 && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3">
                <p className="font-semibold text-red-100">Validation Errors:</p>
                <ul className="mt-2 list-inside list-disc text-sm text-red-100/80">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-white">
                Template Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={mode === 'edit'}
                className="mt-1 w-full rounded-2xl bg-black/20 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-brand-pink/40 disabled:opacity-60"
                placeholder="e.g., default_paid"
              />
              {mode === 'edit' && (
                <p className="mt-1 text-xs text-white/50">Template name cannot be changed</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFree}
                  onChange={(e) => setFormData({ ...formData, isFree: e.target.checked })}
                  className="h-5 w-5 rounded border-white/20 bg-black/20 text-brand-pink focus:ring-2 focus:ring-brand-pink/40"
                />
                <span className="text-sm font-semibold text-white">Free Event Template</span>
              </label>
              <p className="mt-1 text-xs text-white/50">
                Paid templates must include {'{{'} payment_currency {'}'} and {'{{'} payment_amount {'}'} variables
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Chinese Content */}
              <div>
                <label className="block text-sm font-semibold text-white">
                  Chinese Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  className="mt-1 w-full rounded-2xl bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none focus:ring-2 focus:ring-brand-pink/40"
                  placeholder="活動介紹內容..."
                />
                <p className="mt-1 text-xs text-white/50">
                  Available variables: {'{{'} event_title {'}}'}, {'{{'} venue_name {'}}'}, {'{{'} venue_address {'}}'}, {'{{'} payment_currency {'}}'}, {'{{'} payment_amount {'}}'}
                </p>
              </div>

              {/* English Content */}
              <div>
                <label className="block text-sm font-semibold text-white">
                  English Content
                </label>
                <textarea
                  value={formData.contentEn}
                  onChange={(e) => setFormData({ ...formData, contentEn: e.target.value })}
                  rows={8}
                  className="mt-1 w-full rounded-2xl bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none focus:ring-2 focus:ring-brand-pink/40"
                  placeholder="Event intro content..."
                />
              </div>
            </div>

            {/* Live Preview */}
            {formData.content && formData.contentEn && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-white">Live Preview (Sample Event)</h3>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-2">Chinese:</p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-white/80">
                      {interpolatePreview(formData.content, 'zh')}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-2">English:</p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-white/80">
                      {interpolatePreview(formData.contentEn, 'en')}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-full border border-white/15 px-5 py-2 font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                Back to List
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-brand-pink px-5 py-2 font-semibold text-brand-navy hover:brightness-110 disabled:opacity-60"
              >
                {saving ? 'Saving...' : mode === 'create' ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
