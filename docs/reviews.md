# Admin reviews and profile photos

Reviews use the existing `Review` entity and `Customer` author relation. `User.customerId` links the login account to that customer; the author avatar is read from the current `User.avatarUrl`. Existing customers without a linked account show their saved customer name and an avatar fallback. Reviews have required 1–5 ratings and no variant or order-line reference.

## Moderation

The persisted states are `PENDING`, `APPROVED` (published), `REJECTED`, and `SPAM`. Trash is reversible through `trashedAt`; restore returns to Pending. Rejection requires an internal reason. Approve, unpublish, reject, spam, trash, and restore each write one `ReviewModerationHistory` row with the authenticated admin. Mutations require `expectedVersion` from the detail response; stale versions return 409. A reply is one store-owned text field and is editable or removable only while the review is published. No customer-facing review read or submission API exists in the current repository.

Only Approved reviews with `trashedAt IS NULL` contribute to `ratingSummary`. The service computes the count and average from original ratings on read. No cached product rating fields exist. A review is marked verified only when the same Customer has a Delivered or Completed order line whose purchase-time `productIdSnapshot` matches the reviewed product. A different product, pending order, or unlinked customer does not qualify.

## API

All management paths require ADMIN. `GET /api/admin/reviews` accepts `page`, `pageSize` (1–100), `search`, `status` (`ALL`, `PENDING`, `APPROVED`, `REJECTED`, `SPAM`, `TRASH`), `productId`, `rating` (1–5), `replied` (`all`, `yes`, `no`), and `sort` (`newest`, `oldest`). It returns `{items,page,pageSize,total,counts}`. `GET /api/admin/reviews/:id` adds full text, history, reply, verified-purchase result, rating summary, and allowed actions. `PATCH /api/admin/reviews/:id/status` accepts `{action,expectedVersion,reason?}`. `POST /api/admin/reviews/:id/reply` accepts `{body,expectedVersion}`. `DELETE /api/admin/reviews/:id/reply` accepts `{expectedVersion}`.

`GET /api/account/photo/config`, `POST /api/account/photo`, and `DELETE /api/account/photo` require CUSTOMER or ADMIN and always target the current authenticated user. The config response exposes upload limits, never credentials. Upload uses multipart field `image`. The existing root `.env` supplies `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, and `CATEGORY_IMAGE_MAX_BYTES` (5 MB default, shared with avatar uploads). Accepted source formats are JPEG, PNG, and WebP, 32–8192 pixels per side and at most 16 megapixels. Cloudinary stores a 256×256 square delivery image in the configured folder's `avatars` sibling. The public ID stays server-side. An old asset is removed only after the new URL is saved. If cleanup is deferred, the backend logs the asset ID for an operator to compare against `User.avatarPublicId` before deleting it from Cloudinary.

Apply additive migrations with `cd backend && npx prisma migrate deploy && npm run prisma:generate`; restart the backend afterward. The root `.env` is the only credential source.
