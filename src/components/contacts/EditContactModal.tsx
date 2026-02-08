import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AccountDetail {
  id?: string;
  bank: string;
  accountNumber: string;
  accountName: string;
}

interface EditContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
}

export function EditContactModal({ open, onOpenChange, contactId }: EditContactModalProps) {
  const { contacts, updateContact } = useAppStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const contact = contacts.find(c => c.id === contactId);
  
  const [formData, setFormData] = useState({
    loanId: '',
    name: '',
    phone: '',
    amount: '',
    appType: 'tloan',
    dayType: '0',
  });
  const [accountDetails, setAccountDetails] = useState<AccountDetail[]>([]);

  useEffect(() => {
    if (contact && open) {
      setFormData({
        loanId: contact.loanId || '',
        name: contact.name || '',
        phone: contact.phone || '',
        amount: contact.amount?.toString() || '',
        appType: contact.appType || 'tloan',
        dayType: contact.dayType?.toString() || '0',
      });
      setAccountDetails(contact.accountDetails || []);
    }
  }, [contact, open]);

  const handleSave = async () => {
    if (!contact) return;
    setLoading(true);

    try {
      // Update contact
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          loan_id: formData.loanId,
          name: formData.name,
          phone: formData.phone,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          app_type: formData.appType,
          day_type: parseInt(formData.dayType),
        })
        .eq('id', contactId);

      if (contactError) throw contactError;

      // Delete existing account details
      await supabase
        .from('account_details')
        .delete()
        .eq('contact_id', contactId);

      // Insert new account details
      if (accountDetails.length > 0) {
        const { error: accountError } = await supabase
          .from('account_details')
          .insert(
            accountDetails.map(ad => ({
              contact_id: contactId,
              bank: ad.bank,
              account_number: ad.accountNumber,
              account_name: ad.accountName,
            }))
          );

        if (accountError) throw accountError;
      }

      // Update local state
      updateContact(contactId, {
        loanId: formData.loanId,
        name: formData.name,
        phone: formData.phone,
        amount: formData.amount ? parseFloat(formData.amount) : undefined,
        appType: formData.appType,
        dayType: parseInt(formData.dayType),
        accountDetails: accountDetails.map((ad, idx) => ({
          id: `temp-${idx}`,
          ...ad,
        })),
      });

      toast({ title: 'Contact updated successfully' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({ title: 'Error updating contact', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addAccountDetail = () => {
    setAccountDetails([...accountDetails, { bank: '', accountNumber: '', accountName: '' }]);
  };

  const removeAccountDetail = (index: number) => {
    setAccountDetails(accountDetails.filter((_, i) => i !== index));
  };

  const updateAccountDetail = (index: number, field: keyof AccountDetail, value: string) => {
    setAccountDetails(accountDetails.map((ad, i) => 
      i === index ? { ...ad, [field]: value } : ad
    ));
  };

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Loan ID</Label>
            <Input
              value={formData.loanId}
              onChange={(e) => setFormData({ ...formData, loanId: e.target.value })}
              placeholder="Enter loan ID"
            />
          </div>

          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter customer name"
            />
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Enter amount"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>App Type</Label>
              <Select value={formData.appType} onValueChange={(v) => setFormData({ ...formData, appType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tloan">Tloan</SelectItem>
                  <SelectItem value="quickash">Quickash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Day Type</Label>
              <Select value={formData.dayType} onValueChange={(v) => setFormData({ ...formData, dayType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">-1 Day</SelectItem>
                  <SelectItem value="0">0 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Account Details</Label>
              <Button variant="outline" size="sm" onClick={addAccountDetail}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {accountDetails.map((ad, index) => (
              <div key={index} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Account {index + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeAccountDetail(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  placeholder="Bank name"
                  value={ad.bank}
                  onChange={(e) => updateAccountDetail(index, 'bank', e.target.value)}
                />
                <Input
                  placeholder="Account number"
                  value={ad.accountNumber}
                  onChange={(e) => updateAccountDetail(index, 'accountNumber', e.target.value)}
                />
                <Input
                  placeholder="Account name"
                  value={ad.accountName}
                  onChange={(e) => updateAccountDetail(index, 'accountName', e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
