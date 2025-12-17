import { useState } from 'react';
import { X, User, Phone, CreditCard, Banknote, FileText, Users } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateId, parseAccountDetails, parseBulkContacts } from '@/lib/utils/format';
import { Contact, AccountDetail } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function AddContactModal() {
  const { showAddContactModal, setShowAddContactModal, addContact, addContacts } = useAppStore();
  const { toast } = useToast();
  
  const [singleForm, setSingleForm] = useState({
    loanId: '',
    name: '',
    phone: '',
    amount: '',
    accountDetails: '',
  });
  
  const [bulkInput, setBulkInput] = useState('');

  const resetForms = () => {
    setSingleForm({ loanId: '', name: '', phone: '', amount: '', accountDetails: '' });
    setBulkInput('');
  };

  const handleClose = () => {
    setShowAddContactModal(false);
    resetForms();
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!singleForm.loanId || !singleForm.name || !singleForm.phone) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in Loan ID, Name, and Phone number.',
        variant: 'destructive',
      });
      return;
    }

    const accountDetails: AccountDetail[] = singleForm.accountDetails
      ? parseAccountDetails(singleForm.accountDetails).map((acc, i) => ({
          id: generateId(),
          ...acc,
        }))
      : [];

    const newContact: Contact = {
      id: generateId(),
      loanId: singleForm.loanId,
      name: singleForm.name,
      phone: singleForm.phone,
      amount: singleForm.amount ? parseFloat(singleForm.amount) : undefined,
      accountDetails,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addContact(newContact);
    toast({
      title: 'Contact added',
      description: `${newContact.name} has been added successfully.`,
    });
    handleClose();
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bulkInput.trim()) {
      toast({
        title: 'No data provided',
        description: 'Please paste your contact data.',
        variant: 'destructive',
      });
      return;
    }

    const parsedContacts = parseBulkContacts(bulkInput);
    
    if (parsedContacts.length === 0) {
      toast({
        title: 'Could not parse contacts',
        description: 'Please check the format and try again.',
        variant: 'destructive',
      });
      return;
    }

    const newContacts: Contact[] = parsedContacts.map(c => ({
      id: generateId(),
      loanId: c.loanId,
      name: c.name,
      phone: c.phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    addContacts(newContacts);
    toast({
      title: 'Contacts added',
      description: `${newContacts.length} contacts have been added successfully.`,
    });
    handleClose();
  };

  return (
    <Dialog open={showAddContactModal} onOpenChange={setShowAddContactModal}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountDetails" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Account Details
                </Label>
                <Textarea
                  id="accountDetails"
                  value={singleForm.accountDetails}
                  onChange={(e) => setSingleForm({ ...singleForm, accountDetails: e.target.value })}
                  placeholder={`Bank: HDFC Bank\nAccount: 1234567890\nName: John Doe,\n\nBank: SBI\nAccount: 0987654321\nName: John Doe,`}
                  rows={5}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple accounts with commas (,)
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">Add Contact</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulkInput">Paste Contact Data</Label>
                <Textarea
                  id="bulkInput"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={`Id 1\nId 2\nId 3\n\nCustomer 1\nCustomer 2\nCustomer 3\n\n12345\n23456\n34567`}
                  rows={12}
                  className="text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The system will automatically recognize Loan IDs, Customer Names, and Phone Numbers.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">Import Contacts</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
