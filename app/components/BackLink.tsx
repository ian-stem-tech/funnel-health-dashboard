import Link from 'next/link';

export function BackLink() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return (
    <Link href={`${basePath}/`} className="back-link">
      ← Dashboard
    </Link>
  );
}
