'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, Users, User, Truck, Store, Building2, FileUp } from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type AudienceKey = 'all' | 'users' | 'drivers' | 'partners' | 'admins' | 'managers' | 'companies' | 'import';

const CampaignsPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<AudienceKey>('all');
  const [counts, setCounts] = useState<Record<AudienceKey, number>>({
    all: 0,
    users: 0,
    drivers: 0,
    partners: 0,
    admins: 0,
    managers: 0,
    companies: 0,
    import: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [importEmails, setImportEmails] = useState('');
  const [importRows, setImportRows] = useState<Array<{ email: string; name?: string; companyName?: string }>>([]);
  const [aiGoal, setAiGoal] = useState('');
  const [aiTone, setAiTone] = useState('professionnel');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const lastHtmlRef = useRef(html);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: () => t('dashboard.campaigns.placeholders.html'),
      }),
    ],
    content: html || '',
    onUpdate: ({ editor: currentEditor }) => {
      const nextHtml = currentEditor.getHTML();
      lastHtmlRef.current = nextHtml;
      setHtml(nextHtml);
    },
  });
  const [campaigns, setCampaigns] = useState<Array<{ id: string; subject: string; status: string; sentCount: number; failedCount: number; totalRecipients: number; createdAt: string }>>([]);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignDetail, setCampaignDetail] = useState<{
    id: string;
    subject: string;
    status: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    templateId?: string;
  } | null>(null);
  const [campaignRecipients, setCampaignRecipients] = useState<
    Array<{ email: string; name?: string; companyName?: string; status: string; errorMessage?: string }>
  >([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const loadCounts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/superadmin/campaigns', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setCounts(payload.counts || counts);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCounts();
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!editor) return;
    if (html === lastHtmlRef.current) return;
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html || '');
    }
    lastHtmlRef.current = html;
  }, [editor, html]);

  const loadCompanies = async () => {
    try {
      const response = await fetch('/api/superadmin/companies?page=1&pageSize=200', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setCompanies(payload.companies || []);
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  const loadCampaigns = async () => {
    try {
      const params = new URLSearchParams({ page: String(campaignPage), pageSize: '10' });
      const response = await fetch(`/api/superadmin/campaigns/list?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setCampaigns(payload.campaigns || []);
      setCampaignTotal(payload.total || 0);
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [campaignPage]);

  const dispatchCampaigns = async (campaignId?: string) => {
    try {
      await fetch('/api/superadmin/campaigns/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignId ? { campaignId } : {}),
      });
    } catch {
      // ignore background dispatch errors
    }
  };

  useEffect(() => {
    const hasPending = campaigns.some((campaign) => ['queued', 'sending'].includes(campaign.status));
    if (!hasPending) return;
    const interval = setInterval(() => {
      void dispatchCampaigns();
      void loadCampaigns();
    }, 4000);
    return () => clearInterval(interval);
  }, [campaigns]);

  const audienceItems = useMemo(
    () => [
      { key: 'all' as const, icon: Users, label: t('dashboard.campaigns.audience.all') },
      { key: 'users' as const, icon: User, label: t('dashboard.campaigns.audience.users') },
      { key: 'drivers' as const, icon: Truck, label: t('dashboard.campaigns.audience.drivers') },
      { key: 'partners' as const, icon: Store, label: t('dashboard.campaigns.audience.partners') },
      { key: 'admins' as const, icon: Users, label: t('dashboard.campaigns.audience.admins') },
      { key: 'managers' as const, icon: Users, label: t('dashboard.campaigns.audience.managers') },
      { key: 'companies' as const, icon: Building2, label: t('dashboard.campaigns.audience.companies') },
      { key: 'import' as const, icon: FileUp, label: t('dashboard.campaigns.audience.import') },
    ],
    [t]
  );

  const handleSend = async () => {
    if (!subject.trim() || !html.trim()) {
      showToast(t('dashboard.campaigns.validation.required'), 'error');
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/api/superadmin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          html,
          text,
          audience,
          companyIds: selectedCompanies,
          importEmails: importEmails
            .split(/[\n,;]+/)
            .map((item) => item.trim())
            .filter(Boolean),
          importRows,
          templateId: selectedTemplate,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      showToast(t('dashboard.campaigns.queued', { count: payload.queued || 0 }), 'success');
      setSubject('');
      setHtml('');
      setText('');
      setImportEmails('');
      setImportRows([]);
      setSelectedCompanies([]);
      void dispatchCampaigns(payload.campaignId);
      void loadCampaigns();
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const needle = companySearch.toLowerCase();
    return companies.filter((company) => company.name.toLowerCase().includes(needle));
  }, [companies, companySearch]);

  const templateOptions = useMemo(
    () => [
      {
        id: 'standard',
        name: t('dashboard.campaigns.templates.standard'),
        subject: '{companyName} · Informations importantes',
        html: `<div style="font-family:Arial,sans-serif;color:#111;">
  <h2>Bonjour {name},</h2>
  <p>Nous avons une mise à jour importante à partager avec {companyName}.</p>
  <p>Merci pour votre confiance.</p>
  <p>L'équipe Delivoo</p>
</div>`,
      },
      {
        id: 'promo',
        name: t('dashboard.campaigns.templates.promo'),
        subject: '{companyName} · Offre spéciale cette semaine',
        html: `<div style="font-family:Arial,sans-serif;color:#111;">
  <h2>Bonjour {name},</h2>
  <p>Profitez d'une offre exclusive pour {companyName} cette semaine.</p>
  <p>Contactez-nous pour en bénéficier.</p>
  <p>L'équipe Delivoo</p>
</div>`,
      },
      {
        id: 'newsletter',
        name: t('dashboard.campaigns.templates.newsletter'),
        subject: '{companyName} · Newsletter Delivoo',
        html: `<div style="font-family:Arial,sans-serif;color:#111;">
  <h2>Bonjour {name},</h2>
  <p>Voici les nouveautés Delivoo du mois pour {companyName}.</p>
  <ul>
    <li>Améliorations de suivi</li>
    <li>Nouveaux rapports</li>
    <li>Optimisations de performance</li>
  </ul>
  <p>Merci d'utiliser Delivoo.</p>
</div>`,
      },
    ],
    [t]
  );

  const applyTemplate = (templateId: string) => {
    const selected = templateOptions.find((tpl) => tpl.id === templateId);
    if (!selected) return;
    setSelectedTemplate(templateId);
    setSubject(selected.subject);
    setHtml(selected.html);
  };

  const parseCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(/[;,]/).map((cell) => cell.trim().toLowerCase());
    const rows = lines.slice(1);
    const emailIndex = Math.max(0, header.findIndex((h) => ['email', 'mail', 'e-mail'].includes(h)));
    const nameIndex = header.findIndex((h) => ['name', 'nom'].includes(h));
    const companyIndex = header.findIndex((h) => ['company', 'companyname', 'entreprise', 'societe'].includes(h));
    return rows
      .map((line) => line.split(/[;,]/))
      .map((cells) => ({
        email: cells[emailIndex]?.trim() || '',
        name: cells[nameIndex]?.trim() || '',
        companyName: cells[companyIndex]?.trim() || '',
      }))
      .filter((row) => row.email);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const rows = await parseCsv(file);
    setImportRows(rows);
    setImportEmails(rows.map((row) => row.email).join('\n'));
  };

  const handleGenerate = async () => {
    if (!aiGoal.trim()) {
      showToast(t('dashboard.campaigns.ai.validation'), 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/superadmin/campaigns/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: aiGoal,
          tone: aiTone,
          audience,
          language: i18n.language || 'fr',
        }),
      });
      const responseText = await response.text();
      let payload: any = {};
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = { error: responseText };
        }
      }
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status) || t('errors.server'), 'error');
        return;
      }
      if (!payload?.subject || !payload?.html) {
        showToast(t('errors.server'), 'error');
        return;
      }
      setSubject(payload.subject || '');
      setHtml(payload.html || '');
      setText(payload.text || '');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (editor) {
      editor.chain().focus().insertContent(variable).run();
      return;
    }
    setHtml((prev) => `${prev}${variable}`);
  };

  const toolbarButtonClass =
    'rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10';

  const toggleLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('dashboard.campaigns.placeholders.link'), previousUrl || '');
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImage = () => {
    if (!editor) return;
    const url = window.prompt(t('dashboard.campaigns.placeholders.image'), 'https://');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const recipientsSummary = useMemo(() => {
    if (audience === 'import') {
      return importRows.length || importEmails.split(/[\n,;]+/).filter(Boolean).length;
    }
    if (audience === 'companies') {
      return selectedCompanies.length || counts.companies || 0;
    }
    return counts[audience] || 0;
  }, [audience, counts, importEmails, importRows.length, selectedCompanies.length]);

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const loadCampaignDetails = async (campaignId: string) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    try {
      const response = await fetch(`/api/superadmin/campaigns/${campaignId}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setCampaignDetail(payload.campaign);
      setCampaignRecipients(payload.recipients || []);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.campaigns.title')}</h1>
        <p className="text-white/50">{t('dashboard.campaigns.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-6">
        <div className="glass-card p-6 space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm text-white/70">{t('dashboard.campaigns.templates.title')}</div>
            <div className="flex flex-wrap gap-2">
              {templateOptions.map((template) => (
                <Button
                  key={template.id}
                  variant="ghost"
                  className={`border border-white/10 ${selectedTemplate === template.id ? 'bg-white/10 text-white' : 'text-white/60'}`}
                  onClick={() => applyTemplate(template.id)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm text-white/70">{t('dashboard.campaigns.ai.title')}</div>
            <input
              className="input-glass w-full"
              value={aiGoal}
              onChange={(event) => setAiGoal(event.target.value)}
              placeholder={t('dashboard.campaigns.ai.placeholder')}
            />
            <input
              className="input-glass w-full"
              value={aiTone}
              onChange={(event) => setAiTone(event.target.value)}
              placeholder={t('dashboard.campaigns.ai.tone')}
            />
            <Button className="btn-primary w-full" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? t('dashboard.campaigns.ai.generating') : t('dashboard.campaigns.ai.generate')}
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">{t('dashboard.campaigns.fields.subject')}</label>
            <input
              className="input-glass w-full"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t('dashboard.campaigns.placeholders.subject')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">{t('dashboard.campaigns.fields.html')}</label>
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-white/70">
                <Button type="button" variant="ghost" className="h-7 px-2 hover:bg-white/10" onClick={() => insertVariable('{name}')}>
                  {`{name}`}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 hover:bg-white/10"
                  onClick={() => insertVariable('{companyName}')}
                >
                  {`{companyName}`}
                </Button>
                <Button type="button" variant="ghost" className="h-7 px-2 hover:bg-white/10" onClick={() => insertVariable('{email}')}>
                  {`{email}`}
                </Button>
                <div className="mx-2 h-5 w-px bg-white/10" />
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBold().run()}>
                  B
                </button>
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                  I
                </button>
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                  S
                </button>
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()}>
                  H1
                </button>
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()}>
                  H2
                </button>
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                  •
                </button>
                <button type="button" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                  1.
                </button>
                <button type="button" className={toolbarButtonClass} onClick={toggleLink}>
                  {t('dashboard.campaigns.actions.link')}
                </button>
                <button type="button" className={toolbarButtonClass} onClick={insertImage}>
                  {t('dashboard.campaigns.actions.image')}
                </button>
              </div>
              <div className="campaign-editor min-h-[180px] px-4 py-3 text-sm text-white/70">
                {editor ? <EditorContent editor={editor} /> : <div className="text-white/60">{t('common.loading')}</div>}
              </div>
            </div>
            <p className="text-xs text-white/50">{t('dashboard.campaigns.htmlHint')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">{t('dashboard.campaigns.fields.text')}</label>
            <textarea
              className="input-glass w-full min-h-[120px]"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('dashboard.campaigns.placeholders.text')}
            />
          </div>
        </div>

        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Mail className="w-4 h-4 text-orange-400" />
            {t('dashboard.campaigns.audience.title')}
          </div>
          <div className="space-y-3">
            {audienceItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    audience === item.key
                      ? 'border-orange-500/40 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={() => setAudience(item.key)}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  <span className="text-xs text-white/50">
                    {isLoading ? '...' : counts[item.key] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {audience === 'companies' ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="text-sm text-white/70">{t('dashboard.campaigns.companies.title')}</div>
              <input
                className="input-glass w-full"
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
                placeholder={t('dashboard.campaigns.companies.search')}
              />
              <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-2">
                {filteredCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => toggleCompany(company.id)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      selectedCompanies.includes(company.id)
                        ? 'border-orange-500/40 bg-orange-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span>{company.name}</span>
                    <span className="text-xs">{selectedCompanies.includes(company.id) ? t('common.confirm') : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {audience === 'import' ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="text-sm text-white/70">{t('dashboard.campaigns.import.title')}</div>
              <input
                type="file"
                accept=".csv"
                className="input-glass w-full"
                onChange={(event) => handleImportFile(event.target.files?.[0] || null)}
              />
              <textarea
                className="input-glass w-full min-h-[100px]"
                value={importEmails}
                onChange={(event) => setImportEmails(event.target.value)}
                placeholder={t('dashboard.campaigns.import.placeholder')}
              />
              <p className="text-xs text-white/50">{t('dashboard.campaigns.import.hint')}</p>
              {importRows.length ? (
                <p className="text-xs text-white/50">{t('dashboard.campaigns.import.count', { count: importRows.length })}</p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
            <div className="flex items-center justify-between">
              <span>{t('dashboard.campaigns.summary.audience')}</span>
              <span className="text-white font-semibold">{t(`dashboard.campaigns.audience.${audience}`)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('dashboard.campaigns.summary.recipients')}</span>
              <span className="text-white font-semibold">
                {isLoading ? '...' : recipientsSummary}
              </span>
            </div>
            <div className="text-xs text-white/50">{t('dashboard.campaigns.variablesHint')}</div>
          </div>

          <Button className="btn-primary w-full gap-2" onClick={handleSend} disabled={isSending}>
            <Send className="w-4 h-4" />
            {isSending ? t('dashboard.campaigns.sending') : t('dashboard.campaigns.send')}
          </Button>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-white">{t('dashboard.campaigns.history.title')}</div>
        </div>
        {campaigns.length === 0 ? (
          <div className="text-sm text-white/60">{t('dashboard.campaigns.history.empty')}</div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white font-semibold">{campaign.subject}</div>
                  <div className="text-xs text-white/50" suppressHydrationWarning>
                    {isMounted ? new Date(campaign.createdAt).toLocaleDateString() : ''} · {t(`dashboard.campaigns.status.${campaign.status}`)}
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  {campaign.sentCount}/{campaign.totalRecipients}
                </div>
                <Button variant="ghost" className="hover:bg-white/10" onClick={() => loadCampaignDetails(campaign.id)}>
                  {t('common.view')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isDetailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-w-3xl w-full bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-white">{campaignDetail?.subject}</div>
                <div className="text-xs text-white/50">{campaignDetail?.status}</div>
              </div>
              <Button variant="ghost" className="hover:bg-white/10" onClick={() => setIsDetailOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
            {isDetailLoading ? (
              <div className="text-center text-white/60 py-6">{t('common.loading')}</div>
            ) : (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    {t('dashboard.campaigns.stats.sent')} <span className="text-white font-semibold">{campaignDetail?.sentCount || 0}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    {t('dashboard.campaigns.stats.failed')} <span className="text-white font-semibold">{campaignDetail?.failedCount || 0}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    {t('dashboard.campaigns.stats.total')} <span className="text-white font-semibold">{campaignDetail?.totalRecipients || 0}</span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                  {campaignRecipients.map((recipient) => (
                    <div key={recipient.email} className="flex items-center justify-between text-sm text-white/70 border-b border-white/5 pb-2">
                      <div>
                        <div>{recipient.email}</div>
                        <div className="text-xs text-white/40">
                          {[recipient.name, recipient.companyName].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span>{t(`dashboard.campaigns.recipientStatus.${recipient.status}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CampaignsPage;
