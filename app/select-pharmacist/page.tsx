
import React, { useState, useEffect, useMemo } from 'react';
import { UserCircle, ShieldCheck, ArrowRight, Search, X, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pharmacist, Branch } from '../../types';

interface SelectPharmacistPageProps {
  branch: Branch;
  onSelect: (pharmacist: Pharmacist) => void;
  onLogout: () => void;
  backLabel?: string;
}

export const SelectPharmacistPage: React.FC<SelectPharmacistPageProps> = ({ branch, onSelect, onLogout, backLabel = 'Change Location' }) => {
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPharmacists = async () => {
      const data = await supabase.pharmacists.listByBranch(branch.id);
      setPharmacists(data);
    };
    fetchPharmacists();
  }, [branch.id]);

  const filteredPharmacists = useMemo(() => {
    if (!searchQuery.trim()) return pharmacists;
    return pharmacists.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pharmacists, searchQuery]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 relative overflow-hidden font-sans">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.02]">
          <svg width="100%" height="100%"><defs><pattern id="grid-official" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid-official)" /></svg>
        </div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/[0.02] rounded-full blur-[120px] -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-slate-200/30 rounded-full blur-[100px] -ml-32 -mb-32"></div>
      </div>

      <div className="absolute top-8 right-8 z-[100] animate-in fade-in duration-1000">
        <button
          onClick={onLogout}
          className="group flex items-center space-x-3 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 transition-all duration-300"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{backLabel}</span>
        </button>
      </div>

      <div className="max-w-6xl w-full relative z-10 page-enter">
        <div className="text-center mb-14">
          <div className="inline-flex items-center space-x-2 bg-slate-50 text-brand px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] border border-slate-100 mb-8">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Personnel Identification</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-4 leading-none">
            Who's on shift<span className="text-brand">?</span>
          </h2>
          <p className="text-slate-400 font-medium text-base">
            Active Terminal: <span className="text-slate-700 font-bold">{branch.name}</span>
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-14 relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-50/80 border-2 border-slate-100 rounded-xl py-4 pl-14 pr-14 text-base font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-brand focus:bg-white focus:shadow-lg focus:shadow-brand/5 transition-all"
            placeholder="Search personnel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {filteredPharmacists.map((p, index) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="group bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 transition-all duration-400 flex flex-col items-center text-center active:scale-[0.98] relative overflow-hidden card-hover"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative mb-5 z-10">
                <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-brand group-hover:text-white transition-all duration-400 shadow-sm">
                  <UserCircle className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-[2.5px] border-white rounded-full"></div>
              </div>

              <div className="w-full relative z-10">
                <p className="text-base font-black text-slate-800 group-hover:text-brand transition-colors leading-tight mb-1.5">
                  {p.name}
                </p>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-brand/40 transition-colors">
                  Pharmacist
                </p>

                <div className="mt-5 flex justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
                  <div className="bg-brand text-white px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Select</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </button>
          ))}

          {filteredPharmacists.length === 0 && (
            <div className="col-span-full bg-slate-50 p-20 rounded-2xl text-center border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold text-sm">No personnel matches found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        <div className="mt-20 text-center">
          <p className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.4em]">Secure Identity Authentication Protocol</p>
        </div>
      </div>
    </div>
  );
};
