import { useState, useEffect } from 'react';
import { FileText, Search, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Contact } from '@/types';

interface MetaTemplate {
  id: string; template_id: string; name: string; language: string; category: string; status: string; components: any;
}

interface UnifiedTemplateSelectorProps {
  contact: Contact;
  onSelectMetaTemplate: (template: MetaTemplate, params: Record<string, string>) => void;
  onInsertAppTemplate: (text: string) => void;
}

// Resolve a mapped field name to actual contact data
function resolveField(field: string, contact: Contact): string {
  const paymentDetails = contact.accountDetails?.length
    ? contact.accountDetails.map(a => `${a.bank} - ${a.accountNumber} (${a.accountName})`).join('; ')
    : '';
  switch (field) {
    case 'customer_name': return contact.name;
    case 'loan_id': return contact.loanId;
    case 'amount': return contact.amount?.toString() || '';
    case 'payment_details': return paymentDetails;
    case 'app_name': return contact.appType || 'Tloan';
    case 'due_date': return '';
    case 'phone_number': return contact.phone;
    case 'day_type': return contact.dayType?.toString() || '';
    default: return '';
  }
}

function mapNamedVariables(text: string, contact: Contact): string {
  const paymentDetails = contact.accountDetails?.length
    ? contact.accountDetails.map(a => `${a.bank} - ${a.accountNumber} (${a.accountName})`).join('; ')
    : '';
  return text
    .replace(/\{\{customer_name\}\}/gi, contact.name)
    .replace(/\{\{loan_id\}\}/gi, contact.loanId)
    .replace(/\{\{amount\}\}/gi, contact.amount?.toString() || '')
    .replace(/\{\{payment_details\}\}/gi, paymentDetails)
    .replace(/\{\{app_name\}\}/gi, contact.appType || 'Tloan');
}

const APP_VARIABLE_MAP: Record<string, (c: Contact) => string> = {
  customer_name: (c) => c.name,
  loan_id: (c) => c.loanId,
  amount: (c) => c.amount?.toString() || '',
  phone_number: (c) => c.phone,
  app_name: (c) => c.appType || 'Tloan',
  day_type: (c) => c.dayType?.toString() || '',
  due_date: () => '',
  account_number: (c) => c.accountDetails?.[0]?.accountNumber || '',
  payment_details: (c) => c.accountDetails?.map(a => `${a.bank} - ${a.accountNumber} (${a.accountName})`).join('; ') || '',
  current_date: () => new Date().toLocaleDateString(),
  current_time: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

function resolveAppTemplate(body: string, contact: Contact): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const resolver = APP_VARIABLE_MAP[varName];
    return resolver ? resolver(contact) || match : match;
  });
}

