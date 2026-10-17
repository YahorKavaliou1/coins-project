import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  createAddress,
  deleteAddress,
  getSellerSettings,
  listAddresses,
  updateAddress,
  updateSellerSettings,
} from "../api/account";
import { updateProfile } from "../api/users";
import { getErrorMessage, type ApiError } from "../api/client";
import { AddressForm } from "../components/AddressForm";
import { EMPTY_ADDRESS, addressSummary, cleanAddress } from "../utils/address";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { inputClass, labelClass, sectionTitleClass } from "../components/formStyles";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import type { Address, AddressFields, SellerSettings, ShippingOption } from "../types";
import { canSell } from "../utils/roles";

const sectionClass = "bg-white border border-gray-200 rounded-md p-5 max-sm:p-4";
const primaryButton =
  "bg-accent hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-sm px-4 py-2.5 disabled:opacity-50";
const secondaryButton =
  "border border-gray-300 text-gray-700 hover:border-accent hover:text-accent text-xs font-bold uppercase tracking-wide rounded-sm px-4 py-2.5";

/** Same as MAX_SHIPPING_OPTIONS in app/schemas/account.py. */
const MAX_SHIPPING_OPTIONS = 5;

export function AccountPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  if (!currentUser) return <p>Loading…</p>;
  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <h1 className="text-xl font-bold">Account settings</h1>
      <ProfileSection />
      <AddressesSection />
      {canSell(currentUser) && <SellerSection />}
    </div>
  );
}

function ProfileSection() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(currentUser.full_name ?? "");
  const mutation = useMutation({
    mutationFn: () => updateProfile(name),
    onSuccess: (user) => {
      setUser(user);
      toast.success("Profile saved.");
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });
  return (
    <section className={sectionClass}>
      <h2 className={sectionTitleClass}>Profile</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="flex items-end gap-3 max-sm:flex-col max-sm:items-stretch"
      >
        <div className="flex-1">
          <label className={labelClass}>Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
          <p className="text-xs text-gray-400 mt-1">
            {canSell(currentUser) ? "Shown to the buyers of your coins." : "Shown to the sellers you buy from."}
          </p>
        </div>
        <button type="submit" disabled={mutation.isPending} className={`${primaryButton} mb-5 max-sm:mb-0`}>
          Save
        </button>
      </form>
    </section>
  );
}

