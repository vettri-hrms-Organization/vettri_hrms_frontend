import { CalendarRange, Megaphone, MessageSquareHeart } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import AnnouncementsFeed from '../announcements/AnnouncementsFeed';
import MyHolidays from '../leave/MyHolidays';
import Surveys from '../surveys/Surveys';

const TABS = [
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'holidays', label: 'Holidays', icon: CalendarRange },
  { key: 'surveys', label: 'Surveys & polls', icon: MessageSquareHeart },
];
const KEYS = TABS.map((tab) => tab.key);

/** One place for everything the company shares with everyone: news, holidays and surveys. */
export default function Company() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = KEYS.includes(requested) ? requested : 'announcements';
  const changeTab = (key) => setSearchParams(key === 'announcements' ? {} : { tab: key }, { replace: true });

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Company" title="Company" description="Announcements, holidays and surveys for everyone at work" />
      <Tabs items={TABS} value={tab} onChange={changeTab} ariaLabel="Company sections" />
      {tab === 'announcements' && <AnnouncementsFeed embedded />}
      {tab === 'holidays' && <MyHolidays embedded />}
      {tab === 'surveys' && <Surveys embedded />}
    </div>
  );
}
