import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="flex-1 bg-[var(--color-dark-grey)] flex items-center justify-center">
      <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
        <Image
          src="/MALI Ed Logo (White).svg"
          alt="MALI Ed"
          width={400}
          height={120}
          className="h-24 w-auto"
        />
      </div>
    </main>
  );
}
