'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../auth/provider';
import { ApiError } from '../../lib/api';
import { catalog, type StoreReviews } from './catalog';

const date = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'H';

export function ProductReviewsSection({ slug, reviews, loading, error, onRefresh, onLoadMore }: { slug: string; reviews?: StoreReviews; loading: boolean; error: string; onRefresh: () => void; onLoadMore: () => void }) {
  const auth = useAuth();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const count = reviews?.summary.reviewCount ?? 0;
  const roundedRating = Math.round(reviews?.summary.averageRating ?? 0);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setFields({}); setFeedback('');
    if (!rating) { setFormError('Choose a star rating.'); return; }
    setBusy(true);
    try {
      const result = await catalog.submitReview(slug, { rating, ...(title.trim() ? { title: title.trim() } : {}), body: body.trim() });
      setFeedback(result.message); setRating(0); setTitle(''); setBody('');
    } catch (cause) {
      if (cause instanceof ApiError) { setFormError(cause.message); setFields(cause.fields); }
      else setFormError('Your review could not be submitted. Please try again.');
    } finally { setBusy(false); }
  };
  return <div className="store-reviews-panel">
    <div className="store-reviews-overview"><div><p className="store-kicker">Words from the community</p><h3>Customer reviews</h3></div><p className="store-reviews-score" aria-label={count ? `${reviews?.summary.averageRating?.toFixed(1)} out of 5 from ${count} reviews` : 'No reviews yet'}><strong>{count ? reviews?.summary.averageRating?.toFixed(1) : '—'}</strong><span aria-hidden="true">{'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}</span><small>{count} {count === 1 ? 'review' : 'reviews'}</small></p></div>
    {loading && !reviews ? <p role="status">Loading reviews…</p> : error && !reviews ? <div role="alert"><p>{error}</p><button type="button" className="store-pdp-text-button" onClick={onRefresh}>Try again</button></div> : count === 0 ? <p className="store-reviews-empty">No reviews yet. Be the first to review this piece.</p> : <div className="store-review-list">{reviews?.items.map(review => <article key={review.id} className="store-review"><div className="store-review-avatar">{review.avatarUrl ? <img src={review.avatarUrl} alt=""/> : <span aria-hidden="true">{initials(review.reviewerName)}</span>}</div><div><div className="store-review-meta"><strong>{review.reviewerName}</strong>{review.verifiedPurchase && <span className="store-verified">Verified purchase</span>}<time dateTime={review.createdAt}>{date(review.createdAt)}</time></div><p className="store-review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}<span aria-hidden="true">{'☆'.repeat(5 - review.rating)}</span></p>{review.title && <h4>{review.title}</h4>}<p>{review.body}</p>{review.storeReply && <div className="store-review-reply"><strong>From the store</strong><p>{review.storeReply.body}</p></div>}</div></article>)}{error && <p role="alert">{error} <button type="button" className="store-pdp-text-button" onClick={onLoadMore}>Try again</button></p>}{reviews && reviews.items.length < count && <button type="button" className="store-pdp-text-button" onClick={onLoadMore} disabled={loading}>{loading ? 'Loading…' : 'Show more reviews'}</button>}</div>}
    <div className="store-review-write"><h3>Write a review</h3>{auth.status === 'initializing' ? <p role="status">Checking your session…</p> : auth.status === 'error' ? <p role="alert">Unable to check your session. <button type="button" className="store-pdp-text-button" onClick={auth.retryInitialization}>Try again</button></p> : auth.status !== 'authenticated' ? <div><p>Sign in to share your thoughts about this piece.</p><Link className="store-pdp-button store-pdp-button-secondary" href={`/login?returnTo=${encodeURIComponent(`/products/${slug}`)}`}>Log in to write a review</Link></div> : auth.user?.role !== 'CUSTOMER' ? <p>Reviews are available to customer accounts.</p> : feedback ? <p role="status" className="store-review-feedback">{feedback}</p> : <form onSubmit={submit}><fieldset><legend>Your rating <span aria-hidden="true">*</span></legend><div className="store-rating-choices">{[1, 2, 3, 4, 5].map(value => <span key={value}><input type="radio" id={`product-rating-${value}`} name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} required/><label htmlFor={`product-rating-${value}`} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} data-active={value <= rating}>★</label></span>)}</div></fieldset><label htmlFor="review-title">Title <span>(optional)</span></label><input id="review-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} placeholder="A few words to sum it up"/><label htmlFor="review-body">Your review <span aria-hidden="true">*</span></label><textarea id="review-body" value={body} onChange={event => setBody(event.target.value)} required minLength={10} maxLength={3000} rows={5} placeholder="What did you think of this piece?"/>{fields.rating && <p role="alert">{fields.rating.join(' ')}</p>}{fields.body && <p role="alert">{fields.body.join(' ')}</p>}{fields.title && <p role="alert">{fields.title.join(' ')}</p>}{formError && <p role="alert">{formError}</p>}<button type="submit" className="store-pdp-button store-pdp-button-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button><p className="store-review-moderation">Reviews are checked before they appear in the store.</p></form>}</div>
  </div>;
}