function AddressesSection() {
  const queryClient = useQueryClient();
  const { data: addresses } = useQuery({ queryKey: ["addresses"], queryFn: listAddresses });
  // null: no form open; "new" or the address being edited.
  const [editing, setEditing] = useState<"new" | Address | null>(null);
  const [form, setForm] = useState<AddressFields>(EMPTY_ADDRESS);
  const [deleting, setDeleting] = useState<Address | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["addresses"] });
  const saveMutation = useMutation({
    mutationFn: () =>
      editing === "new" || editing === null
        ? createAddress(cleanAddress(form))
        : updateAddress(editing.id, { ...cleanAddress(form), is_default: editing.is_default }),
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast.success("Address saved.");
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });
  const defaultMutation = useMutation({
    mutationFn: (address: Address) => updateAddress(address.id, { ...address, is_default: true }),
    onSuccess: refresh,
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: (address: Address) => deleteAddress(address.id),
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
    onError: (err: ApiError) => {
      setDeleting(null);
      toast.error(getErrorMessage(err));
    },
  });

  function open(target: "new" | Address) {
    setEditing(target);
    setForm(target === "new" ? EMPTY_ADDRESS : { ...target, phone: target.phone ?? "" });
  }

  return (
    <section className={sectionClass}>
      <h2 className={sectionTitleClass}>Delivery addresses</h2>
      <p className="text-sm text-gray-500 -mt-2 mb-4">Pick one at checkout instead of typing it each time.</p>

      <div className="flex flex-col gap-2 mb-4">
        {addresses?.length === 0 && <p className="text-sm text-gray-400">No saved addresses yet.</p>}
        {addresses?.map((address) => (
          <div key={address.id} className="flex items-start gap-3 border border-gray-200 rounded-sm p-3">
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-semibold flex items-center gap-2">
                {address.recipient_name}
                {address.is_default && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-accent bg-accent/10 rounded-full px-2 py-0.5">
                    Default
                  </span>
                )}
              </div>
              <div className="text-gray-600">{addressSummary({ ...address, recipient_name: "" })}</div>
              {address.phone && <div className="text-gray-400 text-xs">{address.phone}</div>}
            </div>
            <div className="flex gap-1 shrink-0">
              {!address.is_default && (
                <button type="button" title="Make default" onClick={() => defaultMutation.mutate(address)} className="p-1.5 text-gray-400 hover:text-accent">
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button type="button" title="Edit" onClick={() => open(address)} className="p-1.5 text-gray-400 hover:text-accent">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" title="Delete" onClick={() => setDeleting(address)} className="p-1.5 text-gray-400 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="border border-gray-200 rounded-sm p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">{editing === "new" ? "New address" : "Edit address"}</h3>
            <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700" title="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
          <AddressForm value={form} onChange={setForm} />
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saveMutation.isPending} className={primaryButton}>
              Save address
            </button>
            <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => open("new")} className={`${secondaryButton} flex items-center gap-1.5`}>
          <Plus className="w-4 h-4" />
          Add address
        </button>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this address?"
          message={addressSummary(deleting)}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          destructive
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

interface OptionDraft {
  name: string;
  price: string;
}

function SellerSection() {
  const { data } = useQuery({ queryKey: ["seller-settings"], queryFn: getSellerSettings });
  // The form mounts once the settings are loaded, so its state starts from them.
  return data ? <SellerForm initial={data} /> : <section className={sectionClass}>Loading…</section>;
}

function SellerForm({ initial }: { initial: SellerSettings }) {
  const queryClient = useQueryClient();
  const [paymentDetails, setPaymentDetails] = useState(initial.payment_details ?? "");
  const [email, setEmail] = useState(initial.contact_email ?? "");
  const [phone, setPhone] = useState(initial.contact_phone ?? "");
  const [note, setNote] = useState(initial.contact_note ?? "");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial.shipping_options.map((o) => ({ name: o.name, price: o.price.toFixed(2) }))
  );

  const mutation = useMutation({
    mutationFn: () =>
      updateSellerSettings({
        payment_details: paymentDetails.trim() || null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        contact_note: note.trim() || null,
        shipping_options: options
          .filter((o) => o.name.trim())
          .map((o): ShippingOption => ({ name: o.name.trim(), price: Number(o.price.replace(",", ".")) || 0 })),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["seller-settings"], saved);
      setOptions(saved.shipping_options.map((o) => ({ name: o.name, price: o.price.toFixed(2) })));
      toast.success(
        saved.buyers_notified > 0
          ? `Seller settings saved. ${saved.buyers_notified} ${saved.buyers_notified === 1 ? "buyer" : "buyers"} with unpaid orders got your new payment details by email.`
          : "Seller settings saved."
      );
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  function setOption(index: number, change: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...change } : o)));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className={`${sectionClass} flex flex-col gap-5`}
    >
      <div>
        <h2 className={sectionTitleClass}>Seller settings</h2>
        <p className="text-sm text-gray-500 -mt-2">Sent to the buyers of your coins with every order.</p>
      </div>

      <div>
        <label className={labelClass}>Payment details</label>
        <textarea
          value={paymentDetails}
          onChange={(e) => setPaymentDetails(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={"e.g. IBAN LV12 HABA 0000 0000 0000 0\nRecipient: Jane Doe\nBank: Swedbank"}
          className={`${inputClass} resize-y`}
        />
        {!paymentDetails.trim() ? (
          <p className="text-xs text-amber-700 mt-1">Required to list coins for sale.</p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">
            If you change them, buyers whose orders still await payment get the new details by email.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <div>
          <label className={labelClass}>Contact email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} pattern="[0-9+()\-. ]*" className={inputClass} />
        </div>
        <div className="col-span-2 max-sm:col-span-1">
          <label className={labelClass}>Other contacts</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. Telegram @coins, WhatsApp, best time to call"
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Shipping options</label>
        <p className="text-xs text-gray-400 mb-2">
          The buyer picks one at checkout; its price is added to the order. Without options, shipping is arranged with
          the buyer.
        </p>
        <div className="flex flex-col gap-2">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                value={option.name}
                onChange={(e) => setOption(index, { name: e.target.value })}
                maxLength={100}
                placeholder="e.g. Registered mail"
                className={`${inputClass} flex-1`}
              />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
                <input
                  value={option.price}
                  onChange={(e) => setOption(index, { price: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`${inputClass} pl-6`}
                />
              </div>
              <button
                type="button"
                title="Remove"
                onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                className="p-1.5 text-gray-400 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {options.length < MAX_SHIPPING_OPTIONS && (
          <button
            type="button"
            onClick={() => setOptions((prev) => [...prev, { name: "", price: "" }])}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-dark"
          >
            <Plus className="w-3.5 h-3.5" />
            Add shipping option
          </button>
        )}
      </div>

      <div>
        <button type="submit" disabled={mutation.isPending} className={primaryButton}>
          {mutation.isPending ? "Saving…" : "Save seller settings"}
        </button>
      </div>
    </form>
  );
}
