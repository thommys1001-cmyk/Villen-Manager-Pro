import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Download, Pencil, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Accounting() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
  });

  const expenseCategories = [
    'Gartenarbeit',
    'Pool-Service',
    'Heckenschneiden',
    'Reparaturen',
    'Reinigung',
    'Wartung',
    'Sonstiges'
  ];

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounting`,
        { withCredentials: true }
      );
      setEntries(data);
    } catch (error) {
      toast.error('Fehler beim Laden der Buchhaltung');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await axios.patch(
          `${process.env.REACT_APP_BACKEND_URL}/api/accounting/${editingEntry._id}`,
          formData,
          { withCredentials: true }
        );
        toast.success('Eintrag aktualisiert');
      } else {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/accounting`,
          formData,
          { withCredentials: true }
        );
        toast.success('Eintrag erstellt');
      }
      setShowDialog(false);
      resetForm();
      fetchEntries();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return;
    
    try {
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounting/${id}`,
        { withCredentials: true }
      );
      toast.success('Eintrag gelöscht');
      fetchEntries();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounting/export`,
        { withCredentials: true }
      );
      
      // Convert to CSV
      const headers = ['Kategorie', 'Beschreibung', 'Betrag', 'Typ', 'Datum'];
      const rows = data.map(entry => [
        entry.category,
        entry.description,
        entry.amount,
        entry.type,
        entry.date
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buchhaltung_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast.success('Export erfolgreich!');
    } catch (error) {
      toast.error('Fehler beim Exportieren');
    }
  };

  const resetForm = () => {
    setFormData({
      category: '',
      description: '',
      amount: '',
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
    });
    setEditingEntry(null);
  };

  const openEditDialog = (entry) => {
    setEditingEntry(entry);
    setFormData({
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      type: entry.type,
      date: entry.date.split('T')[0],
    });
    setShowDialog(true);
  };

  const getTypeBadge = (type) => {
    return type === 'income' ? (
      <Badge className="text-emerald-700 bg-emerald-50 border-emerald-200">
        Einnahme
      </Badge>
    ) : (
      <Badge className="text-red-700 bg-red-50 border-red-200">
        Ausgabe
      </Badge>
    );
  };

  const totals = entries.reduce(
    (acc, entry) => {
      if (entry.type === 'income') {
        acc.income += entry.amount;
      } else {
        acc.expense += entry.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <div className="flex" data-testid="accounting-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 z-40">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gold-400 font-heading">Buchhaltung</h1>
              <p className="text-gold-600 mt-1">Einnahmen und Ausgaben verwalten</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleExport}
                data-testid="export-button"
                variant="outline"
                className="border-zinc-900 text-gold-400 hover:bg-zinc-900 hover:text-white"
              >
                <Download size={20} className="mr-2" />
                Exportieren
              </Button>
              <Dialog open={showDialog} onOpenChange={(open) => {
                setShowDialog(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-entry-button" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus size={20} weight="bold" className="mr-2" />
                    Neuer Eintrag
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-heading">
                      {editingEntry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Typ
                      </label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger data-testid="type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Ausgabe</SelectItem>
                          <SelectItem value="income">Einnahme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Kategorie
                      </label>
                      {formData.type === 'expense' ? (
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger data-testid="category-select">
                            <SelectValue placeholder="Kategorie wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          required
                          placeholder="z.B. Buchung"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Beschreibung
                      </label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                        data-testid="description-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Betrag (€)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                        required
                        data-testid="amount-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Datum
                      </label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                        data-testid="date-input"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="save-entry-button">
                        {editingEntry ? 'Aktualisieren' : 'Erstellen'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowDialog(false);
                          resetForm();
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-zinc-900 border border-gold-500/30 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2">
                Gesamteinnahmen
              </p>
              <p className="text-3xl font-bold text-emerald-600 font-heading">
                €{totals.income.toFixed(2)}
              </p>
            </div>
            <div className="bg-zinc-900 border border-gold-500/30 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2">
                Gesamtausgaben
              </p>
              <p className="text-3xl font-bold text-red-600 font-heading">
                €{totals.expense.toFixed(2)}
              </p>
            </div>
            <div className="bg-zinc-900 border border-gold-500/30 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2">
                Nettogewinn
              </p>
              <p className="text-3xl font-bold text-blue-600 font-heading">
                €{(totals.income - totals.expense).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-gold-500/30 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-950 border-b border-gold-500/30">
                  <TableHead className="font-semibold text-gold-400">Datum</TableHead>
                  <TableHead className="font-semibold text-gold-400">Kategorie</TableHead>
                  <TableHead className="font-semibold text-gold-400">Beschreibung</TableHead>
                  <TableHead className="font-semibold text-gold-400">Betrag</TableHead>
                  <TableHead className="font-semibold text-gold-400">Typ</TableHead>
                  <TableHead className="font-semibold text-gold-400">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gold-600">
                      Keine Einträge gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry._id} data-testid={`entry-row-${entry._id}`}>
                      <TableCell>{new Date(entry.date).toLocaleDateString('de-DE')}</TableCell>
                      <TableCell className="font-medium">{entry.category}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className={entry.type === 'income' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {entry.type === 'income' ? '+' : '-'}€{entry.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getTypeBadge(entry.type)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(entry)}
                            data-testid={`edit-entry-${entry._id}`}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(entry._id)}
                            data-testid={`delete-entry-${entry._id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
