import { api } from '../../lib/api';
export type Overview = {
 period: { preset:string; start:string; end:string; timezone:string; bucket:string; previousFrom:string; previousTo:string }; currency:string; refreshedAt:string;
 current:Metrics; previous:Metrics; buckets:{date:string;orders:number;capturedPaise:number;refundedPaise:number;netPaise:number}[];
 statuses:{status:string;count:number}[]; attention:{awaiting:number;pendingReviews:number};
 recent:{orders:{id:string;orderNumber:string;customerName:string;createdAt:string;totalPaise:number;currency:string;status:string;paymentStatus:string|null}[];customers:{id:string;name:string;avatarUrl:string|null;createdAt:string;emailVerifiedAt:string|null;disabledAt:string|null;deletedAt:string|null}[];products:{id:string;name:string;thumbnailUrl:string|null;category:string|null;createdAt:string;status:string}[];reviews:{id:string;customerName:string;avatarUrl:string|null;productName:string;rating:number;body:string;createdAt:string;status:string}[]}; categories:{id:string;name:string;products:number}[];
};
type Metrics={orders:number;customers:number;capturedPaise:number;refundedPaise:number;netPaise:number;aovPaise:number|null};
export const dashboardService={get:(params:URLSearchParams,signal?:AbortSignal)=>api<Overview>(`admin/dashboard/overview?${params}`,{signal})};