export function UnifiedTemplateSelector({ contact, onSelectMetaTemplate, onInsertAppTemplate }: UnifiedTemplateSelectorProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'meta' | 'app'>('meta');

  // Meta state
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [metaSearch, setMetaSearch] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<MetaTemplate | null>(null);
  const [metaParams, setMetaParams] = useState<Record<string, string>>({});
  const [mappings, setMappings] = useState<Record<number, string>>({});
  const [unmappedVars, setUnmappedVars] = useState<number[]>([]);

  // App state
  const [appTemplates, setAppTemplates] = useState<any[]>([]);
  const [appSearch, setAppSearch] = useState('');
  const [appLoading, setAppLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchMetaTemplates();
      fetchAppTemplates();
    }
    if (!open) {
      setSelectedMeta(null);
      setMetaSearch('');
      setAppSearch('');
    }
  }, [open, user]);

  const fetchMetaTemplates = async () => {
    if (!user) return;
    setMetaLoading(true);
    try {
      const { data } = await supabase.from('whatsapp_templates' as any).select('*').eq('user_id', user.id);
      setMetaTemplates((data as any[]) || []);
    } catch (e) { console.error(e); }
    finally { setMetaLoading(false); }
  };

  const fetchAppTemplates = async () => {
    if (!user) return;
    setAppLoading(true);
    try {
      const { data } = await supabase.from('app_templates' as any).select('*').eq('user_id', user.id).order('name');
      setAppTemplates((data as any[]) || []);
    } catch (e) { console.error(e); }
    finally { setAppLoading(false); }
  };

  const handleSelectMeta = async (template: MetaTemplate) => {
    setSelectedMeta(template);
    if (!user) return;
    const { data: mappingData } = await supabase
      .from('template_mappings' as any).select('*').eq('user_id', user.id).eq('template_name', template.name);
    const dbMappings: Record<number, string> = {};
    ((mappingData as any[]) || []).forEach((m: any) => { dbMappings[m.variable_number] = m.mapped_field; });
    setMappings(dbMappings);

    const body = template.components?.find((c: any) => c.type === 'BODY');
    const text = body?.text || '';
    const varMatches: string[] = text.match(/\{\{(\d+)\}\}/g) || [];
    const varNums = [...new Set(varMatches.map(m => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);

    const resolved: Record<string, string> = {};
    const unmapped: number[] = [];
    varNums.forEach(num => {
      const field = dbMappings[num];
      if (field) resolved[`{{${num}}}`] = resolveField(field, contact);
      else { resolved[`{{${num}}}`] = ''; unmapped.push(num); }
    });

    if (Object.keys(dbMappings).length === 0 && template.components) {
      template.components.forEach((comp: any) => {
        if (comp.type === 'BODY' && comp.example?.body_text) {
          comp.example.body_text[0]?.forEach((param: string, index: number) => {
            const paramKey = `{{${index + 1}}}`;
            const lower = param.toLowerCase();
            if (lower.includes('name') || lower.includes('customer')) resolved[paramKey] = contact.name;
            else if (lower.includes('loan') || lower.includes('id')) resolved[paramKey] = contact.loanId;
            else if (lower.includes('amount')) resolved[paramKey] = contact.amount?.toString() || '';
            else if (lower.includes('app')) resolved[paramKey] = contact.appType || 'Tloan';
            else resolved[paramKey] = param;
          });
        }
      });
    }
    setMetaParams(resolved);
    setUnmappedVars(unmapped);
  };

  const handleMetaConfirm = () => {
    if (selectedMeta) {
      onSelectMetaTemplate(selectedMeta, metaParams);
      setOpen(false);
      setSelectedMeta(null);
    }
  };

  const handleAppSelect = (template: any) => {
    const resolved = resolveAppTemplate(template.body, contact);
    onInsertAppTemplate(resolved);
    setOpen(false);
  };

  const renderMetaPreview = (template: MetaTemplate) => {
    const body = template.components?.find((c: any) => c.type === 'BODY');
    let text = body?.text || 'No preview available';
    Object.entries(metaParams).forEach(([key, value]) => { text = text.replace(key, value || key); });
    text = mapNamedVariables(text, contact);
    return text;
  };

  const filteredMeta = metaTemplates.filter(t => t.name.toLowerCase().includes(metaSearch.toLowerCase()));
  const filteredApp = appTemplates.filter(t => t.name.toLowerCase().includes(appSearch.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" title="Templates">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader><DialogTitle>Templates</DialogTitle></DialogHeader>

        {selectedMeta ? (
          /* Meta template detail view */
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium truncate">{selectedMeta.name}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMeta(null)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="p-4 bg-muted rounded-lg overflow-hidden">
                <p className="text-sm whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{renderMetaPreview(selectedMeta)}</p>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Template Parameters</h4>
                {Object.entries(metaParams).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16 shrink-0">{key}</span>
                    <Input value={value} onChange={(e) => setMetaParams({ ...metaParams, [key]: e.target.value })} placeholder={`Value for ${key}`} />
                  </div>
                ))}
                {unmappedVars.length > 0 && Object.keys(mappings).length > 0 && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Variables {unmappedVars.map(v => `{{${v}}}`).join(', ')} not mapped. Go to Settings → Template Mapping.</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedMeta(null)}>Back</Button>
                <Button onClick={handleMetaConfirm}>Send Template</Button>
              </div>
            </div>
          </ScrollArea>
        ) : (
          /* Tabs view */
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'meta' | 'app')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="meta">Meta Templates</TabsTrigger>
              <TabsTrigger value="app">App Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="meta" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={metaSearch} onChange={(e) => setMetaSearch(e.target.value)} placeholder="Search meta templates..." className="pl-9" />
              </div>
              <ScrollArea className="h-[350px]">
                {metaLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredMeta.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No Meta templates found</p>
                    <p className="text-xs mt-1">Connect to WhatsApp API and sync templates first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMeta.map(t => (
                      <button key={t.id} onClick={() => handleSelectMeta(t)} className="w-full text-left p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{t.name}</span>
                          <Badge variant={t.status === 'APPROVED' ? 'default' : 'secondary'}>{t.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{t.components?.find((c: any) => c.type === 'BODY')?.text || 'No preview'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="app" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder="Search app templates..." className="pl-9" />
              </div>
              <ScrollArea className="h-[350px]">
                {appLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
                ) : filteredApp.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No app templates found</p>
                    <p className="text-xs mt-1">Create templates in Settings → Templates</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {filteredApp.map(t => (
                      <button key={t.id} onClick={() => handleAppSelect(t)} className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{resolveAppTemplate(t.body, contact)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
