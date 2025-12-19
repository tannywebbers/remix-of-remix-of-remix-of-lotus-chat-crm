import { useState } from 'react';
import { X, User, Phone, CreditCard, Banknote, Users, Plus, Calendar, Smartphone } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface AccountTag {
  id: string;
  value: string;
}

export function AddContactModal() {
  const { showAddContactModal, setShowAddContactModal, addContact, addContacts } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Single contact form
  const [singleForm, setSingleForm] = useState({
    loanId: '',
    name: '',
    phone: '',
    amount: '',
    appType: 'tloan',
    dayType: '0',
  });
  const [accountTags, setAccountTags] = useState<AccountTag[]>([]);
  const [accountInput, setAccountInput] = useState('');
  
  // Bulk form
  const [bulkForm, setBulkForm] = useState({
    contactIds: '',
    customerNames: '',
    phoneNumbers: '',
    appType: 'tloan',
    dayType: '0',
  });

  const resetForms = () => {
    setSingleForm({ loanId: '', name: '', phone: '', amount: '', appType: 'tloan', dayType: '0' });
    setAccountTags([]);
    setAccountInput('');
    setBulkForm({ contactIds: '', customerNames: '', phoneNumbers: '', appType: 'tloan', dayType: '0' });
  };

  const handleClose = () => {
    setShowAddContactModal(false);
    resetForms();
  };

  // Account tag handlers
  const handleAccountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && accountInput.trim()) {
      e.preventDefault();
      addAccountTag();
    }
  };

  const addAccountTag = () => {
    if (accountInput.trim()) {
      setAccountTags([...accountTags, { id: Date.now().toString(), value: accountInput.trim() }]);
      setAccountInput('');
    }
  };

  const removeAccountTag = (id: string) => {
    setAccountTags(accountTags.filter(tag => tag.id !== id));
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!singleForm.loanId || !singleForm.name || !singleForm.phone) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in Loan ID, Name, and Phone number.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          loan_id: singleForm.loanId,
          name: singleForm.name,
          phone: singleForm.phone,
          amount: singleForm.amount ? parseFloat(singleForm.amount) : null,
          app_type: singleForm.appType,
          day_type: parseInt(singleForm.dayType),
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Insert account details from tags
      if (accountTags.length > 0) {
        const accountDetails = [];
        let currentBank = '';
        let currentAccount = '';
        let currentName = '';
        
        for (const tag of accountTags) {
          const lower = tag.value.toLowerCase();
          if (lower.startsWith('bank:')) {
            if (currentBank && currentAccount) {
              accountDetails.push({ bank: currentBank, account_number: currentAccount, account_name: currentName || '' });
            }
            currentBank = tag.value.substring(5).trim();
            currentAccount = '';
            currentName = '';
          } else if (lower.startsWith('account:')) {
            currentAccount = tag.value.substring(8).trim();
          } else if (lower.startsWith('name:')) {
            currentName = tag.value.substring(5).trim();
          }
        }
        
        if (currentBank && currentAccount) {
          accountDetails.push({ bank: currentBank, account_number: currentAccount, account_name: currentName || '' });
        }

        if (accountDetails.length > 0) {
          await supabase
            .from('account_details')
            .insert(accountDetails.map(acc => ({ contact_id: contactData.id, ...acc })));
        }
      }

      addContact({
        id: contactData.id,
        loanId: contactData.loan_id,
        name: contactData.name,
        phone: contactData.phone,
        amount: contactData.amount ? Number(contactData.amount) : undefined,
        createdAt: new Date(contactData.created_at),
        updatedAt: new Date(contactData.updated_at),
      });

      toast({ title: 'Contact added', description: `${contactData.name} has been added successfully.` });
      handleClose();
    } catch (error: any) {
      toast({ title: 'Error adding contact', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ids = bulkForm.contactIds.trim().split('\n').filter(Boolean);
    const names = bulkForm.customerNames.trim().split('\n').filter(Boolean);
    const phones = bulkForm.phoneNumbers.trim().split('\n').filter(Boolean);

    if (ids.length === 0 || names.length === 0 || phones.length === 0) {
      toast({ title: 'Missing data', description: 'Please fill in all three fields.', variant: 'destructive' });
      return;
    }

    if (ids.length !== names.length || names.length !== phones.length) {
      toast({
        title: 'Data mismatch',
        description: `IDs (${ids.length}), Names (${names.length}), and Phones (${phones.length}) must have the same count.`,
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const contacts = ids.map((id, i) => ({
        user_id: user.id,
        loan_id: id.trim(),
        name: names[i].trim(),
        phone: phones[i].trim(),
        app_type: bulkForm.appType,
        day_type: parseInt(bulkForm.dayType),
      }));

      const { data: contactsData, error } = await supabase
        .from('contacts')
        .insert(contacts)
        .select();

      if (error) throw error;

      const newContacts = (contactsData || []).map(c => ({
        id: c.id,
        loanId: c.loan_id,
        name: c.name,
        phone: c.phone,
        createdAt: new Date(c.created_at),
        updatedAt: new Date(c.updated_at),
      }));

      addContacts(newContacts);
      toast({ title: 'Contacts added', description: `${newContacts.length} contacts have been added successfully.` });
      handleClose();
    } catch (error: any) {
      toast({ title: 'Error adding contacts', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={showAddContactModal} onOpenChange={setShowAddContactModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Add Contact
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="single" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <User className="h-4 w-4" />
              Single Contact
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Users className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          {/* Single Contact Tab */}
          <TabsContent value="single" className="mt-4">
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loanId" className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Loan ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="loanId"
                    value={singleForm.loanId}
                    onChange={(e) => setSingleForm({ ...singleForm, loanId: e.target.value })}
                    placeholder="LN-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5" />
                    Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={singleForm.amount}
                    onChange={(e) => setSingleForm({ ...singleForm, amount: e.target.value })}
                    placeholder="50000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={singleForm.name}
                    onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={singleForm.phone}
                    onChange={(e) => setSingleForm({ ...singleForm, phone: e.target.value })}
                    placeholder="+234 801 234 5678"
                  />
                </div>
              </div>

              {/* App Type Radio */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  App Type
                </Label>
                <RadioGroup
                  value={singleForm.appType}
                  onValueChange={(v) => setSingleForm({ ...singleForm, appType: v })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tloan" id="single-tloan" />
                    <Label htmlFor="single-tloan" className="font-normal cursor-pointer">Tloan</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quickash" id="single-quickash" />
                    <Label htmlFor="single-quickash" className="font-normal cursor-pointer">Quickash</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Day Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Day Type
                </Label>
                <Select value={singleForm.dayType} onValueChange={(v) => setSingleForm({ ...singleForm, dayType: v })}>
                  <SelectTrigger className="w-40 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border">
                    <SelectItem value="-1">-1 Day</SelectItem>
                    <SelectItem value="0">0 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Account Details Tags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">Account Details (Tags)</Label>
                <div className="flex flex-wrap gap-2 p-3 min-h-16 rounded-lg border border-input bg-background">
                  {accountTags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="gap-1 py-1.5 px-3">
                      {tag.value}
                      <button type="button" onClick={() => removeAccountTag(tag.id)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={accountInput}
                    onChange={(e) => setAccountInput(e.target.value)}
                    onKeyDown={handleAccountKeyDown}
                    onBlur={addAccountTag}
                    placeholder="Type and press Enter (e.g., Bank: Zenith)"
                    className="flex-1 min-w-48 border-0 shadow-none focus-visible:ring-0 p-0 h-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Format: Bank: Name, Account: Number, Name: Holder</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Contact'}</Button>
              </div>
            </form>
          </TabsContent>

          {/* Bulk Import Tab */}
          <TabsContent value="bulk" className="mt-4">
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Contact IDs (one per line)
                  </Label>
                  <Textarea
                    value={bulkForm.contactIds}
                    onChange={(e) => setBulkForm({ ...bulkForm, contactIds: e.target.value })}
                    placeholder={`ID001\nID002\nID003`}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Customer Names (one per line)
                  </Label>
                  <Textarea
                    value={bulkForm.customerNames}
                    onChange={(e) => setBulkForm({ ...bulkForm, customerNames: e.target.value })}
                    placeholder={`John Doe\nJane Smith\nAlex Brown`}
                    rows={8}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Phone Numbers (one per line)
                  </Label>
                  <Textarea
                    value={bulkForm.phoneNumbers}
                    onChange={(e) => setBulkForm({ ...bulkForm, phoneNumbers: e.target.value })}
                    placeholder={`2348012345678\n2348098765432\n2347011122233`}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* App Type Radio */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  App Type (applies to all)
                </Label>
                <RadioGroup
                  value={bulkForm.appType}
                  onValueChange={(v) => setBulkForm({ ...bulkForm, appType: v })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tloan" id="bulk-tloan" />
                    <Label htmlFor="bulk-tloan" className="font-normal cursor-pointer">Tloan</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quickash" id="bulk-quickash" />
                    <Label htmlFor="bulk-quickash" className="font-normal cursor-pointer">Quickash</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Day Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Day Type (applies to all)
                </Label>
                <Select value={bulkForm.dayType} onValueChange={(v) => setBulkForm({ ...bulkForm, dayType: v })}>
                  <SelectTrigger className="w-40 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border">
                    <SelectItem value="-1">-1 Day</SelectItem>
                    <SelectItem value="0">0 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Importing...' : 'Import Contacts'}</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
