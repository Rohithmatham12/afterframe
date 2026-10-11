import Cinema from '@/components/cinema';
import films from '@/lib/catalog-snapshot.json';
export default function Page() {
  return <Cinema initialFilms={films} />;
}
