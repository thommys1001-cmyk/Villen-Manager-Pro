import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
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
import { Plus, Pencil, Trash, Buildings } from '@phosphor-icons/react';
import { toast } from 'sonner';

const CATEGORIES = ['Villa', 'Hotel', 'Ferienhaus', 'Appartment', 'Zimmer'];

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    category: 'Villa',
    description: '',
    address: '',
    default_price: '',
    default_deposit: '',
    max_guests: 2,
  });

  const fetchProperties = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/properties`,
        { withCredentials: true }
      );
      setProperties(data);
    } catch (error) {
      toast.error('Fehler beim Laden der Immobilien');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        default_price: formData.default_price ? parseFloat(formData.default_price) : null,
        default_deposit: formData.default_deposit ? parseFloat(formData.default_deposit) : null,
        max_guests: parseInt(formData.max_guests) || 2,
      };

      if (editing) {
        await axios.patch(
          `${process.env.REACT_APP_BACKEND_URL}/api/properties/${editing._id}`,
          submitData,
          { withCredentials: true }
        );
        toast.success('Immobilie aktualisiert');
      } else {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/properties`,
          submitData,
          { withCredentials: true }
        );
        toast.success('Immobilie erstellt');
      }
      setShowDialog(false);
      resetForm();
      fetchProperties();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Immobilie wirklich löschen?')) return;
    try {
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/properties/${id}`,
        { withCredentials: true }
      );
      toast.success('Gelöscht');
      fetchProperties();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Villa',
      description: '',
      address: '',
      default_price: '',
      default_deposit: '',
      max_guests: 2,
    });
    setEditing(null);
  };

  const openEdit = (prop) => {
    setEditing(prop);
    setFormData({
      name: prop.name,
      category: prop.category,
      description: prop.description || '',
      address: prop.address || '',
      default_price: prop.default_price || '',
      default_deposit: prop.default_deposit || '',
      max_guests: prop.max_guests || 2,
    });
    setShowDialog(true);
  };

  const filteredProperties = filterCategory === 'all'
    ? properties
    : properties.filter(p => p.category === filterCategory);

  const groupedByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = properties.filter(p => p.category === cat);
    return acc;
  }, {});

  return (
    <div className="flex bg-zinc-950 min-h-screen" data-testid="properties-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-950/90 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 lg:top-0 z-30">
          <div className="p-4 lg:p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold tracking-tight text-gold-400 font-heading">Immobilien</h1>
              <p className="text-gold-700 mt-1 text-sm lg:text-base">Verwalten Sie Ihre Immobilien</p>
            </div>
            <Dialog open={showDialog} onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-property-button" className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-semibold">
                  <Plus size={20} weight="bold" className="mr-2" />
                  Neue Immobilie
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-zinc-900 border-gold-500/30">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-heading text-gold-400">
                    {editing ? 'Immobilie bearbeiten' : 'Neue Immobilie'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Kategorie *</label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger className="bg-zinc-950 border-gold-500/30 text-gold-400" data-testid="category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="property-name-input"
                      placeholder="z.B. Villa Mali Svor"
                      className="bg-zinc-950 border-gold-500/30 text-gold-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Adresse</label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="z.B. Hauptstraße 1, 10115 Berlin"
                      className="bg-zinc-950 border-gold-500/30 text-gold-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Beschreibung</label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Kurze Beschreibung"
                      className="bg-zinc-950 border-gold-500/30 text-gold-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Standardpreis (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.default_price}
                        onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                        placeholder="z.B. 250"
                        className="bg-zinc-950 border-gold-500/30 text-gold-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Standardkaution (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.default_deposit}
                        onChange={(e) => setFormData({ ...formData, default_deposit: e.target.value })}
                        placeholder="z.B. 500"
                        className="bg-zinc-950 border-gold-500/30 text-gold-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Max. Gäste</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.max_guests}
                      onChange={(e) => setFormData({ ...formData, max_guests: parseInt(e.target.value) })}
                      className="bg-zinc-950 border-gold-500/30 text-gold-400"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold" data-testid="save-property-button">
                      {editing ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="border-gold-500 text-gold-400">
                      Abbrechen
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-4 lg:p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent"></div>
            </div>
          ) : properties.length === 0 ? (
            <Card className="p-12 bg-zinc-900 border-gold-500/30 text-center">
              <Buildings size={64} weight="fill" className="mx-auto text-gold-500 mb-4" />
              <h2 className="text-xl text-gold-400 font-heading mb-2">Keine Immobilien</h2>
              <p className="text-gold-600 mb-4">Fügen Sie Ihre erste Immobilie hinzu</p>
            </Card>
          ) : (
            <div className="space-y-8">
              {CATEGORIES.map(cat => {
                const items = groupedByCategory[cat];
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h2 className="text-xl lg:text-2xl text-gold-400 font-heading mb-4 flex items-center gap-3">
                      <Buildings size={28} weight="fill" className="text-gold-500" />
                      {cat} <span className="text-sm text-gold-600">({items.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(prop => (
                        <Card key={prop._id} className="p-5 bg-zinc-900 border-gold-500/30 hover:border-gold-500 transition-all" data-testid={`property-card-${prop._id}`}>
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-bold text-gold-400 text-lg font-heading">{prop.name}</h3>
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(prop)} className="text-gold-500 hover:text-gold-400 p-1" data-testid={`edit-property-${prop._id}`}>
                                <Pencil size={18} />
                              </button>
                              <button onClick={() => handleDelete(prop._id)} className="text-red-500 hover:text-red-400 p-1" data-testid={`delete-property-${prop._id}`}>
                                <Trash size={18} />
                              </button>
                            </div>
                          </div>
                          {prop.address && <p className="text-sm text-gold-600 mb-2">📍 {prop.address}</p>}
                          {prop.description && <p className="text-sm text-gold-500 mb-3">{prop.description}</p>}
                          <div className="space-y-1 text-sm pt-3 border-t border-gold-500/20">
                            {prop.default_price && (
                              <div className="flex justify-between text-gold-400">
                                <span>Preis/Nacht:</span>
                                <span className="font-semibold">€{prop.default_price}</span>
                              </div>
                            )}
                            {prop.default_deposit && (
                              <div className="flex justify-between text-gold-400">
                                <span>Kaution:</span>
                                <span className="font-semibold">€{prop.default_deposit}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-gold-500">
                              <span>Max. Gäste:</span>
                              <span>{prop.max_guests || 2}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
