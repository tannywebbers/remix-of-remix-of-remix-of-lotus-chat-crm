import { useState, useEffect } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string; template_id: string; name: string; language: string; category: string; status: string; components: any;
}

interface TemplateSelectorProps {
  contact: { loanId: string; name: string; phone: string; amount?: number; appType?: string; dayType?: number; accountDetails?: { bank: string; accountNumber: string; accountName: string }[] };
  onSelectTemplate: (template: Template, params: Record<string, string>) => void;
}

export function TemplateSelector({ contact, onSelectTemplate }: TemplateSelectorProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => { if (open && user) fetchTemplates(); }, [open, user]);

  const fetchTemplates = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('whatsapp_templates' as any).select('*').eq('user_id', user.id);
      if (error) throw error;
      setTemplates((data as any[]) || []);
    } catch (error) { console.error('Error fetching templates:', error); }
    finally { setLoading(false); }
  };

  const getDefaultParams = (template: Template) => {
    const defaultParams: Record<string, string> = {};
    const components = template.components || [];
    components.forEach((comp: any) => {
      if (comp.type === 'BODY' && comp.example?.body_text) {
        comp.example.body_text[0]?.forEach((param: string, index: number) => {
          const paramKey = `{{${index + 1}}}`;
          if (param.toLowerCase().includes('name')) defaultParams[paramKey] = contact.name;
          else if (param.toLowerCase().includes('loan') || param.toLowerCase().includes('id')) defaultParams[paramKey] = contact.loanId;
          else if (param.toLowerCase().includes('amount')) defaultParams[paramKey] = contact.amount?.toString() || '';
          else if (param.toLowerCase().includes('app')) defaultParams[paramKey] = contact.appType || '';
          else if (param.toLowerCase().includes('day')) defaultParams[paramKey] = contact.dayType?.toString() || '';
          else if (param.toLowerCase().includes('account') && contact.accountDetails?.[0]) defaultParams[paramKey] = `${contact.accountDetails[0].bank} - ${contact.accountDetails[0].accountNumber}`;
          else defaultParams[paramKey] = param;
        });
      }
    });
    return defaultParams;
  };

  const handleSelectTemplate = (template: Template) => { setSelectedTemplate(template); setParams(getDefaultParams(template)); };
  const handleConfirm = () => { if (selectedTemplate) { onSelectTemplate(selectedTemplate, params); setOpen(false); setSelectedTemplate(null); } };
  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderTemplatePreview = (template: Template) => {
    const body = template.components?.find((c: any) => c.type === 'BODY');
    let text = body?.text || 'No preview available';
    Object.entries(params).forEach(([key, value]) => { text = text.replace(key, value || key); });
    return text;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* VISIBLE on both mobile and desktop */}
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader><DialogTitle>Send Template Message</DialogTitle></DialogHeader>
        {!selectedTemplate ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates..." className="pl-9" />
            </div>
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No templates found</p>
                  <p className="text-xs mt-1">Connect to WhatsApp API and sync templates first</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <button key={template.id} onClick={() => handleSelectTemplate(template)} className="w-full text-left p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{template.name}</span>
                        <Badge variant={template.status === 'APPROVED' ? 'default' : 'secondary'}>{template.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{template.components?.find((c: any) => c.type === 'BODY')?.text || 'No preview'}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{selectedTemplate.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{renderTemplatePreview(selectedTemplate)}</p></div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Template Parameters</h4>
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-16">{key}</span>
                  <Input value={value} onChange={(e) => setParams({ ...params, [key]: e.target.value })} placeholder={`Value for ${key}`} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>Back</Button>
              <Button onClick={handleConfirm}>Send Template</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
