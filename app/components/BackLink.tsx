import Link from 'next/link';

export function BackLink() {
  return (
    <Link href="/" className="back-link">
      ← Dashboard
    </Link>
  );
}
