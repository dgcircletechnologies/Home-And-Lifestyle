import { Homepage } from '../features/store/homepage';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Home & Lifestyle | Objects for a home that feels like you', description: 'Explore home décor, lighting, soft furnishings, kitchen and dining pieces from Home & Lifestyle India.' };
export default function Home() { return <Homepage />; }
