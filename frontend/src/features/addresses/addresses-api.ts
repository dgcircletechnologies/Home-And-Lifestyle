import { api } from '../../lib/api';

export type Address = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; pinCode: string; countryCode: 'IN'; label: 'Home' | 'Office' | 'Other' | null; isDefault: boolean };
export type AddressInput = Omit<Address, 'id' | 'countryCode'>;
export const addressesApi = {
  list: () => api<Address[]>('addresses'),
  create: (body: AddressInput) => api<Address>('addresses', { method: 'POST', body }),
  update: (id: string, body: Partial<AddressInput>) => api<Address>(`addresses/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<{ deleted: boolean; id: string }>(`addresses/${id}`, { method: 'DELETE' }),
};
export const addressLines = (address: Address) => [address.line1, address.line2, `${address.city}, ${address.state} ${address.pinCode}`].filter(Boolean);
