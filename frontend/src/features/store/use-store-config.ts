'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
export type PublicStoreConfig = { storeName: string; supportEmail: string | null; supportPhone: string | null; publicAddress: string | null; businessHours: string | null; market: 'India'; currency: 'INR'; language: 'English'; timezone: 'Asia/Kolkata'; gifting: { giftMessagesAvailable: boolean; giftReceiptsAvailable: boolean; giftWrapFeePaise: number } };
export function useStoreConfig() {
  const [config,setConfig]=useState<PublicStoreConfig>();
  useEffect(()=>{let live=true;const refresh=()=>{void api<PublicStoreConfig>('store/config').then(value=>{if(live)setConfig(value)}).catch(()=>undefined)};refresh();window.addEventListener('store:config-updated',refresh);return()=>{live=false;window.removeEventListener('store:config-updated',refresh)}},[]);
  return config;
}
