import { useEffect, useRef } from 'react';
import type { CustomerAddress } from '../../../services/deliveryCustomerService';

export const customerAddressHeading = (address: CustomerAddress) =>
  [address.block_number ? `Block ${address.block_number}` : '', address.area_name, address.governorate]
    .filter(Boolean).join(' · ') || 'Saved address';

export function CustomerAddressPicker({ addresses, onChoose, onClose, onNew }: {
  addresses: CustomerAddress[];
  onChoose: (address: CustomerAddress) => void;
  onClose: () => void;
  onNew: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} aria-labelledby="customer-address-picker-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-950/50">
    <div className="border-b border-slate-200 px-5 py-4">
      <h3 id="customer-address-picker-title" className="text-lg font-black text-slate-900">Choose a delivery address</h3>
      <p className="mt-1 text-sm text-slate-600">Select a saved address or enter a new one for this order.</p>
    </div>
    <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
      {addresses.map((address, index) => (
        <button key={index} type="button" onClick={() => onChoose(address)}
          className="block w-full rounded-lg border border-slate-200 px-3 py-3 text-left hover:border-brand/50 hover:bg-slate-50 focus-visible:outline-brand">
          <span className="block text-sm font-bold text-slate-900">{customerAddressHeading(address)}</span>
          {address.customer_address && <span className="mt-1 block break-words text-sm text-slate-600">{address.customer_address}</span>}
          {address.location_url && <span className="mt-1 block break-all text-xs text-slate-500">{address.location_url}</span>}
        </button>
      ))}
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
      <button type="button" className="btn-neutral" onClick={onClose}>Cancel</button>
      <button type="button" className="btn-primary" onClick={onNew}>Use new address</button>
    </div>
  </dialog>;
}
