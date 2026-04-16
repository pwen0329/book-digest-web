'use client';

import { useState } from 'react';
import type { Venue } from '@/types/venue';

type VenueManagerProps = {
  venues: Venue[];
  onVenuesChange: (venues: Venue[]) => void;
};

type DraftVenue = Omit<Venue, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
};

export default function VenueManager({ venues, onVenuesChange }: VenueManagerProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<number | undefined>(venues[0]?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);

  const createDraftVenue = (): DraftVenue => ({
    name: '',
    location: 'TW',
    address: '',
    maxCapacity: 20,
    isVirtual: false,
  });

  const addVenue = () => {
    const draft = createDraftVenue();
    // For drafts, we use undefined id temporarily
    const draftWithId: DraftVenue = { ...draft, id: undefined };
    onVenuesChange([draftWithId as Venue, ...venues]);
    setSelectedVenueId(undefined);
  };

  const deleteVenue = async (id: number | undefined) => {
    if (id === undefined) {
      // Draft venue - just remove from list
      onVenuesChange(venues.filter((v) => v.id !== undefined));
      setSelectedVenueId(venues.find((v) => v.id !== undefined)?.id);
      return;
    }

    if (!confirm('Delete this venue? Events using this venue will be affected.')) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('Deleting...');

    try {
      const response = await fetch(`/api/admin/venue-v2/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      onVenuesChange(venues.filter((v) => v.id !== id));
      setSelectedVenueId(venues.find((v) => v.id !== id)?.id);
      setSaveStatus('Deleted');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveStatus(`Error: ${errorMessage}`);
      console.error('Delete venue error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveVenue = async (venue: DraftVenue) => {
    setIsSaving(true);
    setSaveStatus('Saving...');

    try {
      if (venue.id === undefined) {
        // Create new venue
        const response = await fetch('/api/admin/venue-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(venue),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Create failed');
        }

        const { venue: newVenue } = await response.json();
        onVenuesChange(venues.map((v) => (v.id === undefined ? newVenue : v)));
        setSelectedVenueId(newVenue.id);
        setSaveStatus('Created');
      } else {
        // Update existing venue
        const response = await fetch(`/api/admin/venue-v2/${venue.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(venue),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Update failed');
        }

        const { venue: updatedVenue } = await response.json();
        onVenuesChange(venues.map((v) => (v.id === venue.id ? updatedVenue : v)));
        setSaveStatus('Saved');
      }
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveStatus(`Error: ${errorMessage}`);
      console.error('Save venue error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateVenueField = (field: keyof DraftVenue, value: string | number | boolean) => {
    if (!selectedVenue) return;
    if (value === undefined) return;

    const updated = { ...selectedVenue, [field]: value };
    onVenuesChange(venues.map((v) => (v.id === selectedVenueId ? updated : v)));
  };

  const isMaxCapacityValid = (capacity: number | undefined): boolean => {
    if (capacity === undefined || isNaN(capacity)) return false;
    return capacity >= 1 && capacity <= 99999;
  };

  const isSaveDisabled = !selectedVenue?.name || !isMaxCapacityValid(selectedVenue?.maxCapacity);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Venue List */}
      <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Venues ({venues.length})</h3>
          <button
            onClick={addVenue}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            + New
          </button>
        </div>
        <div className="space-y-2">
          {venues.map((venue) => (
            <button
              key={venue.id ?? 'draft'}
              onClick={() => setSelectedVenueId(venue.id)}
              className={`w-full rounded-lg p-3 text-left transition-colors ${
                selectedVenueId === venue.id
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/75 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {venue.name || '(New Venue)'}
                    {venue.id === undefined && (
                      <span className="ml-2 text-xs text-yellow-400">(Draft)</span>
                    )}
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {venue.isVirtual ? '🌐 Virtual' : '📍 Physical'} • Max: {venue.maxCapacity}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Venue Editor */}
      {selectedVenue ? (
        <div className="rounded-[28px] border border-white/10 bg-white/10 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">
              {selectedVenue.id === undefined ? 'New Venue' : 'Edit Venue'}
            </h3>
            <div className="flex items-center gap-3">
              {saveStatus && (
                <span
                  className={`text-sm ${
                    saveStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {saveStatus}
                </span>
              )}
              <button
                onClick={() => saveVenue(selectedVenue)}
                disabled={isSaving || isSaveDisabled}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedVenue.id === undefined ? 'Create' : 'Save'}
              </button>
              {selectedVenue.id !== undefined && (
                <button
                  onClick={() => deleteVenue(selectedVenue.id)}
                  disabled={isSaving}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={selectedVenue.name}
                onChange={(e) => updateVenueField('name', e.target.value)}
                placeholder="e.g., Taiwan Office"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white placeholder-white/40"
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Location <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedVenue.location}
                onChange={(e) => updateVenueField('location', e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white"
              >
                <option value="TW">Taiwan (TW)</option>
                <option value="NL">Netherlands (NL)</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>

            {/* Address */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">Address</label>
              <input
                type="text"
                value={selectedVenue.address || ''}
                onChange={(e) => updateVenueField('address', e.target.value)}
                placeholder="e.g., 123 Main St, Taipei"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white placeholder-white/40"
              />
            </div>

            {/* Max Capacity */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Max Capacity <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={selectedVenue.maxCapacity ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    return; // Don't update if empty - keep existing value
                  }
                  const num = parseInt(value);
                  if (!isNaN(num)) {
                    updateVenueField('maxCapacity', num);
                  }
                }}
                placeholder="e.g., 20"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-2 text-white placeholder-white/40"
              />
              {selectedVenue.maxCapacity !== undefined && !isMaxCapacityValid(selectedVenue.maxCapacity) && (
                <p className="mt-1 text-sm text-red-400">
                  Max capacity must be between 1 and 99999
                </p>
              )}
            </div>

            {/* Virtual */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white">
                <input
                  type="checkbox"
                  checked={selectedVenue.isVirtual}
                  onChange={(e) => updateVenueField('isVirtual', e.target.checked)}
                  className="rounded border-white/20"
                />
                Virtual venue (online)
              </label>
            </div>

            {/* Metadata */}
            {selectedVenue.id !== undefined && (
              <div className="mt-6 rounded-lg border border-white/10 bg-black/10 p-4 text-xs text-white/50">
                <div>ID: {selectedVenue.id}</div>
                <div>Created: {new Date(selectedVenue.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(selectedVenue.updatedAt).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-[28px] border border-white/10 bg-white/10 p-6">
          <p className="text-white/50">Select a venue or create a new one</p>
        </div>
      )}
    </div>
  );
}
