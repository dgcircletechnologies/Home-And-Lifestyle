import type { Metadata } from 'next';
import { AboutPage } from '../../features/store/about-page';

export const metadata: Metadata = {
  title: 'About | Home & Lifestyle',
  description: 'Get to know Home & Lifestyle: thoughtful décor, kitchenware and everyday objects selected for homes across India.',
};

export default function Page() { return <AboutPage />; }
